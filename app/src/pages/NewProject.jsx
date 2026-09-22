import { useEffect, useState } from "react";
import {
  Alert,
  ActionIcon,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  FileInput,
} from "@mantine/core";
import {
  DateInput,
  DateTimePicker,
} from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import JSZip from "jszip";
import * as XLSX from "xlsx";

import { supabase } from "../lib/supabase";
import { generateNumber } from "../lib/generateNumber";

import {
  createNotificationForAssignedName,
  getActiveProfiles,
} from "../services/notificationService";

import {
  createProjectMaterialRequests as saveProjectMaterialRequests,
} from "../services/projectMaterialService";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

function createBlankMaterialRequest() {
  return {
    local_id: `${Date.now()}-${Math.random()}`,
    qty: 1,
    dimensions: "",
    item: "",
    description: "",
    vendor: "",
    needed_by: null,
    priority: "Normal",
  };
}

function hasMaterialRequestData(request) {
  return Boolean(
    String(request.item || "").trim() ||
      String(request.dimensions || "").trim() ||
      String(request.description || "").trim() ||
      String(request.vendor || "").trim() ||
      request.needed_by
  );
}

function normalizeDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const year = value.getFullYear();

    const month = String(
      value.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      value.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return value;
}

const cleanLine = (value) => String(value || "").replace(/^\s*[-•☐□*]+\s*/, "").trim();

function prepareIntakeDraft(sourceText) {
  const lines = String(sourceText || "").split(/\r?\n/).map(cleanLine).filter(Boolean);
  const findValue = (labels) => {
    const row = lines.find((line) => labels.some((label) => line.toLowerCase().startsWith(`${label}:`)));
    return row ? row.slice(row.indexOf(":") + 1).trim() : "";
  };
  const projectName = findValue(["project", "project name", "job", "job name", "title"]) || lines[0] || "";
  const customerName = findValue(["customer", "client", "company"]);
  const phone = findValue(["phone", "phone number", "telephone", "mobile"]);
  const email = findValue(["email", "email address"]);
  const address = findValue(["address", "project address", "job address", "site address"]);
  const assignedTo = findValue(["assigned to", "project lead", "lead", "owner"]);
  const dueDate = findValue(["due", "due date", "needed by", "required by"]);
  const checklist = lines.filter((line) => /^(task|checklist|to do|todo|step)\s*:/i.test(line)).map((line) => cleanLine(line.slice(line.indexOf(":") + 1))).filter(Boolean);
  const materials = lines.filter((line) => /^(material|materials|supply|supplies)\s*:/i.test(line)).map((line) => cleanLine(line.slice(line.indexOf(":") + 1))).filter(Boolean);
  const quoteItems = lines.map((line) => {
    const match = line.match(/^(.*?)(?:\s+|\s*[-–—:]\s*)\$([\d,]+(?:\.\d{1,2})?)$/);
    return match ? { title: cleanLine(match[1]), quantity: 1, unit_price: Number(match[2].replace(/,/g, "")) } : null;
  }).filter(Boolean);
  return { projectName, customerName, phone, email, address, assignedTo, dueDate, checklist, materials, quoteItems, sourceText: String(sourceText || "").trim() };
}

function normalizeMatchValue(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findMatchingCustomer(customers, draft) {
  const targetName = normalizeMatchValue(draft.customerName);
  const targetPhone = normalizeMatchValue(draft.phone);
  const targetEmail = String(draft.email || "").trim().toLowerCase();
  if (!targetName && !targetPhone && !targetEmail) return null;
  return customers.find((customer) => {
    const names = [
      customer.company_name,
      customer.contact_name,
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
    ].map(normalizeMatchValue).filter(Boolean);
    return (targetEmail && String(customer.email || "").trim().toLowerCase() === targetEmail)
      || (targetPhone && normalizeMatchValue(customer.phone) === targetPhone)
      || (targetName && names.includes(targetName));
  }) || null;
}

async function readIntakeFile(file) {
  if (!file) return "";
  const extension = file.name.split(".").pop().toLowerCase();
  if (["txt", "csv", "md"].includes(extension)) return file.text();
  if (["xlsx", "xls"].includes(extension)) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return workbook.SheetNames.map((name) => `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join("\n\n");
  }
  if (extension === "docx") {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) throw new Error("The Word document did not contain readable text.");
    return xml.replace(/<w:tab\/?[^>]*>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
    const document = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str || "").join(" "));
    }
    const text = pages.join("\n\n").trim();
    if (!text) {
      throw new Error("This PDF does not contain readable text. If it is a scan or photo, paste the project write-up into the text box instead.");
    }
    return text;
  }
  throw new Error("Use a PDF, Word (.docx), Excel (.xlsx/.xls), text, CSV, or Markdown file.");
}

async function createProjectMaterialRequests({
  project,
  requests,
  requestedBy,
}) {
  const preparedRequests = requests.map(
    (request) => ({
      quantity:
        Number(request.qty) || 1,

      dimensions:
        String(
          request.dimensions || ""
        ).trim(),

      itemName:
        String(
          request.item || ""
        ).trim(),

      description:
        String(
          request.description || ""
        ).trim(),

      vendorName:
        String(
          request.vendor || ""
        ).trim(),

      neededBy:
        normalizeDateValue(
          request.needed_by
        ),

      priority:
        request.priority ||
        "Normal",

      assignedTo:
        "Lori",

      status:
        "Request Submitted",

      createdBy:
        requestedBy || "",
    })
  );

  return saveProjectMaterialRequests({
    project,
    requests: preparedRequests,
    createdBy: requestedBy || "",
  });
}

function NewProject({ setPage }) {
  const [customers, setCustomers] =
    useState([]);

  const [profiles, setProfiles] =
    useState([]);

  const [projectPath, setProjectPath] =
    useState(null);

  const [saving, setSaving] =
    useState(false);
  const [intakeText, setIntakeText] = useState("");
  const [intakeFile, setIntakeFile] = useState(null);
  const [intakeDraft, setIntakeDraft] = useState(null);
  const [intakeChecklist, setIntakeChecklist] = useState([]);
  const [intakeQuoteItems, setIntakeQuoteItems] = useState([]);
  const [preparingIntake, setPreparingIntake] = useState(false);
  const [intakeMatchMessage, setIntakeMatchMessage] = useState("");
  const [showAdvancedWorkflow, setShowAdvancedWorkflow] = useState(false);

  const [
    materialRequests,
    setMaterialRequests,
  ] = useState([
    createBlankMaterialRequest(),
  ]);

  const [formData, setFormData] =
    useState({
      customer_id: null,

      project_name: "",
      project_type: "Railing",
      project_category:
        "Field Fabrication",

      intake_owner: "",
      work_location:
        "Field + Shop",

      status: "New",
      priority: "Normal",
      assigned_to: "",

      contact_name: "",
      contact_phone: "",

      job_address: "",
      city: "",
      state: "NC",
      zip_code: "",

      site_visit_required: true,
      measurements_required: true,
      quote_required: true,
      fabrication_required: true,
      test_fit_required: true,
      finish_required: true,
      install_required: true,

      site_visit_date: null,
      site_visit_outcome: null,
      site_visit_result_notes: "",
      promised_quote_date: null,
      install_date: null,
      due_date: null,
      planned_start_date: null,
      planned_duration_days: null,

      is_quick_turnaround: false,
      quick_turnaround_required_by: null,
      quick_turnaround_priority: "Urgent",
      quick_turnaround_reason: "",

      quote_status:
        "Not Started",

      approval_status:
        "Pending",

      down_payment_required:
        true,

      customer_approval_required:
        true,

      down_payment_status:
        "Pending",

      balance_status:
        "Pending",

      material_status:
        "Not Started",

      materials_ordered:
        false,

      materials_received:
        false,

      fabrication_status:
        "Not Started",

      test_fit_status:
        "Not Started",

      finish_type: "",

      finish_status:
        "Not Started",

      ready_for_install:
        false,

      install_status:
        "Not Started",

      final_inspection_status:
        "Not Started",

      next_action: "",
      percent_complete: 0,

      notes: "",
    });

  useEffect(() => {
    loadCustomers();
    loadProfiles();
  }, []);

  async function loadCustomers() {
    const {
      data,
      error,
    } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Customer load error:",
        error
      );

      return;
    }

    setCustomers(data || []);
  }

  async function loadProfiles() {
    try {
      const data =
        await getActiveProfiles();

      setProfiles(data || []);
    } catch (error) {
      console.error(
        "Profile load error:",
        error
      );

      notifications.show({
        title:
          "Employee Profiles",

        message:
          "Assignment options could not be loaded.",

        color: "orange",
      });
    }
  }

  function updateField(
    field,
    value
  ) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function prepareProjectIntake() {
    setPreparingIntake(true);
    try {
      const fileText = intakeFile ? await readIntakeFile(intakeFile) : "";
      const source = [intakeText, fileText].filter(Boolean).join("\n\n");
      if (!source.trim()) throw new Error("Paste a project write-up or choose a supported document first.");
      const draft = prepareIntakeDraft(source);
      const matchedCustomer = findMatchingCustomer(customers, draft);
      setIntakeDraft(draft);
      setIntakeChecklist(draft.checklist);
      setIntakeQuoteItems(draft.quoteItems);
      setFormData((current) => ({
        ...current,
        project_name: draft.projectName || current.project_name,
        customer_id: matchedCustomer ? String(matchedCustomer.id) : current.customer_id,
        contact_name: matchedCustomer
          ? (matchedCustomer.company_name || `${matchedCustomer.first_name || ""} ${matchedCustomer.last_name || ""}`.trim())
          : (draft.customerName || current.contact_name),
        contact_phone: matchedCustomer?.phone || draft.phone || current.contact_phone,
        job_address: matchedCustomer?.address || draft.address || current.job_address,
        city: matchedCustomer?.city || current.city,
        state: matchedCustomer?.state || current.state,
        zip_code: matchedCustomer?.zip || current.zip_code,
        assigned_to: draft.assignedTo || current.assigned_to,
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) ? draft.dueDate : current.due_date,
        notes: draft.sourceText,
      }));
      setIntakeMatchMessage(matchedCustomer
        ? `Matched existing customer: ${matchedCustomer.company_name || `${matchedCustomer.first_name || ""} ${matchedCustomer.last_name || ""}`.trim()}`
        : draft.customerName
          ? `No existing customer match found for ${draft.customerName}. Review the customer before saving.`
          : "No customer name was detected. Select the customer before saving.");
      if (!projectPath) applyProjectPreset("Site Visit / Estimate");
      if (draft.materials.length) setMaterialRequests(draft.materials.map((item) => ({ ...createBlankMaterialRequest(), item })));
      notifications.show({ title: "Project Draft Prepared", message: "Review every field, quote item, material, and checklist item before creating the project.", color: "blue" });
    } catch (error) {
      notifications.show({ title: "Intake Could Not Be Prepared", message: error.message, color: "red" });
    } finally { setPreparingIntake(false); }
  }

  function updateMaterialRequest(
    localId,
    field,
    value
  ) {
    setMaterialRequests(
      (current) =>
        current.map(
          (request) =>
            request.local_id ===
            localId
              ? {
                  ...request,
                  [field]: value,
                }
              : request
        )
    );
  }

  function addMaterialRequest() {
    setMaterialRequests(
      (current) => [
        ...current,
        createBlankMaterialRequest(),
      ]
    );
  }

  function removeMaterialRequest(
    localId
  ) {
    setMaterialRequests(
      (current) => {
        if (
          current.length === 1
        ) {
          return [
            createBlankMaterialRequest(),
          ];
        }

        return current.filter(
          (request) =>
            request.local_id !==
            localId
        );
      }
    );
  }

  function applyProjectPreset(
    value
  ) {
    setProjectPath(value);

    const presets = {
      "Site Visit / Estimate": {
        customer_approval_required: true,
        project_category: "Estimate / Site Visit",
        work_location: "Field",
        site_visit_required: true,
        measurements_required: true,
        quote_required: true,
        fabrication_required: false,
        test_fit_required: false,
        finish_required: false,
        install_required: false,
        quote_status: "Not Started",
        approval_status: "Pending",
        down_payment_required: false,
        down_payment_status: "Not Required",
        balance_status: "Not Required",
        material_status: "Not Needed",
        materials_ordered: false,
        materials_received: false,
        fabrication_status: "Not Required",
        test_fit_status: "Not Required",
        finish_status: "Not Required",
        ready_for_install: false,
        install_status: "Not Required",
        final_inspection_status: "Not Required",
        next_action: "Schedule Chad site visit",
        assigned_to: "Chad",
        percent_complete: 0,
      },
      "Field Fabrication Project":
        {
          customer_approval_required:
            true,

          project_category:
            "Field Fabrication",

          work_location:
            "Field + Shop",

          site_visit_required:
            true,

          measurements_required:
            true,

          quote_required:
            true,

          fabrication_required:
            true,

          test_fit_required:
            true,

          finish_required:
            true,

          install_required:
            true,

          quote_status:
            "Not Started",

          approval_status:
            "Pending",

          down_payment_required:
            true,

          down_payment_status:
            "Pending",

          balance_status:
            "Pending",

          material_status:
            "Not Started",

          materials_ordered:
            false,

          materials_received:
            false,

          fabrication_status:
            "Not Started",

          test_fit_status:
            "Not Started",

          finish_status:
            "Not Started",

          ready_for_install:
            false,

          install_status:
            "Not Started",

          final_inspection_status:
            "Not Started",

          next_action:
            "Site Visit / Measurements",

          percent_complete: 0,
        },

      "Shop Fabrication / Repair":
        {
          customer_approval_required:
            true,

          project_category:
            "Shop Fabrication",

          work_location:
            "Inside Shop",

          site_visit_required:
            false,

          measurements_required:
            false,

          quote_required:
            true,

          fabrication_required:
            true,

          test_fit_required:
            false,

          finish_required:
            false,

          install_required:
            false,

          quote_status:
            "Not Started",

          approval_status:
            "Pending",

          down_payment_required:
            false,

          down_payment_status:
            "Not Required",

          balance_status:
            "Pending",

          material_status:
            "Not Needed",

          materials_ordered:
            false,

          materials_received:
            false,

          fabrication_status:
            "Not Started",

          test_fit_status:
            "Not Required",

          finish_type: "",

          finish_status:
            "Not Required",

          ready_for_install:
            false,

          install_status:
            "Not Required",

          final_inspection_status:
            "Not Required",

          next_action:
            "Review / Quote",

          percent_complete: 0,
        },

      "General Project": {
        customer_approval_required:
          true,

        project_category:
          "General",

        work_location:
          "Inside Shop",

        site_visit_required:
          false,

        measurements_required:
          false,

        quote_required:
          true,

        fabrication_required:
          false,

        test_fit_required:
          false,

        finish_required:
          false,

        install_required:
          false,

        quote_status:
          "Not Started",

        approval_status:
          "Pending",

        down_payment_required:
          false,

        down_payment_status:
          "Not Required",

        balance_status:
          "Pending",

        material_status:
          "Not Needed",

        materials_ordered:
          false,

        materials_received:
          false,

        fabrication_status:
          "Not Required",

        test_fit_status:
          "Not Required",

        finish_type: "",

        finish_status:
          "Not Required",

        ready_for_install:
          false,

        install_status:
          "Not Required",

        final_inspection_status:
          "Not Required",

        next_action:
          "Review Project",

        percent_complete: 0,
      },
    };

    if (
      !value ||
      !presets[value]
    ) {
      return;
    }

    setFormData(
      (current) => ({
        ...current,
        ...presets[value],
      })
    );
  }

  async function saveProject() {
    if (
      !formData.project_name.trim()
    ) {
      notifications.show({
        title:
          "Missing Project Name",

        message:
          "Enter a project name before saving.",

        color: "red",
      });

      return;
    }

    if (!projectPath) {
      notifications.show({
        title:
          "Missing Project Path",

        message:
          "Choose a Quick Setup project path.",

        color: "red",
      });

      return;
    }

    if (
      formData.is_quick_turnaround &&
      !formData.quick_turnaround_required_by
    ) {
      notifications.show({
        title: "Missing Required Completion Time",
        message: "Quick Turnaround projects require a promised completion date and time.",
        color: "red",
      });

      return;
    }

    const requestsToCreate =
      materialRequests.filter(
        hasMaterialRequestData
      );

    const invalidMaterialRequest =
      requestsToCreate.find(
        (request) =>
          !String(
            request.item || ""
          ).trim()
      );

    if (
      invalidMaterialRequest
    ) {
      notifications.show({
        title:
          "Missing Material Item",

        message:
          "Each material request must include an Item name.",

        color: "red",
      });

      return;
    }

    setSaving(true);

    try {
      const projectNumber =
        await generateNumber(
          "Project"
        );

      const hasMaterialRequests =
        requestsToCreate.length >
        0;

      const payload = {
        ...formData,

        project_number:
          projectNumber,

        customer_id:
          formData.customer_id
            ? Number(
                formData.customer_id
              )
            : null,

        site_visit_date:
          formData.site_visit_date ||
          null,

        install_date:
          formData.install_date ||
          null,

        due_date:
          normalizeDateValue(formData.due_date),

        planned_start_date:
          normalizeDateValue(formData.planned_start_date),

        planned_duration_days:
          formData.planned_duration_days
            ? Number(formData.planned_duration_days)
            : null,

        material_status:
          hasMaterialRequests &&
          formData.material_status ===
            "Not Needed"
            ? "Not Started"
            : formData.material_status,

        materials_ordered:
          hasMaterialRequests
            ? false
            : formData.materials_ordered,

        materials_received:
          hasMaterialRequests
            ? false
            : formData.materials_received,

        is_active: true,
      };

      const {
        data: createdProject,
        error,
      } = await supabase
        .from("projects")
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      let quickCommitmentCreated =
        false;

      if (
        formData.is_quick_turnaround
      ) {
        try {
          const customerName =
            customers.find(
              (customer) =>
                String(customer.id) ===
                String(formData.customer_id)
            )?.company_name ||
            customers.find(
              (customer) =>
                String(customer.id) ===
                String(formData.customer_id)
            )?.customer_name ||
            customers.find(
              (customer) =>
                String(customer.id) ===
                String(formData.customer_id)
            )?.name ||
            formData.contact_name ||
            null;

          const {
            error:
              quickCommitmentError,
          } = await supabase.rpc(
            "mw_save_quick_turnaround_commitment",
            {
              p_id: null,
              p_source_type:
                "Project",
              p_source_id: null,
              p_source_number:
                createdProject.project_number ||
                projectNumber,
              p_title:
                createdProject.project_name,
              p_customer_name:
                customerName,
              p_description:
                createdProject.next_action ||
                createdProject.notes ||
                null,
              p_priority:
                formData.quick_turnaround_priority,
              p_status: "Open",
              p_required_by:
                formData.quick_turnaround_required_by,
              p_assigned_to:
                createdProject.assigned_to ||
                null,
              p_department:
                null,
              p_materials_required:
                hasMaterialRequests,
              p_materials_status:
                hasMaterialRequests
                  ? "Needs Pricing"
                  : "Not Required",
              p_reason:
                formData.quick_turnaround_reason ||
                null,
              p_notes:
                "Automatically created from Outside Fabrication New Project.",
              p_created_by:
                formData.intake_owner ||
                formData.assigned_to ||
                null,
            }
          );

          if (
            quickCommitmentError
          ) {
            throw quickCommitmentError;
          }

          quickCommitmentCreated =
            true;
        } catch (
          quickCommitmentError
        ) {
          console.error(
            "Quick commitment creation error:",
            quickCommitmentError
          );

          notifications.show({
            title: "Project Created — Quick Commitment Needs Attention",
            message: `${projectNumber} was created, but it could not be added to Today's Commitments. ${
              quickCommitmentError.message ||
              ""
            }`.trim(),
            color: "orange",
            autoClose: 9000,
          });
        }
      }

      let assignmentNotificationCreated =
        false;

      if (
        createdProject?.assigned_to
      ) {
        try {
          const notification =
            await createNotificationForAssignedName(
              {
                assignedTo:
                  createdProject.assigned_to,

                notificationType:
                  "Project Assignment",

                title:
                  "New Project Assigned",

                message: `${
                  createdProject.project_number ||
                  projectNumber
                } • ${
                  createdProject.project_name ||
                  "New project"
                }${
                  createdProject.next_action
                    ? ` • Next: ${createdProject.next_action}`
                    : ""
                }`,

                sourceType:
                  "project",

                sourceId:
                  createdProject.id,

                targetPage:
                  "projects",

                priority:
                  createdProject.priority ===
                    "Rush" ||
                  createdProject.priority ===
                    "High"
                    ? "High"
                    : "Medium",
              }
            );

          assignmentNotificationCreated =
            Boolean(
              notification
            );
        } catch (
          notificationError
        ) {
          console.error(
            "Project assignment notification error:",
            notificationError
          );

          notifications.show({
            title:
              "Project Created",

            message:
              "The project was created, but the assignment notification could not be created.",

            color: "orange",
          });
        }
      }

      let procurementCreated =
        false;

      if (
        requestsToCreate.length >
        0
      ) {
        try {
          await createProjectMaterialRequests(
            {
              project:
                createdProject,

              requests:
                requestsToCreate,

              requestedBy:
                formData.intake_owner ||
                formData.assigned_to ||
                "",
            }
          );

          procurementCreated =
            true;
        } catch (
          materialError
        ) {
          console.error(
            "Material request creation error:",
            materialError
          );

          notifications.show({
            title:
              "Project Created — Procurement Needs Attention",

            message: `${projectNumber} was created, but one or more material requests could not be saved. ${
              materialError.message ||
              ""
            }`.trim(),

            color: "orange",

            autoClose: 9000,
          });

          setPage("projects");

          return;
        }
      }

      if (intakeChecklist.length > 0) {
        const { error: checklistError } = await supabase.from("project_checklist_items").insert(intakeChecklist.map((task, index) => ({ project_id: createdProject.id, phase: "Imported Intake", task_title: task, sort_order: index + 1, assigned_to: createdProject.assigned_to || null, priority: "Normal", status: "Not Started", notes: "Prepared from the reviewed project intake write-up." })));
        if (checklistError) throw checklistError;
      }

      if (intakeQuoteItems.length > 0) {
        const subtotal = intakeQuoteItems.reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.unit_price || 0), 0);
        const quoteNumber = await generateNumber("Quote");
        const customer = customers.find((item) => String(item.id) === String(formData.customer_id));
        const { data: createdQuote, error: quoteError } = await supabase.from("project_quotes").insert({ quote_number: quoteNumber, project_id: createdProject.id, quote_title: `${createdProject.project_name} Quote`, customer_id: createdProject.customer_id, customer_name: customer?.company_name || customer?.customer_name || intakeDraft?.customerName || formData.contact_name || null, project_name: createdProject.project_name, assigned_to: createdProject.assigned_to, scope_of_work: intakeDraft?.sourceText || createdProject.notes, subtotal, tax_rate: 0.07, tax_amount: subtotal * 0.07, total_amount: subtotal * 1.07, status: "Draft", quote_type: "Project Quote", quote_layout: "Detailed Fabrication" }).select().single();
        if (quoteError) throw quoteError;
        const { error: itemError } = await supabase.from("project_quote_items").insert(intakeQuoteItems.map((item, index) => ({ quote_id: createdQuote.id, item_type: "Base", title: item.title, description: "Prepared from the reviewed project intake write-up.", quantity: item.quantity || 1, unit_price: item.unit_price || 0, line_total: Number(item.quantity || 1) * Number(item.unit_price || 0), sort_order: index + 1, show_on_pdf: true })));
        if (itemError) throw itemError;
      }

      let successMessage =
        `${projectNumber} was created successfully.`;

      if (
        assignmentNotificationCreated &&
        procurementCreated
      ) {
        successMessage =
          `${projectNumber} was created, ${createdProject.assigned_to} was notified, and ${requestsToCreate.length} material request${
            requestsToCreate.length ===
            1
              ? ""
              : "s"
          } were sent to Procurement.`;
      } else if (
        assignmentNotificationCreated
      ) {
        successMessage =
          `${projectNumber} was created and ${createdProject.assigned_to} was notified.`;
      } else if (
        procurementCreated
      ) {
        successMessage =
          `${projectNumber} was created and ${requestsToCreate.length} material request${
            requestsToCreate.length ===
            1
              ? ""
              : "s"
          } were sent to Procurement.`;
      }

      if (
        quickCommitmentCreated
      ) {
        successMessage +=
          " It was also added to Today's Commitments.";
      }

      notifications.show({
        title:
          "Project Created",

        message:
          successMessage,

        color:
          "green",
      });

      setPage("projects");
    } catch (error) {
      console.error(error);

      notifications.show({
        title:
          "Project Save Failed",

        message:
          error.message ||
          "Unable to create project.",

        color:
          "red",
      });
    } finally {
      setSaving(false);
    }
  }

  const customerOptions =
    customers.map(
      (customer) => ({
        value:
          String(customer.id),

        label:
          customer.company_name ||
          `${
            customer.first_name ||
            ""
          } ${
            customer.last_name ||
            ""
          }`.trim() ||
          "Unnamed Customer",
      })
    );

  const personOptions =
    profiles
      .filter(
        (profile) =>
          profile.profile_type ===
          "Person"
      )
      .map(
        (profile) =>
          profile.display_name
      )
      .filter(Boolean);

  const teamOptions =
    profiles
      .filter(
        (profile) =>
          profile.profile_type !==
          "Person"
      )
      .map(
        (profile) =>
          profile.display_name
      )
      .filter(Boolean);

  const assignmentOptions =
    Array.from(
      new Set([
        ...personOptions,
        ...teamOptions,
      ])
    );

  return (
    <>
      <MWPageHeader
        title="New Project"
        subtitle="Create field fabrication work, shop fabrication, repairs, installs, and other Metal Worx projects."
        setPage={setPage}
        showBack={true}
        backPage="projects"
        backLabel="Projects"
        showDashboard={true}
      />

      <SimpleGrid
        cols={{
          base: 1,
          lg: 2,
        }}
        spacing="lg"
      >
        <MWSection title="Paste to Organize">
          <Stack>
            <Alert color="blue" title="Turn the customer request into a project draft">Paste an email or project write-up, or upload PDF, Word, Excel, text, CSV, or Markdown. Metal Worx OS organizes the customer, scope, dates, pricing, materials, and checklist for review before anything is saved.</Alert>
            <FileInput label="Project document" placeholder="Choose PDF, DOCX, XLSX, XLS, TXT, CSV, or MD" accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.md" value={intakeFile} onChange={setIntakeFile} clearable />
            <Textarea label="Project write-up" placeholder="Paste the customer request, scope, tasks, materials, pricing, dates, and project lead here…" minRows={7} autosize value={intakeText} onChange={(event) => setIntakeText(event.currentTarget.value)} />
            <Button color="red" loading={preparingIntake} onClick={prepareProjectIntake}>Paste to Organize</Button>
            {intakeMatchMessage && <Alert color={intakeMatchMessage.startsWith("Matched") ? "green" : "orange"}>{intakeMatchMessage}</Alert>}
            {intakeDraft && <Alert color="green" title="Draft prepared"><Text size="sm">Project: {intakeDraft.projectName || "Review required"}</Text><Text size="sm">Checklist items: {intakeChecklist.length} · Quote items: {intakeQuoteItems.length} · Materials: {intakeDraft.materials.length}</Text><Text size="xs" c="dimmed" mt="xs">Review and edit the regular project fields below before saving.</Text></Alert>}
          </Stack>
        </MWSection>
        <MWSection title="Project Intake">
          <Stack>
            <Select
              label="Quick Setup"
              placeholder="Choose a project path"
              data={[
                "Site Visit / Estimate",
                "Field Fabrication Project",
                "Shop Fabrication / Repair",
                "General Project",
              ]}
              value={
                projectPath
              }
              onChange={
                applyProjectPreset
              }
            />

            <TextInput
              label="Project Name"
              placeholder="Example: Smith Front Porch Railing"
              value={
                formData.project_name
              }
              onChange={(
                event
              ) =>
                updateField(
                  "project_name",
                  event.currentTarget
                    .value
                )
              }
            />

            <Select
              label="Customer"
              placeholder="Select customer"
              searchable
              clearable
              data={
                customerOptions
              }
              value={
                formData.customer_id
              }
              onChange={(
                value
              ) =>
                updateField(
                  "customer_id",
                  value
                )
              }
            />

            <Group grow>
              <Select
                label="Project Type"
                data={[
                  "Railing",
                  "Fence",
                  "Gate",
                  "Stairs",
                  "Structural Fabrication",
                  "Install",
                  "Field Repair",
                  "Shop Repair",
                  "Vehicle Part",
                  "Powder Coat",
                  "Custom Fabrication",
                  "Metal Art",
                  "Other",
                ]}
                value={
                  formData.project_type
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "project_type",
                    value
                  )
                }
              />

              <Select
                label="Priority"
                data={[
                  "Low",
                  "Normal",
                  "High",
                  "Rush",
                ]}
                value={
                  formData.priority
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "priority",
                    value
                  )
                }
              />
            </Group>

            <Group grow>
              <Select
                label="Intake Owner"
                placeholder="Who took in the job?"
                data={
                  personOptions
                }
                value={
                  formData.intake_owner ||
                  null
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "intake_owner",
                    value || ""
                  )
                }
                searchable
                clearable
              />

              <Select
                label="Work Location"
                data={[
                  "Inside Shop",
                  "Field",
                  "Field + Shop",
                ]}
                value={
                  formData.work_location
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "work_location",
                    value
                  )
                }
              />
            </Group>

            <Select
              label="Assigned To"
              placeholder="Person or team responsible"
              data={
                assignmentOptions
              }
              value={
                formData.assigned_to ||
                null
              }
              onChange={(
                value
              ) =>
                updateField(
                  "assigned_to",
                  value || ""
                )
              }
              searchable
              clearable
            />

            <TextInput
              label="Next Action"
              placeholder="Example: Schedule site visit"
              value={
                formData.next_action
              }
              onChange={(
                event
              ) =>
                updateField(
                  "next_action",
                  event.currentTarget
                    .value
                )
              }
            />
          </Stack>
        </MWSection>

        <MWSection title="Contact & Site">
          <Stack>
            <Group grow>
              <TextInput
                label="Contact Name"
                value={
                  formData.contact_name
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "contact_name",
                    event.currentTarget
                      .value
                  )
                }
              />

              <TextInput
                label="Contact Phone"
                value={
                  formData.contact_phone
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "contact_phone",
                    event.currentTarget
                      .value
                  )
                }
              />
            </Group>

            <TextInput
              label="Job Address"
              value={
                formData.job_address
              }
              onChange={(
                event
              ) =>
                updateField(
                  "job_address",
                  event.currentTarget
                    .value
                )
              }
            />

            <Group grow>
              <TextInput
                label="City"
                value={
                  formData.city
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "city",
                    event.currentTarget
                      .value
                  )
                }
              />

              <TextInput
                label="State"
                value={
                  formData.state
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "state",
                    event.currentTarget
                      .value
                  )
                }
              />

              <TextInput
                label="ZIP"
                value={
                  formData.zip_code
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "zip_code",
                    event.currentTarget
                      .value
                  )
                }
              />
            </Group>

            <Group grow>
              <DateInput
                label="Site Visit Date"
                value={
                  formData.site_visit_date
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "site_visit_date",
                    value
                  )
                }
              />

              <DateInput
                label="Due Date"
                value={
                  formData.due_date
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "due_date",
                    value
                  )
                }
              />
            </Group>

            <DateInput
              label="Install Date"
              value={
                formData.install_date
              }
              onChange={(
                value
              ) =>
                updateField(
                  "install_date",
                  value
                )
              }
            />

            <Group grow align="flex-start">
              <DateInput
                label="Planned Shop Start"
                description="Places this project on the capacity calendar"
                value={formData.planned_start_date}
                onChange={(value) => updateField("planned_start_date", value)}
                clearable
              />
              <NumberInput
                label="Estimated Workdays"
                description="How many working days it should occupy"
                min={1}
                max={365}
                value={formData.planned_duration_days || ""}
                onChange={(value) => updateField("planned_duration_days", value)}
              />
            </Group>
          </Stack>
        </MWSection>

        <MWSection title="Quick Turnaround">
          <Stack gap="md">
            <Switch
              label="Mark as Quick Turnaround"
              description="Use only for unusually urgent work that needs high visibility beyond the normal site-visit and install schedule."
              checked={
                formData.is_quick_turnaround
              }
              onChange={(
                event
              ) =>
                updateField(
                  "is_quick_turnaround",
                  event.currentTarget
                    .checked
                )
              }
              color="red"
              size="md"
            />

            {formData.is_quick_turnaround && (
              <Paper
                p="lg"
                radius="md"
                style={{
                  background:
                    "rgba(111, 0, 0, 0.14)",
                  border:
                    "1px solid rgba(224, 49, 49, 0.32)",
                }}
              >
                <Stack gap="md">
                  <Text fw={800}>
                    Today's Commitments Details
                  </Text>

                  <SimpleGrid
                    cols={{
                      base: 1,
                      sm: 2,
                    }}
                    spacing="md"
                  >
                    <DateTimePicker
                      label="Required Completion Date & Time"
                      description="The actual promise Metal Worx must meet"
                      value={
                        formData.quick_turnaround_required_by
                      }
                      onChange={(
                        value
                      ) =>
                        updateField(
                          "quick_turnaround_required_by",
                          value
                        )
                      }
                      required
                      minDate={
                        new Date()
                      }
                    />

                    <Select
                      label="Quick Turnaround Priority"
                      data={[
                        "Critical",
                        "Urgent",
                        "High",
                      ]}
                      value={
                        formData.quick_turnaround_priority
                      }
                      onChange={(
                        value
                      ) =>
                        updateField(
                          "quick_turnaround_priority",
                          value ||
                            "Urgent"
                        )
                      }
                      required
                    />
                  </SimpleGrid>

                  <Textarea
                    label="Reason for Quick Turnaround"
                    description="Explain why this project needs priority attention"
                    placeholder="Example: Emergency railing repair required before customer inspection"
                    value={
                      formData.quick_turnaround_reason
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "quick_turnaround_reason",
                        event.currentTarget
                          .value
                      )
                    }
                    autosize
                    minRows={2}
                    maxRows={4}
                  />

                  <Text
                    size="sm"
                    c="dimmed"
                  >
                    This creates one linked Project commitment. Normal site visits and installs stay on their existing dashboards and will not be duplicated.
                  </Text>
                </Stack>
              </Paper>
            )}
          </Stack>
        </MWSection>

        <MWSection title="Workflow Requirements">
          <Stack>
            <Switch
              label="Site Visit Required"
              checked={
                formData.site_visit_required
              }
              onChange={(
                event
              ) =>
                updateField(
                  "site_visit_required",
                  event.currentTarget
                    .checked
                )
              }
            />

            <Switch
              label="Measurements Required"
              checked={
                formData.measurements_required
              }
              onChange={(
                event
              ) =>
                updateField(
                  "measurements_required",
                  event.currentTarget
                    .checked
                )
              }
            />

            <Switch
              label="Quote Required"
              checked={
                formData.quote_required
              }
              onChange={(
                event
              ) =>
                updateField(
                  "quote_required",
                  event.currentTarget
                    .checked
                )
              }
            />

            <Switch
              label="Down Payment Required"
              checked={
                formData.down_payment_required
              }
              onChange={(
                event
              ) =>
                updateField(
                  "down_payment_required",
                  event.currentTarget
                    .checked
                )
              }
            />

            <Paper
              withBorder
              radius="md"
              p="md"
            >
              <Stack gap="xs">
                <Switch
                  label="Customer Approval Required"
                  checked={
                    formData.customer_approval_required
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "customer_approval_required",
                      event.currentTarget
                        .checked
                    )
                  }
                />

                <Text
                  size="sm"
                  c="dimmed"
                >
                  {formData.customer_approval_required
                    ? "Lori will price the materials. Chad or Kory must then send the quote and record customer approval before Lori can order."
                    : "The customer already approved the work. After Lori finishes pricing, the material request moves directly to Ready to Order."}
                </Text>
              </Stack>
            </Paper>

            <Switch
              label="Fabrication Required"
              checked={
                formData.fabrication_required
              }
              onChange={(
                event
              ) =>
                updateField(
                  "fabrication_required",
                  event.currentTarget
                    .checked
                )
              }
            />

            <Switch
              label="Test Fit Required"
              checked={
                formData.test_fit_required
              }
              onChange={(
                event
              ) =>
                updateField(
                  "test_fit_required",
                  event.currentTarget
                    .checked
                )
              }
            />

            <Switch
              label="Paint / Powder Coat Required"
              checked={
                formData.finish_required
              }
              onChange={(
                event
              ) =>
                updateField(
                  "finish_required",
                  event.currentTarget
                    .checked
                )
              }
            />

            {formData.finish_required && (
              <Select
                label="Finish Type"
                placeholder="Select finish"
                clearable
                data={[
                  "Paint",
                  "Powder Coat",
                  "Patina",
                  "Raw Steel",
                  "Galvanized",
                  "Other",
                ]}
                value={
                  formData.finish_type ||
                  null
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "finish_type",
                    value || ""
                  )
                }
              />
            )}

            <Switch
              label="Install Required"
              checked={
                formData.install_required
              }
              onChange={(
                event
              ) =>
                updateField(
                  "install_required",
                  event.currentTarget
                    .checked
                )
              }
            />
          </Stack>
        </MWSection>

        <Paper withBorder p="md" radius="lg">
          <Group justify="space-between" align="center">
            <div><Text fw={900}>Advanced Status Setup</Text><Text size="sm" c="dimmed">New projects start at the correct stage automatically. Open this only when importing work already underway.</Text></div>
            <Button variant="light" color="gray" onClick={() => setShowAdvancedWorkflow((value) => !value)}>{showAdvancedWorkflow ? "Hide Advanced Status" : "Set Existing Status"}</Button>
          </Group>
        </Paper>

        {showAdvancedWorkflow && <MWSection title="Project Workflow Status">
          <Stack>
            <Group grow>
              <Select
                label="Quote Status"
                data={[
                  "Not Required",
                  "Not Started",
                  "In Progress",
                  "Sent",
                  "Approved",
                  "Declined",
                ]}
                value={
                  formData.quote_status
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "quote_status",
                    value
                  )
                }
              />

              <Select
                label="Approval Status"
                data={[
                  "Pending",
                  "Approved",
                  "Declined",
                  "On Hold",
                ]}
                value={
                  formData.approval_status
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "approval_status",
                    value
                  )
                }
              />
            </Group>

            <Group grow>
              <Select
                label="Down Payment Status"
                data={[
                  "Not Required",
                  "Pending",
                  "Received",
                  "Past Due",
                ]}
                value={
                  formData.down_payment_status
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "down_payment_status",
                    value
                  )
                }
              />

              <Select
                label="Balance Status"
                data={[
                  "Not Required",
                  "Pending",
                  "Due",
                  "Paid",
                  "Past Due",
                ]}
                value={
                  formData.balance_status
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "balance_status",
                    value
                  )
                }
              />
            </Group>

            <Select
              label="Material Status"
              data={[
                "Not Needed",
                "Not Started",
                "Pricing Needed",
                "Ready to Order",
                "Ordered",
                "Partially Received",
                "Received",
              ]}
              value={
                formData.material_status
              }
              onChange={(
                value
              ) =>
                updateField(
                  "material_status",
                  value
                )
              }
            />

            <Group grow>
              <Switch
                label="Materials Ordered"
                checked={
                  formData.materials_ordered
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "materials_ordered",
                    event.currentTarget
                      .checked
                  )
                }
              />

              <Switch
                label="Materials Received"
                checked={
                  formData.materials_received
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "materials_received",
                    event.currentTarget
                      .checked
                  )
                }
              />
            </Group>

            <Select
              label="Fabrication Status"
              data={[
                "Not Required",
                "Not Started",
                "Ready",
                "In Progress",
                "On Hold",
                "Completed",
              ]}
              value={
                formData.fabrication_status
              }
              onChange={(
                value
              ) =>
                updateField(
                  "fabrication_status",
                  value
                )
              }
            />

            <Select
              label="Test Fit Status"
              data={[
                "Not Required",
                "Not Started",
                "Scheduled",
                "In Progress",
                "Adjustments Needed",
                "Completed",
              ]}
              value={
                formData.test_fit_status
              }
              onChange={(
                value
              ) =>
                updateField(
                  "test_fit_status",
                  value
                )
              }
            />

            <Select
              label="Finish Status"
              data={[
                "Not Required",
                "Not Started",
                "Ready",
                "At Powder Coat",
                "In Progress",
                "Completed",
              ]}
              value={
                formData.finish_status
              }
              onChange={(
                value
              ) =>
                updateField(
                  "finish_status",
                  value
                )
              }
            />

            <Select
              label="Install Status"
              data={[
                "Not Required",
                "Not Started",
                "Ready to Schedule",
                "Scheduled",
                "In Progress",
                "Completed",
              ]}
              value={
                formData.install_status
              }
              onChange={(
                value
              ) =>
                updateField(
                  "install_status",
                  value
                )
              }
            />

            <Switch
              label="Ready for Install"
              checked={
                formData.ready_for_install
              }
              onChange={(
                event
              ) =>
                updateField(
                  "ready_for_install",
                  event.currentTarget
                    .checked
                )
              }
            />
          </Stack>
        </MWSection>}

        <div
          style={{
            gridColumn:
              "1 / -1",
          }}
        >
          <MWSection title="Materials / Procurement">
            <Stack gap="md">
              <div>
                <Text fw={600}>
                  Material Requests
                </Text>

                <Text
                  size="sm"
                  c="dimmed"
                >
                  Add each material,
                  hardware, vendor item,
                  outside service, or
                  supply needed for this
                  project. Completed
                  lines will be sent to
                  the Procurement queue
                  when the project is
                  saved.
                </Text>
              </div>

              {materialRequests.map(
                (
                  request,
                  index
                ) => (
                  <Paper
                    key={
                      request.local_id
                    }
                    withBorder
                    radius="md"
                    p="md"
                  >
                    <Stack gap="sm">
                      <Group
                        justify="space-between"
                        align="center"
                      >
                        <Text fw={600}>
                          Material Request{" "}
                          {index + 1}
                        </Text>

                        <ActionIcon
                          variant="light"
                          color="red"
                          aria-label={`Remove material request ${
                            index + 1
                          }`}
                          onClick={() =>
                            removeMaterialRequest(
                              request.local_id
                            )
                          }
                        >
                          ×
                        </ActionIcon>
                      </Group>

                      <SimpleGrid
                        cols={{
                          base: 1,
                          sm: 2,
                          lg: 4,
                        }}
                        spacing="sm"
                      >
                        <NumberInput
                          label="Qty"
                          min={0.01}
                          decimalScale={
                            2
                          }
                          allowNegative={
                            false
                          }
                          value={
                            request.qty
                          }
                          onChange={(
                            value
                          ) =>
                            updateMaterialRequest(
                              request.local_id,
                              "qty",
                              value
                            )
                          }
                        />

                        <TextInput
                          label="Dimensions"
                          placeholder='Example: 2" x 2" x 1/8" x 20 ft'
                          value={
                            request.dimensions
                          }
                          onChange={(
                            event
                          ) =>
                            updateMaterialRequest(
                              request.local_id,
                              "dimensions",
                              event
                                .currentTarget
                                .value
                            )
                          }
                        />

                        <TextInput
                          label="Item"
                          placeholder="Example: Square Tube"
                          value={
                            request.item
                          }
                          onChange={(
                            event
                          ) =>
                            updateMaterialRequest(
                              request.local_id,
                              "item",
                              event
                                .currentTarget
                                .value
                            )
                          }
                        />

                        <TextInput
                          label="Vendor"
                          description="Optional"
                          placeholder="Preferred vendor"
                          value={
                            request.vendor
                          }
                          onChange={(
                            event
                          ) =>
                            updateMaterialRequest(
                              request.local_id,
                              "vendor",
                              event
                                .currentTarget
                                .value
                            )
                          }
                        />
                      </SimpleGrid>

                      <SimpleGrid
                        cols={{
                          base: 1,
                          sm: 2,
                          lg: 4,
                        }}
                        spacing="sm"
                      >
                        <div
                          style={{
                            gridColumn:
                              "span 2",
                          }}
                        >
                          <Textarea
                            label="Description"
                            placeholder="Grade, finish, color, part number, special instructions, or other purchasing details..."
                            minRows={2}
                            autosize
                            value={
                              request.description
                            }
                            onChange={(
                              event
                            ) =>
                              updateMaterialRequest(
                                request.local_id,
                                "description",
                                event
                                  .currentTarget
                                  .value
                              )
                            }
                          />
                        </div>

                        <DateInput
                          label="Needed By"
                          clearable
                          value={
                            request.needed_by
                          }
                          onChange={(
                            value
                          ) =>
                            updateMaterialRequest(
                              request.local_id,
                              "needed_by",
                              value
                            )
                          }
                        />

                        <Select
                          label="Priority"
                          data={[
                            "Low",
                            "Normal",
                            "High",
                            "Rush",
                          ]}
                          value={
                            request.priority
                          }
                          onChange={(
                            value
                          ) =>
                            updateMaterialRequest(
                              request.local_id,
                              "priority",
                              value ||
                                "Normal"
                            )
                          }
                        />
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                )
              )}

              <Divider />

              <Group justify="space-between">
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Blank material lines
                  are ignored when the
                  project is saved.
                </Text>

                <Button
                  variant="light"
                  color="red"
                  onClick={
                    addMaterialRequest
                  }
                >
                  + Add Material
                </Button>
              </Group>
            </Stack>
          </MWSection>
        </div>

        <MWSection title="Project Notes">
          <Stack>
            <Textarea
              label="Notes"
              minRows={10}
              placeholder="Customer requests, measurements, material information, fabrication notes, test fit notes, install details, questions, and other project information..."
              value={
                formData.notes
              }
              onChange={(
                event
              ) =>
                updateField(
                  "notes",
                  event.currentTarget
                    .value
                )
              }
            />

            <Group justify="flex-end">
              <Button
                variant="light"
                color="gray"
                onClick={() =>
                  setPage(
                    "projects"
                  )
                }
              >
                Cancel
              </Button>

              <Button
                color="red"
                loading={
                  saving
                }
                onClick={
                  saveProject
                }
              >
                Save Project
              </Button>
            </Group>
          </Stack>
        </MWSection>
      </SimpleGrid>
    </>
  );
}

export default NewProject;
