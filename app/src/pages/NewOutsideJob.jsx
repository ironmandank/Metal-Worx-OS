import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { supabase } from "../lib/supabase";
import { generateNumber } from "../lib/generateNumber";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return value;
}

function customerLabel(customer) {
  return customer.company_name || customer.contact_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    `Customer ${customer.id}`;
}

export default function NewOutsideJob({ setPage, setSelectedProject }) {
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    project_name: "",
    customer_id: null,
    project_type: "Other Project",
    status: "New",
    priority: "Normal",
    assigned_to: "",
    job_address: "",
    city: "",
    state: "NC",
    zip_code: "",
    planned_start_date: null,
    due_date: null,
    notes: "",
  });

  useEffect(() => {
    let active = true;
    supabase.from("customers").select("*").order("company_name")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        setCustomers(data || []);
      })
      .catch((error) => notifications.show({
        title: "Customers Could Not Load",
        message: error.message,
        color: "red",
      }));
    return () => { active = false; };
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveJob(event) {
    event.preventDefault();
    if (!form.project_name.trim()) {
      notifications.show({ title: "Job Name Required", message: "Enter a name for this job.", color: "orange" });
      return;
    }

    setSaving(true);
    try {
      const customer = customers.find((item) => String(item.id) === String(form.customer_id));
      const projectNumber = await generateNumber("Project");
      const { data, error } = await supabase.from("projects").insert({
        project_number: projectNumber,
        project_name: form.project_name.trim(),
        project_type: form.project_type,
        project_category: "Outside Job",
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        contact_name: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || null,
        contact_phone: customer?.phone || null,
        job_address: form.job_address.trim() || customer?.address || null,
        city: form.city.trim() || customer?.city || null,
        state: form.state.trim() || customer?.state || null,
        zip_code: form.zip_code.trim() || customer?.zip || null,
        assigned_to: form.assigned_to.trim() || null,
        status: form.status,
        priority: form.priority,
        work_location: "Outside Job",
        planned_start_date: dateValue(form.planned_start_date),
        due_date: dateValue(form.due_date),
        notes: form.notes.trim() || null,
        site_visit_required: false,
        measurements_required: false,
        quote_required: false,
        fabrication_required: false,
        test_fit_required: false,
        finish_required: false,
        install_required: false,
        design_required: false,
        assembly_required: false,
        quote_status: "Not Required",
        approval_status: "Bypassed",
        customer_approval_required: false,
        down_payment_required: false,
        down_payment_status: "Not Required",
        balance_status: "Not Required",
        is_active: true,
      }).select("*").single();
      if (error) throw error;

      setSelectedProject?.(data);
      notifications.show({ title: "Job Created", message: `${data.project_number} is ready to track. Attach a quote whenever you need one.`, color: "green" });
      setPage("projectDetails");
    } catch (error) {
      notifications.show({ title: "Job Could Not Be Created", message: error.message, color: "red" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <MWPageHeader
        title="New Outside Job"
        subtitle="Create the job first. Add a quote later if one applies."
        setPage={setPage}
        showBack
        backPage="projects"
        backLabel="Job Tracker"
        showDashboard
      />
      <MWSection title="Job Details">
        <form onSubmit={saveJob}>
          <Stack gap="md">
            <Alert color="blue" title="A quote is optional">This job is saved directly to the tracker. It will not wait for a quote, approval, or deposit.</Alert>
            <TextInput label="Job Name" placeholder="Example: Smith porch railing repair" required value={form.project_name} onChange={(event) => update("project_name", event.currentTarget.value)} />
            <Select label="Customer" placeholder="Choose a customer (optional)" searchable clearable data={customers.map((customer) => ({ value: String(customer.id), label: customerLabel(customer) }))} value={form.customer_id ? String(form.customer_id) : null} onChange={(value) => update("customer_id", value)} />
            <Group grow align="flex-start">
              <Select label="Job Type" data={["Other Project", "Railings & Handrails", "Gates & Fences", "Repair & Restoration", "Custom Fabrication", "Install & Field Work"]} value={form.project_type} onChange={(value) => update("project_type", value || "Other Project")} allowDeselect={false} />
              <Select label="Status" data={["New", "Scheduled", "In Progress", "On Hold", "Completed"]} value={form.status} onChange={(value) => update("status", value || "New")} allowDeselect={false} />
              <Select label="Priority" data={["Low", "Normal", "High", "Rush"]} value={form.priority} onChange={(value) => update("priority", value || "Normal")} allowDeselect={false} />
            </Group>
            <Group grow>
              <DateInput label="Scheduled Date" description="Shows this job on the company calendar." clearable value={form.planned_start_date} onChange={(value) => update("planned_start_date", value)} />
              <DateInput label="Due Date" clearable value={form.due_date} onChange={(value) => update("due_date", value)} />
            </Group>
            <Group grow>
              <TextInput label="Assigned To" placeholder="Optional" value={form.assigned_to} onChange={(event) => update("assigned_to", event.currentTarget.value)} />
              <TextInput label="Job Address" placeholder="Optional" value={form.job_address} onChange={(event) => update("job_address", event.currentTarget.value)} />
            </Group>
            <Group grow>
              <TextInput label="City" value={form.city} onChange={(event) => update("city", event.currentTarget.value)} />
              <TextInput label="State" value={form.state} onChange={(event) => update("state", event.currentTarget.value)} />
              <TextInput label="ZIP" value={form.zip_code} onChange={(event) => update("zip_code", event.currentTarget.value)} />
            </Group>
            <Textarea label="Notes" minRows={3} placeholder="Scope, access notes, or anything the crew should know." value={form.notes} onChange={(event) => update("notes", event.currentTarget.value)} />
            <Group justify="flex-end">
              <Button type="button" variant="default" onClick={() => setPage("projects")}>Cancel</Button>
              <Button type="submit" color="red" loading={saving}>Create Job</Button>
            </Group>
            <Text size="xs" c="dimmed">The job number is assigned automatically. You can attach an existing quote from the job overview after saving.</Text>
          </Stack>
        </form>
      </MWSection>
    </>
  );
}
