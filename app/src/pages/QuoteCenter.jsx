import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FileInput,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { supabase } from "../lib/supabase";
import { generateNumber } from "../lib/generateNumber";
import { emptyOrganizedQuote, organizeQuoteText } from "../lib/quoteOrganizer";
import { downloadSignedApprovalPdf } from "../services/signedApprovalExportService";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import OutsideWorkspaceNav from "../components/OutsideWorkspaceNav";

const TEMPLATE_FIELDS = [
  "quote_title",
  "scope_of_work",
  "specifications",
  "included_services",
  "exclusions",
  "project_schedule",
  "down_payment_terms",
  "payment_terms",
  "warranty_terms",
  "disclaimer",
  "price_notes",
  "customer_responsibilities",
  "assumptions",
  "safety_technical_notice",
  "acceptance_terms",
];

const SHOP_ADDRESS = "1122 Gillespie Street, Fayetteville, NC 28306";
// Versioned key intentionally retires worksheets left behind by the former
// copy-only workflow. New worksheets clear after a successful tracked copy.
const PREQUOTE_STORAGE_KEY = "metal-worx-prequote-site-estimate-v2";

function googleMapsDirectionsUrl(destination) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    SHOP_ADDRESS,
  )}&destination=${encodeURIComponent(destination || "")}&travelmode=driving`;
}

function loadSavedSiteEstimate() {
  const empty = {
    customer: "",
    contact: "",
    phone: "",
    destination: "",
    visitDate: "",
    assignedTo: "",
    oneWayMiles: 0,
    ratePerMile: 0,
    notes: "",
  };
  try {
    return {
      ...empty,
      ...JSON.parse(window.localStorage.getItem(PREQUOTE_STORAGE_KEY) || "{}"),
    };
  } catch {
    return empty;
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-US");
}

function addDays(value, days) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  date.setDate(date.getDate() + Number(days || 15));
  return date.toISOString().slice(0, 10);
}

function statusColor(status) {
  if (status === "Approved") return "green";
  if (status === "Sent" || status === "Ready for Review") return "blue";
  if (status === "Declined" || status === "Cancelled" || status === "Expired")
    return "red";
  return "gray";
}

function QuoteCenter({
  setPage,
  setSelectedQuote,
  setSelectedProject,
  activeUser,
}) {
  const activeUserName =
    typeof activeUser === "string"
      ? activeUser
      : activeUser?.full_name ||
        activeUser?.name ||
        activeUser?.display_name ||
        "Dan";

  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [siteVisits, setSiteVisits] = useState([]);
  const [advancingSiteVisitId, setAdvancingSiteVisitId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionQuote, setConversionQuote] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPasteOrganizer, setShowPasteOrganizer] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [organizedQuote, setOrganizedQuote] = useState(null);
  const [organizerImages, setOrganizerImages] = useState([]);
  const [organizerCreating, setOrganizerCreating] = useState(false);
  const [deletingQuoteId, setDeletingQuoteId] = useState(null);
  const [approvalsByQuote, setApprovalsByQuote] = useState({});
  const [approvalQuote, setApprovalQuote] = useState(null);
  const [approvalEmail, setApprovalEmail] = useState("");
  const [approvalDays, setApprovalDays] = useState(15);
  const [approvalLink, setApprovalLink] = useState("");
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [showSiteEstimate, setShowSiteEstimate] = useState(true);
  const [siteEstimate, setSiteEstimate] = useState(loadSavedSiteEstimate);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [typeFilter, setTypeFilter] = useState("All");
  const [conversionForm, setConversionForm] = useState({
    design_required: false,
    fabrication_required: true,
    test_fit_required: true,
    finish_required: true,
    assembly_required: false,
    install_required: true,
    down_payment_required: true,
  });
  const [form, setForm] = useState({
    customer_id: null,
    company_name: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    billing_address: "",
    billing_city: "",
    billing_state: "NC",
    billing_zip: "",
    project_name: "",
    assigned_to: activeUserName,
    template_id: null,
  });

  useEffect(() => {
    loadCenter();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      PREQUOTE_STORAGE_KEY,
      JSON.stringify(siteEstimate),
    );
  }, [siteEstimate]);


  function updateSiteEstimate(field, value) {
    setSiteEstimate((current) => ({ ...current, [field]: value }));
  }

  function siteEstimateSummary() {
    const oneWay = Number(siteEstimate.oneWayMiles || 0);
    const roundTrip = oneWay * 2;
    const travelCost = roundTrip * Number(siteEstimate.ratePerMile || 0);
    return [
      "METAL WORX — PRE-QUOTE SITE ESTIMATE",
      "",
      `Potential Customer / Job: ${siteEstimate.customer || "Not entered"}`,
      `Contact: ${siteEstimate.contact || "Not entered"}`,
      `Phone: ${siteEstimate.phone || "Not entered"}`,
      `Job-Site Address: ${siteEstimate.destination || "Not entered"}`,
      `Requested Site Visit: ${formatDate(siteEstimate.visitDate)}`,
      `Assigned To: ${siteEstimate.assignedTo || "Not assigned"}`,
      `Google Maps Route: ${googleMapsDirectionsUrl(siteEstimate.destination)}`,
      `Estimated Mileage: ${oneWay || "Confirm"} one way / ${roundTrip || "Confirm"} round trip`,
      `Mileage Rate: ${money(siteEstimate.ratePerMile)} per mile`,
      `Estimated Travel Charge: ${money(travelCost)}`,
      "",
      "Site Notes / Estimate Needed:",
      siteEstimate.notes || "Please inspect the site, confirm measurements, labor, materials, equipment, access, and installation requirements.",
      "",
      "Return measurements, photos, scope details, estimated labor hours, material requirements, and any site concerns to Operations so a formal quote can be prepared.",
    ].join("\n");
  }

  async function copySiteEstimate() {
    const subject = `Site Estimate Request — ${siteEstimate.customer || siteEstimate.destination || "Potential Job"}`;
    const completeEmail = [
      "TO: info@metalworxinc.net; kory@metalworxinc.net",
      `SUBJECT: ${subject}`,
      "",
      siteEstimateSummary(),
    ].join("\n");

    try {
      const { data: savedVisit, error } = await supabase
        .from("prequote_site_visits")
        .insert({
          customer_name: siteEstimate.customer.trim() || siteEstimate.destination.trim(),
          contact_name: siteEstimate.contact.trim() || null,
          contact_phone: siteEstimate.phone.trim() || null,
          job_site_address: siteEstimate.destination.trim(),
          requested_visit_date: siteEstimate.visitDate || null,
          assigned_estimator: siteEstimate.assignedTo.trim() || null,
          one_way_miles: Number(siteEstimate.oneWayMiles || 0),
          rate_per_mile: Number(siteEstimate.ratePerMile || 0),
          notes: siteEstimate.notes.trim() || null,
          status: siteEstimate.visitDate ? "Scheduled" : "Open",
          created_by: activeUserName,
          email_copied_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw error;

      await navigator.clipboard.writeText(completeEmail);
      setSiteVisits((current) => [savedVisit, ...current]);
      window.localStorage.removeItem(PREQUOTE_STORAGE_KEY);
      setSiteEstimate(loadSavedSiteEstimate());
      notifications.show({
        title: "Email Copied & Site Visit Saved",
        message: "The worksheet was cleared. Paste the complete information into Gmail when ready.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Site Visit Was Not Cleared",
        message: error.message || "The email could not be copied and saved. Your worksheet information is still available.",
        color: "red",
      });
    }
  }

  async function updateSiteVisitStatus(visit, status) {
    const timestamp = new Date().toISOString();
    const updates = {
      status,
      updated_at: timestamp,
      completed_at: status === "Completed" ? timestamp : visit.completed_at,
      converted_at: status === "Converted to Quote" ? timestamp : visit.converted_at,
    };
    const { data, error } = await supabase
      .from("prequote_site_visits")
      .update(updates)
      .eq("id", visit.id)
      .select("*")
      .single();
    if (error) {
      notifications.show({ title: "Site Visit Could Not Update", message: error.message, color: "red" });
      return;
    }
    setSiteVisits((current) => current.map((item) => item.id === visit.id ? data : item));
    notifications.show({ title: "Site Visit Updated", message: `${visit.customer_name} is now ${status}.`, color: "green" });
  }

  async function moveSiteVisitToQuote(visit) {
    setAdvancingSiteVisitId(visit.id);
    try {
      const { data, error } = await supabase.rpc("mw_advance_prequote_site_visit", {
        p_visit_id: visit.id,
        p_action: "quote",
        p_actor: activeUserName,
        p_bypass_reason: null,
      });
      if (error) throw error;

      const { data: quote, error: quoteError } = await supabase
        .from("project_quotes")
        .select("*")
        .eq("id", data.quote_id)
        .single();
      if (quoteError) throw quoteError;

      setSiteVisits((current) => current.map((item) => item.id === visit.id
        ? { ...item, quote_id: quote.id, status: "Converted to Quote", converted_at: new Date().toISOString() }
        : item));
      setQuotes((current) => current.some((item) => item.id === quote.id) ? current : [quote, ...current]);
      setSelectedQuote(quote);
      setSelectedProject(null);
      setPage("quoteBuilder");
      notifications.show({
        title: data?.existing ? "Quote Already Started" : "Draft Quote Created",
        message: `${quote.quote_number} is linked to ${visit.customer_name}.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({ title: "Could Not Move to Quote", message: error.message, color: "red" });
    } finally {
      setAdvancingSiteVisitId(null);
    }
  }

  function clearSiteEstimate() {
    if (!window.confirm("Clear this pre-quote site estimate?")) return;
    window.localStorage.removeItem(PREQUOTE_STORAGE_KEY);
    setSiteEstimate(loadSavedSiteEstimate());
  }

  async function loadCenter() {
    setLoading(true);
    try {
      const [quoteResult, customerResult, templateResult, siteVisitResult, approvalResult] = await Promise.all([
        supabase
          .from("project_quotes")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("customers")
          .select("*")
          .order("company_name", { ascending: true }),
        supabase
          .from("quote_templates")
          .select("*")
          .eq("is_active", true)
          .order("template_name", { ascending: true }),
        supabase
          .from("prequote_site_visits")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_quote_approvals")
          .select("id,quote_id,document_version,status,recipient_email,expires_at,sent_at,viewed_at,approved_at,signer_name,signer_email,customer_message,document_hash")
          .order("created_at", { ascending: false }),
      ]);

      if (quoteResult.error) throw quoteResult.error;
      if (customerResult.error) throw customerResult.error;
      if (templateResult.error) throw templateResult.error;
      if (siteVisitResult.error) throw siteVisitResult.error;
      if (approvalResult.error) throw approvalResult.error;

      setQuotes(quoteResult.data || []);
      setCustomers(customerResult.data || []);
      setTemplates(templateResult.data || []);
      setSiteVisits(siteVisitResult.data || []);
      setApprovalsByQuote(
        (approvalResult.data || []).reduce((latest, approval) => {
          if (!latest[approval.quote_id]) latest[approval.quote_id] = approval;
          return latest;
        }, {}),
      );
    } catch (error) {
      notifications.show({
        title: "Quote Center Could Not Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  function openApprovalManager(quote) {
    setApprovalQuote(quote);
    setApprovalEmail(quote.contact_email || approvalsByQuote[quote.id]?.recipient_email || "");
    setApprovalDays(15);
    setApprovalLink("");
  }

  async function createApprovalLink() {
    if (!approvalQuote) return;
    setApprovalBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-quote-approval", {
        body: {
          action: "create",
          quote_id: approvalQuote.id,
          recipient_email: approvalEmail,
          expiration_days: approvalDays,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "The approval link could not be created.");
      const link = `${window.location.origin}/approve?token=${data.token}`;
      setApprovalLink(link);
      setApprovalsByQuote((current) => ({ ...current, [approvalQuote.id]: data.approval }));
      setQuotes((current) => current.map((quote) => quote.id === approvalQuote.id ? { ...quote, status: "Sent" } : quote));
      notifications.show({ title: "Customer Approval Link Ready", message: "The quote was frozen into a new document version. Copy the link and send it to the customer.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Approval Link Could Not Be Created", message: error.message, color: "red" });
    } finally {
      setApprovalBusy(false);
    }
  }

  async function copyApprovalLink() {
    await navigator.clipboard.writeText(approvalLink);
    notifications.show({ title: "Approval Link Copied", message: "Paste it into your customer email. The quote will update automatically when they respond.", color: "green" });
  }

  async function revokeApprovalLink() {
    const approval = approvalQuote ? approvalsByQuote[approvalQuote.id] : null;
    if (!approval || !window.confirm("Revoke this customer approval link? The customer will no longer be able to approve it.")) return;
    setApprovalBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-quote-approval", { body: { action: "revoke", approval_id: approval.id } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setApprovalsByQuote((current) => ({ ...current, [approvalQuote.id]: { ...approval, status: "Revoked" } }));
      setApprovalLink("");
      notifications.show({ title: "Approval Link Revoked", message: "That link can no longer be used.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Link Could Not Be Revoked", message: error.message, color: "red" });
    } finally {
      setApprovalBusy(false);
    }
  }

  async function downloadSignedAgreement() {
    const summary = approvalQuote ? approvalsByQuote[approvalQuote.id] : null;
    if (!summary) return;
    setApprovalBusy(true);
    try {
      const { data, error } = await supabase
        .from("customer_quote_approvals")
        .select("*")
        .eq("id", summary.id)
        .single();
      if (error) throw error;
      if (data.status !== "Approved") throw new Error("This quote has not been signed yet.");
      downloadSignedApprovalPdf(data);
      notifications.show({ title: "Signed Agreement Downloaded", message: "A permanent PDF copy was saved to your computer.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Signed Agreement Could Not Download", message: error.message, color: "red" });
    } finally {
      setApprovalBusy(false);
    }
  }

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => {
        const person =
          `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
          customer.contact_name ||
          customer.name ||
          "";
        const company = customer.company_name || customer.business_name || "";
        return {
          value: String(customer.id),
          label:
            [company, person].filter(Boolean).join(" — ") ||
            `Customer ${customer.id}`,
        };
      }),
    [customers],
  );

  const filteredQuotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    const closed = ["Declined", "Cancelled", "Expired"];

    return quotes.filter((quote) => {
      if (
        statusFilter === "Open" &&
        closed.includes(String(quote.status || ""))
      ) {
        return false;
      }
      if (
        statusFilter !== "All" &&
        statusFilter !== "Open" &&
        quote.status !== statusFilter
      ) {
        return false;
      }
      if (typeFilter !== "All" && quote.quote_type !== typeFilter) return false;

      if (!term) return true;
      return [
        quote.quote_number,
        quote.company_name,
        quote.customer_name,
        quote.contact_name,
        quote.project_name,
        quote.quote_title,
        quote.assigned_to,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [quotes, search, statusFilter, typeFilter]);

  const stats = useMemo(
    () => ({
      open: quotes.filter(
        (quote) => !["Declined", "Cancelled", "Expired"].includes(quote.status),
      ).length,
      draft: quotes.filter((quote) => quote.status === "Draft").length,
      sent: quotes.filter((quote) => quote.status === "Sent").length,
      approved: quotes.filter((quote) => quote.status === "Approved").length,
    }),
    [quotes],
  );

  function chooseCustomer(value) {
    const customer = customers.find(
      (entry) => String(entry.id) === String(value),
    );
    if (!customer) {
      setForm((current) => ({ ...current, customer_id: null }));
      return;
    }

    const contact =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.contact_name ||
      customer.name ||
      "";

    setForm((current) => ({
      ...current,
      customer_id: String(customer.id),
      company_name:
        customer.company_name || customer.business_name || current.company_name,
      contact_name: contact || current.contact_name,
      contact_phone:
        customer.phone || customer.phone_number || current.contact_phone,
      contact_email: customer.email || current.contact_email,
      billing_address:
        customer.address || customer.street_address || current.billing_address,
      billing_city: customer.city || current.billing_city,
      billing_state: customer.state || current.billing_state,
      billing_zip:
        customer.zip_code || customer.postal_code || current.billing_zip,
    }));
  }

  function updateFormField(field) {
    return (event) => {
      const value = event.currentTarget.value;
      setForm((current) => ({
        ...current,
        [field]: value,
      }));
    };
  }

  function organizePastedQuote() {
    if (!pasteText.trim()) {
      notifications.show({
        title: "Paste Quote Information",
        message: "Paste the customer quote write-up before organizing it.",
        color: "orange",
      });
      return;
    }
    setOrganizedQuote(organizeQuoteText(pasteText));
    notifications.show({
      title: "Quote Organized",
      message: "Review every field and line item before creating the draft quote.",
      color: "green",
    });
  }

  function addOrganizerImages(files) {
    const selectedFiles = Array.isArray(files) ? files : files ? [files] : [];
    if (!selectedFiles.length) return;

    setOrganizerImages((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        file,
        caption: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " "),
        image_type: "Project Image",
        show_on_pdf: true,
      })),
    ]);
  }

  function updateOrganizerImage(index, field, value) {
    setOrganizerImages((current) =>
      current.map((image, imageIndex) =>
        imageIndex === index ? { ...image, [field]: value } : image,
      ),
    );
  }

  function removeOrganizerImage(index) {
    setOrganizerImages((current) =>
      current.filter((_, imageIndex) => imageIndex !== index),
    );
  }

  async function uploadOrganizerImages(quoteId) {
    const failures = [];

    for (let index = 0; index < organizerImages.length; index += 1) {
      const image = organizerImages[index];
      const extension = image.file.name.split(".").pop();
      const safeName = image.file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-");
      const filePath = `${quoteId}/${Date.now()}-${index}-${safeName}.${extension}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from("quote-images")
          .upload(filePath, image.file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("quote-images")
          .getPublicUrl(filePath);

        const { error: databaseError } = await supabase
          .from("project_quote_images")
          .insert({
            quote_id: quoteId,
            image_url: publicUrlData.publicUrl,
            caption: image.caption.trim(),
            image_type: image.image_type,
            show_on_pdf: image.show_on_pdf,
            sort_order: index + 1,
          });

        if (databaseError) {
          await supabase.storage.from("quote-images").remove([filePath]);
          throw databaseError;
        }
      } catch (error) {
        failures.push(`${image.file.name}: ${error.message || "upload failed"}`);
      }
    }

    return failures;
  }

  function updateOrganizedField(field, value) {
    setOrganizedQuote((current) => ({
      ...(current || emptyOrganizedQuote()),
      [field]: value,
    }));
  }

  function updateOrganizedItem(index, field, value) {
    setOrganizedQuote((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function addOrganizedItem() {
    setOrganizedQuote((current) => ({
      ...(current || emptyOrganizedQuote()),
      items: [
        ...(current?.items || []),
        { item_type: "Service", title: "", description: "", quantity: 1, unit: "Each", unit_price: 0 },
      ],
    }));
  }

  function removeOrganizedItem(index) {
    setOrganizedQuote((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function createOrganizedDraftQuote() {
    if (!organizedQuote?.customer_name?.trim()) {
      notifications.show({ title: "Customer Required", message: "Enter the customer or company name.", color: "orange" });
      return;
    }
    if (!organizedQuote?.quote_title?.trim()) {
      notifications.show({ title: "Quote Title Required", message: "Enter a name for this quote.", color: "orange" });
      return;
    }
    const validItems = organizedQuote.items.filter((item) => item.title.trim());
    if (!validItems.length) {
      notifications.show({ title: "Line Item Required", message: "Add at least one line item before creating the quote.", color: "orange" });
      return;
    }

    setOrganizerCreating(true);
    try {
      const quoteNumber = await generateNumber("Quote");
      const quoteDate = new Date().toISOString().slice(0, 10);
      const subtotal = validItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0,
      );
      const taxRate = Number(organizedQuote.tax_rate || 0);
      const taxAmount = subtotal * taxRate;
      const payload = {
        quote_number: quoteNumber,
        project_id: null,
        quote_type: "Standalone Quote",
        customer_name: organizedQuote.customer_name.trim(),
        company_name: organizedQuote.customer_name.trim(),
        contact_name: organizedQuote.customer_name.trim(),
        contact_phone: organizedQuote.contact_phone.trim() || null,
        contact_email: organizedQuote.contact_email.trim() || null,
        billing_address: organizedQuote.address.trim() || null,
        project_name: organizedQuote.quote_title.trim(),
        quote_title: organizedQuote.quote_title.trim(),
        assigned_to: activeUserName,
        prepared_by: activeUserName,
        quote_date: quoteDate,
        valid_until: addDays(quoteDate, 15),
        status: "Draft",
        is_active: true,
        tax_rate: taxRate,
        subtotal,
        tax_amount: taxAmount,
        total_amount: subtotal + taxAmount,
        quote_layout: "Detailed Fabrication",
        scope_of_work: organizedQuote.scope_of_work,
        specifications: organizedQuote.specifications,
        included_services: organizedQuote.included_services,
        exclusions: organizedQuote.exclusions,
        project_schedule: organizedQuote.project_schedule,
        down_payment_terms: organizedQuote.down_payment_terms,
        payment_terms: organizedQuote.payment_terms || organizedQuote.down_payment_terms,
        price_notes: organizedQuote.price_notes,
        warranty_terms: "Metal Worx Inc. warrants fabricated products against defects in workmanship for 90 days from completion.",
        disclaimer: "Due to fluctuations in material costs, Metal Worx Inc. reserves the right to update this quote. All prices are subject to final material cost verification.",
        acceptance_terms: "By signing below, the customer accepts this quote, including its scope, price, assumptions, exclusions, payment schedule, and stated terms. Work outside the approved scope requires customer authorization.",
      };

      const { data: createdQuote, error } = await supabase
        .from("project_quotes")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      const itemPayload = validItems.map((item, index) => ({
        quote_id: createdQuote.id,
        item_type: item.item_type || "Service",
        title: item.title.trim(),
        description: item.description?.trim() || "",
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        line_total: Number(item.quantity || 0) * Number(item.unit_price || 0),
        is_optional: false,
        is_selected: true,
        show_on_pdf: true,
        sort_order: index + 1,
      }));
      const { error: itemError } = await supabase.from("project_quote_items").insert(itemPayload);
      if (itemError) throw itemError;

      const imageFailures = await uploadOrganizerImages(createdQuote.id);

      setSelectedQuote(createdQuote);
      setSelectedProject(null);
      if (imageFailures.length) {
        notifications.show({
          title: "Draft Created — Some Images Need Attention",
          message: `${createdQuote.quote_number} was created, but ${imageFailures.length} image${imageFailures.length === 1 ? "" : "s"} did not upload. You can add them again in Quote Builder.`,
          color: "orange",
        });
      } else {
        notifications.show({
          title: "Editable Draft Quote Created",
          message: `${createdQuote.quote_number} was organized with ${organizerImages.length} attached image${organizerImages.length === 1 ? "" : "s"} and is ready for final review.`,
          color: "green",
        });
      }
      setPage("quoteBuilder");
    } catch (error) {
      notifications.show({ title: "Quote Could Not Be Created", message: error.message, color: "red" });
    } finally {
      setOrganizerCreating(false);
    }
  }

  async function openQuote(quote, targetPage) {
    try {
      setSelectedQuote(quote);
      if (quote.project_id) {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", quote.project_id)
          .maybeSingle();
        if (error) throw error;
        setSelectedProject(data || null);
      } else {
        setSelectedProject(null);
      }
      setPage(targetPage);
    } catch (error) {
      notifications.show({
        title: "Quote Could Not Open",
        message: error.message,
        color: "red",
      });
    }
  }

  async function openProject(quote) {
    const projectId = quote.converted_project_id || quote.project_id;
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error) throw error;

      setSelectedQuote(quote);
      setSelectedProject(data);
      setPage("projectDetails");
    } catch (error) {
      notifications.show({
        title: "Project Could Not Open",
        message: error.message,
        color: "red",
      });
    }
  }

  async function deleteQuote(quote) {
    const quoteLabel = quote.quote_number || `Quote ${quote.id}`;
    const customerLabel =
      quote.company_name || quote.customer_name || quote.contact_name || "No customer entered";
    const linkedProjectWarning =
      quote.project_id || quote.converted_project_id
        ? "\n\nThe linked project will remain in the system; only this quote will be deleted."
        : "";

    if (
      !window.confirm(
        `Permanently delete ${quoteLabel} for ${customerLabel}?\n\nThis removes the quote, its line items, and its attached image records. This cannot be undone.${linkedProjectWarning}`,
      )
    ) {
      return;
    }

    setDeletingQuoteId(quote.id);
    try {
      const { data: quoteImages, error: imageLoadError } = await supabase
        .from("project_quote_images")
        .select("image_url")
        .eq("quote_id", quote.id);
      if (imageLoadError) throw imageLoadError;

      const { error: deleteError } = await supabase
        .from("project_quotes")
        .delete()
        .eq("id", quote.id);
      if (deleteError) throw deleteError;

      const storagePaths = (quoteImages || [])
        .map((image) => {
          const marker = "/quote-images/";
          if (!image.image_url?.includes(marker)) return null;
          return decodeURIComponent(image.image_url.split(marker)[1]);
        })
        .filter(Boolean);

      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage
          .from("quote-images")
          .remove(storagePaths);
        if (storageError) console.error("Quote image cleanup failed:", storageError);
      }

      setQuotes((current) => current.filter((item) => item.id !== quote.id));
      notifications.show({
        title: "Quote Deleted",
        message: `${quoteLabel} was permanently removed.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Quote Could Not Be Deleted",
        message:
          error.message ||
          "This quote may still be linked to another record. Nothing was removed.",
        color: "red",
      });
    } finally {
      setDeletingQuoteId(null);
    }
  }

  function beginConversion(quote) {
    setConversionQuote(quote);
    setConversionForm({
      design_required: false,
      fabrication_required: true,
      test_fit_required: true,
      finish_required: true,
      assembly_required: false,
      install_required: true,
      down_payment_required: Number(quote.total_amount || 0) > 0,
    });
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  }

  function updateConversionField(field) {
    return (event) => {
      const checked = event.currentTarget.checked;
      setConversionForm((current) => ({
        ...current,
        [field]: checked,
      }));
    };
  }

  async function convertQuote() {
    if (!conversionQuote) return;

    setConverting(true);
    try {
      const actor = activeUserName || "Metal Worx";

      const { data, error } = await supabase.rpc(
        "mw_convert_quote_to_project",
        {
          p_quote_id: Number(conversionQuote.id),
          p_converted_by: actor,
          p_fabrication_required: conversionForm.fabrication_required,
          p_test_fit_required: conversionForm.test_fit_required,
          p_finish_required: conversionForm.finish_required,
          p_assembly_required: conversionForm.assembly_required,
          p_install_required: conversionForm.install_required,
          p_design_required: conversionForm.design_required,
          p_down_payment_required: conversionForm.down_payment_required,
        },
      );
      if (error) throw error;

      const project = Array.isArray(data) ? data[0] : data;
      if (!project?.id) {
        throw new Error("The project was created but was not returned.");
      }

      const updatedQuote = {
        ...conversionQuote,
        project_id: project.id,
        converted_project_id: project.id,
        converted_at: new Date().toISOString(),
        converted_by: actor,
        quote_type: "Project Quote",
      };

      setQuotes((current) =>
        current.map((quote) =>
          quote.id === conversionQuote.id ? updatedQuote : quote,
        ),
      );
      setConversionQuote(null);

      notifications.show({
        title: "Outside Project Created",
        message: `${project.project_number} was created from ${conversionQuote.quote_number}.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Quote Could Not Be Converted",
        message: error.message,
        color: "red",
      });
    } finally {
      setConverting(false);
    }
  }

  async function createStandaloneQuote() {
    if (!form.project_name.trim()) {
      notifications.show({
        title: "Quote Title Required",
        message: "Enter the product, service, or formal quote name.",
        color: "orange",
      });
      return;
    }

    if (!form.company_name.trim() && !form.contact_name.trim()) {
      notifications.show({
        title: "Customer Required",
        message: "Select a customer or enter a company/contact name.",
        color: "orange",
      });
      return;
    }

    setCreating(true);
    try {
      const template = templates.find(
        (entry) => String(entry.id) === String(form.template_id),
      );
      const quoteNumber = await generateNumber("Quote");
      const quoteDate = new Date().toISOString().slice(0, 10);

      const payload = {
        quote_number: quoteNumber,
        project_id: null,
        quote_type: "Standalone Quote",
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        company_name: form.company_name.trim() || null,
        contact_name: form.contact_name.trim() || null,
        customer_name:
          form.company_name.trim() || form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        billing_address: form.billing_address.trim() || null,
        billing_city: form.billing_city.trim() || null,
        billing_state: form.billing_state.trim() || null,
        billing_zip: form.billing_zip.trim() || null,
        project_name: form.project_name.trim(),
        quote_title: form.project_name.trim(),
        assigned_to: form.assigned_to.trim() || activeUserName,
        prepared_by: form.assigned_to.trim() || activeUserName,
        quote_date: quoteDate,
        valid_until: addDays(quoteDate, template?.valid_for_days || 15),
        status: "Draft",
        is_active: true,
        tax_rate: 0.07,
        source_template_id: template?.id || null,
        source_template_name: template?.template_name || null,
        template_applied_at: template ? new Date().toISOString() : null,
        quote_layout: template?.quote_layout || "Detailed Fabrication",
      };

      TEMPLATE_FIELDS.forEach((field) => {
        if (field !== "quote_title") {
          payload[field] = template?.[field] || "";
        }
      });

      const { data: createdQuote, error } = await supabase
        .from("project_quotes")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      if (template?.id) {
        const { data: templateItems, error: itemLoadError } = await supabase
          .from("quote_template_items")
          .select("*")
          .eq("template_id", template.id)
          .order("sort_order", { ascending: true });
        if (itemLoadError) throw itemLoadError;

        if ((templateItems || []).length) {
          const itemPayload = templateItems.map((item, index) => ({
            quote_id: createdQuote.id,
            item_type: item.item_type || "Service",
            title: item.title,
            description: item.description || "",
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price || 0),
            line_total:
              Number(item.quantity || 0) * Number(item.unit_price || 0),
            is_optional: Boolean(item.is_optional),
            is_selected: item.is_selected !== false,
            show_on_pdf: item.show_on_pdf !== false,
            sort_order: Number(item.sort_order || index + 1),
          }));
          const { error: itemError } = await supabase
            .from("project_quote_items")
            .insert(itemPayload);
          if (itemError) throw itemError;
        }
      }

      setSelectedQuote(createdQuote);
      setSelectedProject(null);
      notifications.show({
        title: "Standalone Quote Created",
        message: `${createdQuote.quote_number} is ready to build.`,
        color: "green",
      });
      setPage("quoteBuilder");
    } catch (error) {
      notifications.show({
        title: "Quote Could Not Be Created",
        message: error.message,
        color: "red",
      });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <>
        <MWPageHeader
          title="Quote Center"
          subtitle="Loading formal customer quotes"
          setPage={setPage}
          showDashboard={true}
        />
        <Card withBorder radius="lg" p="xl">
          <Group justify="center">
            <Loader color="red" />
            <Text c="dimmed">Loading quotes...</Text>
          </Group>
        </Card>
      </>
    );
  }

  const conversionPanel = conversionQuote ? (
    <MWSection title="Convert Approved Quote to Outside Project">
        <Stack>
          <Alert color="blue">
            Select the work required for{" "}
            <strong>
              {conversionQuote?.quote_number} —{" "}
              {conversionQuote?.project_name ||
                conversionQuote?.quote_title ||
                "Outside Project"}
            </strong>
            . These selections create the project workflow and can still be
            reviewed from the project.
          </Alert>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Checkbox
              label="Design"
              description="Artwork, drawings, or design approval is required"
              checked={conversionForm.design_required}
              onChange={updateConversionField("design_required")}
            />
            <Checkbox
              label="Welding / Fabrication"
              description="The project requires shop fabrication"
              checked={conversionForm.fabrication_required}
              onChange={updateConversionField("fabrication_required")}
            />
            <Checkbox
              label="Test Fit"
              description="A shop or customer-site test fit is required"
              checked={conversionForm.test_fit_required}
              onChange={updateConversionField("test_fit_required")}
            />
            <Checkbox
              label="Finish / Corrections"
              description="Paint, powder coating, or finish corrections"
              checked={conversionForm.finish_required}
              onChange={updateConversionField("finish_required")}
            />
            <Checkbox
              label="Assembly"
              description="Final assembly is required after finishing"
              checked={conversionForm.assembly_required}
              onChange={updateConversionField("assembly_required")}
            />
            <Checkbox
              label="Customer-Site Installation"
              description="The completed work must be installed at the site"
              checked={conversionForm.install_required}
              onChange={updateConversionField("install_required")}
            />
          </SimpleGrid>

          <Card withBorder radius="md" p="md">
            <Checkbox
              label="Down Payment Required"
              description={`Create the project with ${money(
                conversionQuote?.total_amount,
              )} due and make the down payment its first commercial action`}
              checked={conversionForm.down_payment_required}
              onChange={updateConversionField("down_payment_required")}
            />
          </Card>

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              disabled={converting}
              onClick={() => setConversionQuote(null)}
            >
              Cancel
            </Button>
            <Button color="green" loading={converting} onClick={convertQuote}>
              Create Outside Project
            </Button>
          </Group>
        </Stack>
    </MWSection>
  ) : null;

  return (
    <>

      <MWPageHeader
        title="Quote Center"
        subtitle="Create, manage, send, and convert formal Metal Worx quotes"
        setPage={setPage}
        showDashboard={true}
      />

      <OutsideWorkspaceNav current="quoteCenter" setPage={setPage} />

      <Group justify="space-between" mb="lg" wrap="wrap">
        <Button
          variant={showSiteEstimate ? "filled" : "light"}
          color="blue"
          onClick={() => setShowSiteEstimate((current) => !current)}
        >
          {showSiteEstimate
            ? "Close Site Visit & Mileage"
            : "Plan Site Visit & Mileage"}
        </Button>
        <Group gap="sm">
          <Button
            variant={showPasteOrganizer ? "filled" : "light"}
            color="green"
            onClick={() => setShowPasteOrganizer((current) => !current)}
          >
            {showPasteOrganizer ? "Close Paste & Organize" : "Paste & Organize Quote"}
          </Button>
          <Button
            color="red"
            onClick={() => setShowCreate((current) => !current)}
          >
            {showCreate ? "Close New Quote" : "New Standalone Quote"}
          </Button>
        </Group>
      </Group>

      {showPasteOrganizer && (
        <MWSection
          title="Paste & Organize Quote"
          subtitle="Paste a complete write-up, review the organized fields, and create an editable draft."
        >
          <Stack gap="md">
            <Alert color="green">
              Nothing is sent or approved automatically. The organizer creates a draft that must be reviewed in Quote Builder.
            </Alert>
            <Textarea
              label="Complete Quote Information"
              description="Include customer details, line items, prices, scope, process, deposit terms, exclusions, and other notes."
              placeholder="Paste the complete quote write-up here..."
              minRows={10}
              autosize
              value={pasteText}
              onChange={(event) => setPasteText(event.currentTarget.value)}
            />
            <Group justify="space-between" wrap="wrap">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  setPasteText("");
                  setOrganizedQuote(null);
                  setOrganizerImages([]);
                }}
              >
                Clear
              </Button>
              <Button color="green" onClick={organizePastedQuote}>Organize Quote</Button>
            </Group>

            {organizedQuote && (
              <Stack gap="lg">
                <Alert color="blue" title="Review Required">
                  Confirm the customer, title, quantities, pricing, tax rate, and scope before creating the draft.
                </Alert>
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <TextInput label="Customer / Company" required value={organizedQuote.customer_name} onChange={(event) => updateOrganizedField("customer_name", event.currentTarget.value)} />
                  <TextInput label="Quote / Project Name" required value={organizedQuote.quote_title} onChange={(event) => updateOrganizedField("quote_title", event.currentTarget.value)} />
                  <TextInput label="Phone" value={organizedQuote.contact_phone} onChange={(event) => updateOrganizedField("contact_phone", event.currentTarget.value)} />
                  <TextInput label="Email" value={organizedQuote.contact_email} onChange={(event) => updateOrganizedField("contact_email", event.currentTarget.value)} />
                  <TextInput label="Project / Billing Address" value={organizedQuote.address} onChange={(event) => updateOrganizedField("address", event.currentTarget.value)} />
                  <NumberInput label="Sales Tax Rate" suffix="%" min={0} max={100} decimalScale={3} value={Number(organizedQuote.tax_rate || 0) * 100} onChange={(value) => updateOrganizedField("tax_rate", Number(value || 0) / 100)} />
                </SimpleGrid>

                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={4}>Organized Line Items</Title>
                    <Button size="xs" variant="light" onClick={addOrganizedItem}>Add Line Item</Button>
                  </Group>
                  {organizedQuote.items.map((item, index) => (
                    <Card key={`${index}-${item.title}`} withBorder radius="md" p="md">
                      <Stack gap="sm">
                        <SimpleGrid cols={{ base: 1, md: 4 }}>
                          <TextInput label="Item" value={item.title} onChange={(event) => updateOrganizedItem(index, "title", event.currentTarget.value)} />
                          <NumberInput label="Quantity" min={0} decimalScale={2} value={Number(item.quantity || 0)} onChange={(value) => updateOrganizedItem(index, "quantity", Number(value || 0))} />
                          <TextInput label="Unit" value={item.unit || "Each"} onChange={(event) => updateOrganizedItem(index, "unit", event.currentTarget.value)} />
                          <NumberInput label="Unit Price" prefix="$" min={0} decimalScale={2} fixedDecimalScale value={Number(item.unit_price || 0)} onChange={(value) => updateOrganizedItem(index, "unit_price", Number(value || 0))} />
                        </SimpleGrid>
                        <Textarea label="Description" minRows={2} autosize value={item.description || ""} onChange={(event) => updateOrganizedItem(index, "description", event.currentTarget.value)} />
                        <Group justify="space-between">
                          <Button size="xs" variant="subtle" color="red" onClick={() => removeOrganizedItem(index)}>Remove</Button>
                          <Text fw={800}>{money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</Text>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                  <Card withBorder radius="md" p="md">
                    <Group justify="space-between">
                      <Text fw={900}>Parsed Subtotal</Text>
                      <Title order={3} c="green">{money(organizedQuote.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0))}</Title>
                    </Group>
                  </Card>
                </Stack>

                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <Textarea label="Scope of Work" minRows={5} autosize value={organizedQuote.scope_of_work} onChange={(event) => updateOrganizedField("scope_of_work", event.currentTarget.value)} />
                  <Textarea label="Project Process / Schedule" minRows={5} autosize value={organizedQuote.project_schedule} onChange={(event) => updateOrganizedField("project_schedule", event.currentTarget.value)} />
                  <Textarea label="Specifications" minRows={3} autosize value={organizedQuote.specifications} onChange={(event) => updateOrganizedField("specifications", event.currentTarget.value)} />
                  <Textarea label="Included Services" minRows={3} autosize value={organizedQuote.included_services} onChange={(event) => updateOrganizedField("included_services", event.currentTarget.value)} />
                  <Textarea label="Exclusions" minRows={3} autosize value={organizedQuote.exclusions} onChange={(event) => updateOrganizedField("exclusions", event.currentTarget.value)} />
                  <Textarea label="Deposit / Down-Payment Terms" minRows={3} autosize value={organizedQuote.down_payment_terms} onChange={(event) => updateOrganizedField("down_payment_terms", event.currentTarget.value)} />
                  <Textarea label="Payment Terms" minRows={3} autosize value={organizedQuote.payment_terms} onChange={(event) => updateOrganizedField("payment_terms", event.currentTarget.value)} />
                  <Textarea label="Pricing Notes" minRows={3} autosize value={organizedQuote.price_notes} onChange={(event) => updateOrganizedField("price_notes", event.currentTarget.value)} />
                </SimpleGrid>

                <Card withBorder radius="md" p="md">
                  <Stack gap="md">
                    <div>
                      <Title order={4}>Images, Drawings & Reference Files</Title>
                      <Text size="sm" c="dimmed">
                        Attach project photos, sketches, measurements, renderings, or reference images. They will be saved with the draft quote.
                      </Text>
                    </div>
                    <FileInput
                      label="Attach Images"
                      description="Select one or more PNG, JPG, or WebP images."
                      placeholder="Choose images from this device"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      multiple
                      clearable
                      value={[]}
                      onChange={addOrganizerImages}
                    />
                    {organizerImages.length === 0 ? (
                      <Text size="sm" c="dimmed">No images attached yet.</Text>
                    ) : (
                      <Stack gap="sm">
                        {organizerImages.map((image, index) => (
                          <Card key={`${image.file.name}-${image.file.lastModified}-${index}`} withBorder radius="sm" p="sm">
                            <Stack gap="sm">
                              <Group justify="space-between" align="flex-start" wrap="wrap">
                                <div>
                                  <Text fw={800}>{image.file.name}</Text>
                                  <Text size="xs" c="dimmed">
                                    {(image.file.size / 1024 / 1024).toFixed(2)} MB
                                  </Text>
                                </div>
                                <Button size="xs" variant="subtle" color="red" onClick={() => removeOrganizerImage(index)}>
                                  Remove
                                </Button>
                              </Group>
                              <SimpleGrid cols={{ base: 1, md: 2 }}>
                                <Select
                                  label="Image Type"
                                  data={["Project Image", "Site Photo", "Drawing", "Rendering", "Reference Photo", "Layout", "Material Sample", "Finish Sample", "Other"]}
                                  value={image.image_type}
                                  onChange={(value) => updateOrganizerImage(index, "image_type", value || "Project Image")}
                                />
                                <TextInput
                                  label="Caption"
                                  value={image.caption}
                                  onChange={(event) => updateOrganizerImage(index, "caption", event.currentTarget.value)}
                                />
                              </SimpleGrid>
                              <Checkbox
                                label="Show this image on the PDF quote"
                                checked={image.show_on_pdf}
                                onChange={(event) => updateOrganizerImage(index, "show_on_pdf", event.currentTarget.checked)}
                              />
                            </Stack>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Card>
                <Group justify="flex-end">
                  <Button color="green" loading={organizerCreating} onClick={createOrganizedDraftQuote}>
                    Create Editable Draft Quote
                  </Button>
                </Group>
              </Stack>
            )}
          </Stack>
        </MWSection>
      )}

      {showSiteEstimate && (
        <MWSection title="Site Visit, Google Maps & Mileage" subtitle="Use this before a potential job becomes a formal quote.">
          <Stack gap="md">
            <Alert color="blue">
              This worksheet creates a tracked pre-quote estimate. After the site information is complete, use <b>Move to Quote</b> to create a linked editable draft.
            </Alert>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput label="Potential Customer / Job" placeholder="Customer, company, or project name" value={siteEstimate.customer} onChange={(event) => updateSiteEstimate("customer", event.currentTarget.value)} />
              <TextInput label="Job-Site Address" placeholder="Street, city, state, ZIP" required value={siteEstimate.destination} onChange={(event) => updateSiteEstimate("destination", event.currentTarget.value)} />
              <TextInput label="Contact Name" value={siteEstimate.contact} onChange={(event) => updateSiteEstimate("contact", event.currentTarget.value)} />
              <TextInput label="Contact Phone" value={siteEstimate.phone} onChange={(event) => updateSiteEstimate("phone", event.currentTarget.value)} />
              <TextInput type="date" label="Requested Site-Visit Date" value={siteEstimate.visitDate} onChange={(event) => updateSiteEstimate("visitDate", event.currentTarget.value)} />
              <TextInput label="Assigned Estimator" placeholder="Chad, Kory, etc." value={siteEstimate.assignedTo} onChange={(event) => updateSiteEstimate("assignedTo", event.currentTarget.value)} />
            </SimpleGrid>
            <Group align="flex-end" grow wrap="wrap">
              <Button variant="light" color="blue" disabled={!siteEstimate.destination.trim()} onClick={() => window.open(googleMapsDirectionsUrl(siteEstimate.destination), "_blank", "noopener,noreferrer")}>Open Route in Google Maps</Button>
              <NumberInput label="One-Way Miles" description="Enter Google Maps mileage" min={0} decimalScale={1} value={Number(siteEstimate.oneWayMiles || 0)} onChange={(value) => updateSiteEstimate("oneWayMiles", Number(value || 0))} />
              <NumberInput label="Round-Trip Miles" value={Number(siteEstimate.oneWayMiles || 0) * 2} readOnly />
              <NumberInput label="Charge Per Mile" prefix="$" min={0} decimalScale={2} value={Number(siteEstimate.ratePerMile || 0)} onChange={(value) => updateSiteEstimate("ratePerMile", Number(value || 0))} />
            </Group>
            <Card withBorder radius="md" p="md">
              <Group justify="space-between"><Text fw={800}>Estimated travel charge</Text><Title order={3} c="green">{money(Number(siteEstimate.oneWayMiles || 0) * 2 * Number(siteEstimate.ratePerMile || 0))}</Title></Group>
            </Card>
            <Textarea label="Site Notes / Estimate Needed" description="Measurements, photos, access, labor, materials, equipment, installation, or customer requests." minRows={4} autosize value={siteEstimate.notes} onChange={(event) => updateSiteEstimate("notes", event.currentTarget.value)} />
            <Group justify="space-between" wrap="wrap">
              <Button variant="subtle" color="red" onClick={clearSiteEstimate}>Clear Worksheet</Button>
              <Button color="blue" disabled={!siteEstimate.destination.trim()} onClick={copySiteEstimate}>Copy Complete Email</Button>
            </Group>
          </Stack>
        </MWSection>
      )}

      <MWSection
        title="Pre-Quote Site Visit Tracker"
        subtitle="Saved visits stay here until they are completed, converted to a quote, or cancelled."
      >
        <Stack gap="sm">
          {siteVisits.filter((visit) => ["Open", "Scheduled"].includes(visit.status)).length ? (
            siteVisits.filter((visit) => ["Open", "Scheduled"].includes(visit.status)).map((visit) => (
              <Card key={visit.id} withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={3} style={{ flex: 1, minWidth: 260 }}>
                    <Group gap="xs"><Text fw={900}>{visit.customer_name}</Text><Badge color={visit.status === "Scheduled" ? "blue" : "orange"}>{visit.status}</Badge></Group>
                    <Text size="sm">{visit.job_site_address}</Text>
                    <Text size="xs" c="dimmed">Visit: {formatDate(visit.requested_visit_date)} · Estimator: {visit.assigned_estimator || "Not assigned"} · Contact: {visit.contact_name || "Not entered"}{visit.contact_phone ? ` (${visit.contact_phone})` : ""}</Text>
                    {visit.notes && <Text size="sm" mt={4}>{visit.notes}</Text>}
                  </Stack>
                  <Group gap="xs">
                    <Button size="xs" color="green" onClick={() => updateSiteVisitStatus(visit, "Completed")}>Mark Complete</Button>
                    <Button size="xs" color="blue" loading={advancingSiteVisitId === visit.id} onClick={() => moveSiteVisitToQuote(visit)}>Move to Quote</Button>
                    <Button size="xs" variant="subtle" color="gray" onClick={() => updateSiteVisitStatus(visit, "Cancelled")}>Cancel</Button>
                  </Group>
                </Group>
              </Card>
            ))
          ) : (
            <Alert color="blue">No open pre-quote site visits. New visits will appear here after the email information is copied.</Alert>
          )}
          {siteVisits.some((visit) => !["Open", "Scheduled"].includes(visit.status)) && (
            <Text size="xs" c="dimmed" ta="center">
              {siteVisits.filter((visit) => !["Open", "Scheduled"].includes(visit.status)).length} completed, converted, or cancelled visit{siteVisits.filter((visit) => !["Open", "Scheduled"].includes(visit.status)).length === 1 ? "" : "s"} retained in history.
            </Text>
          )}
        </Stack>
      </MWSection>

      {conversionPanel}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="lg">
        {[
          ["Open Quotes", stats.open],
          ["Draft", stats.draft],
          ["Sent", stats.sent],
          ["Approved", stats.approved],
        ].map(([label, value]) => (
          <Card key={label} withBorder radius="lg" p="lg">
            <Text size="xs" c="dimmed" fw={800} tt="uppercase">
              {label}
            </Text>
            <Title order={2} c="white">
              {value}
            </Title>
          </Card>
        ))}
      </SimpleGrid>

      {showCreate && (
        <MWSection title="New Standalone Formal Quote">
          <Alert color="blue" mb="md">
            This creates a quote without creating an outside project. An
            approved quote can be converted into a project later.
          </Alert>
          <Stack>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Select
                label="Existing Customer"
                placeholder="Optional — search customers"
                searchable
                clearable
                data={customerOptions}
                value={form.customer_id}
                onChange={chooseCustomer}
              />
              <Select
                label="Saved Quote Template"
                placeholder="Optional — start blank"
                searchable
                clearable
                data={templates.map((template) => ({
                  value: String(template.id),
                  label: `${template.template_name} — ${template.template_category}`,
                }))}
                value={form.template_id}
                onChange={(value) =>
                  setForm((current) => ({ ...current, template_id: value }))
                }
              />
              <TextInput
                label="Company Name"
                value={form.company_name}
                onChange={updateFormField("company_name")}
              />
              <TextInput
                label="Contact Name"
                value={form.contact_name}
                onChange={updateFormField("contact_name")}
              />
              <TextInput
                label="Phone"
                value={form.contact_phone}
                onChange={updateFormField("contact_phone")}
              />
              <TextInput
                label="Email"
                value={form.contact_email}
                onChange={updateFormField("contact_email")}
              />
              <TextInput
                label="Quote / Project Name"
                required
                value={form.project_name}
                onChange={updateFormField("project_name")}
              />
              <TextInput
                label="Quote Owner"
                value={form.assigned_to}
                onChange={updateFormField("assigned_to")}
              />
              <TextInput
                label="Billing / Project Address"
                value={form.billing_address}
                onChange={updateFormField("billing_address")}
              />
              <TextInput
                label="City"
                value={form.billing_city}
                onChange={updateFormField("billing_city")}
              />
              <TextInput
                label="State"
                value={form.billing_state}
                onChange={updateFormField("billing_state")}
              />
              <TextInput
                label="ZIP"
                value={form.billing_zip}
                onChange={updateFormField("billing_zip")}
              />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button
                variant="light"
                color="gray"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button
                color="red"
                loading={creating}
                onClick={createStandaloneQuote}
              >
                Create and Build Quote
              </Button>
            </Group>
          </Stack>
        </MWSection>
      )}

      <MWSection title="All Formal Quotes">
        <SimpleGrid cols={{ base: 1, md: 3 }} mb="md">
          <TextInput
            label="Search Quotes"
            placeholder="Quote #, customer, company, project, owner..."
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            label="Status"
            data={[
              "Open",
              "All",
              "Draft",
              "Ready for Review",
              "Sent",
              "Approved",
              "Declined",
              "Expired",
              "Cancelled",
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || "Open")}
            allowDeselect={false}
          />
          <Select
            label="Quote Type"
            data={["All", "Standalone Quote", "Project Quote"]}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value || "All")}
            allowDeselect={false}
          />
        </SimpleGrid>

        <Stack gap="sm">
          {filteredQuotes.map((quote) => (
            <Card key={quote.id} withBorder radius="md" p="md">
              <SimpleGrid
                cols={{ base: 1, sm: 2, lg: 6 }}
                spacing="md"
                verticalSpacing="sm"
              >
                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Quote
                  </Text>
                  <Text fw={900}>
                    {quote.quote_number || `Quote ${quote.id}`}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {quote.project_id ? "Project Quote" : "Standalone Quote"}
                  </Text>
                </div>

                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Customer / Company
                  </Text>
                  <Text fw={700}>
                    {quote.company_name ||
                      quote.customer_name ||
                      quote.contact_name ||
                      "Not entered"}
                  </Text>
                  {quote.contact_name && quote.company_name && (
                    <Text size="xs" c="dimmed">
                      {quote.contact_name}
                    </Text>
                  )}
                </div>

                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Quote For
                  </Text>
                  <Text fw={700}>
                    {quote.project_name || quote.quote_title || "Not entered"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Owner:{" "}
                    {quote.assigned_to || quote.prepared_by || "Unassigned"}
                  </Text>
                </div>

                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase" mb={4}>
                    Status
                  </Text>
                  <Badge color={statusColor(quote.status)}>
                    {quote.status || "Draft"}
                  </Badge>
                </div>

                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Total
                  </Text>
                  <Text fw={900}>{money(quote.total_amount)}</Text>
                  <Text size="xs" c="dimmed">
                    Valid through {formatDate(quote.valid_until)}
                  </Text>
                </div>

                <Group gap="xs" justify="flex-end" align="center" wrap="wrap">
                  <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    onClick={() => openQuote(quote, "quoteBuilder")}
                  >
                    Open Quote &amp; Mileage
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    onClick={() => openQuote(quote, "quotePreview")}
                  >
                    Preview
                  </Button>
                  <Button
                    size="xs"
                    color={approvalsByQuote[quote.id]?.status === "Approved" ? "green" : "violet"}
                    variant={approvalsByQuote[quote.id] ? "light" : "filled"}
                    onClick={() => openApprovalManager(quote)}
                  >
                    {approvalsByQuote[quote.id]?.status === "Approved"
                      ? "Signed Approval"
                      : approvalsByQuote[quote.id]
                        ? `Approval: ${approvalsByQuote[quote.id].status}`
                        : "Customer Approval"}
                  </Button>
                  {(quote.converted_project_id || quote.project_id) && (
                    <Button
                      size="xs"
                      color="blue"
                      onClick={() => openProject(quote)}
                    >
                      Open Project
                    </Button>
                  )}
                  {!quote.project_id &&
                    !quote.converted_project_id &&
                    quote.status === "Approved" && (
                      <Button
                        size="xs"
                        color="green"
                        onClick={() => beginConversion(quote)}
                      >
                        Convert
                      </Button>
                    )}
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    loading={deletingQuoteId === quote.id}
                    onClick={() => deleteQuote(quote)}
                  >
                    Delete Quote
                  </Button>
                </Group>
              </SimpleGrid>
            </Card>
          ))}

          {filteredQuotes.length === 0 && (
            <Card withBorder radius="md" p="xl">
              <Text ta="center" c="dimmed">
                No quotes match the current filters.
              </Text>
            </Card>
          )}
        </Stack>
      </MWSection>

      <Modal
        opened={Boolean(approvalQuote)}
        onClose={() => setApprovalQuote(null)}
        title="Customer Quote Approval"
        size="lg"
        centered
      >
        {approvalQuote && (
          <Stack>
            <Alert color="blue" title={`${approvalQuote.quote_number || `Quote ${approvalQuote.id}`} — ${approvalQuote.company_name || approvalQuote.customer_name || approvalQuote.contact_name || "Customer"}`}>
              Generate a private link, then paste it into Gmail. The customer reviews and signs inside Metal Worx OS, and the quote status updates automatically.
            </Alert>

            {approvalsByQuote[approvalQuote.id] && (
              <Card withBorder>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="xs" c="dimmed" fw={800}>LATEST APPROVAL</Text>
                    <Text fw={900}>Version {approvalsByQuote[approvalQuote.id].document_version}</Text>
                    <Text size="sm">Sent {formatDate(approvalsByQuote[approvalQuote.id].sent_at)}</Text>
                    <Text size="sm">Expires {formatDate(approvalsByQuote[approvalQuote.id].expires_at)}</Text>
                  </div>
                  <Badge color={statusColor(approvalsByQuote[approvalQuote.id].status)}>{approvalsByQuote[approvalQuote.id].status}</Badge>
                </Group>
                {approvalsByQuote[approvalQuote.id].signer_name && (
                  <Text mt="sm" size="sm">
                    Signed by <strong>{approvalsByQuote[approvalQuote.id].signer_name}</strong>
                    {approvalsByQuote[approvalQuote.id].signer_email ? ` (${approvalsByQuote[approvalQuote.id].signer_email})` : ""}
                    {approvalsByQuote[approvalQuote.id].approved_at ? ` on ${formatDate(approvalsByQuote[approvalQuote.id].approved_at)}` : ""}.
                  </Text>
                )}
                {approvalsByQuote[approvalQuote.id].customer_message && <Alert color="orange" mt="sm" title="Customer requested changes">{approvalsByQuote[approvalQuote.id].customer_message}</Alert>}
                {approvalsByQuote[approvalQuote.id].status === "Approved" && (
                  <Button mt="md" color="green" loading={approvalBusy} onClick={downloadSignedAgreement}>
                    Download Signed Agreement PDF
                  </Button>
                )}
              </Card>
            )}

            {!approvalLink && (
              <>
                <TextInput label="Customer email (for the approval record)" placeholder="customer@example.com" value={approvalEmail} onChange={(event) => setApprovalEmail(event.currentTarget.value)} />
                <NumberInput label="Link expires after" suffix=" days" min={1} max={60} value={approvalDays} onChange={(value) => setApprovalDays(Number(value) || 15)} />
                <Alert color="yellow" title="Creates a frozen version">
                  Creating a new link revokes any older open link. If the quote changes later, generate a new link so the customer approves the correct version.
                </Alert>
                <Button color="violet" loading={approvalBusy} onClick={createApprovalLink}>
                  {approvalsByQuote[approvalQuote.id] ? "Generate New Approval Link" : "Generate Customer Approval Link"}
                </Button>
              </>
            )}

            {approvalLink && (
              <>
                <TextInput label="Private customer link" value={approvalLink} readOnly />
                <Group grow><Button color="green" onClick={copyApprovalLink}>Copy Link for Gmail</Button><Button variant="light" color="blue" onClick={() => window.open(approvalLink, "_blank", "noopener,noreferrer")}>Preview Customer Page</Button></Group>
                <Alert color="yellow">For security, this link is shown only now. If it is lost, generate a new one; the old open link will be revoked.</Alert>
              </>
            )}

            {["Sent", "Viewed"].includes(approvalsByQuote[approvalQuote.id]?.status) && !approvalLink && (
              <Button variant="subtle" color="red" loading={approvalBusy} onClick={revokeApprovalLink}>Revoke Current Link</Button>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}

export default QuoteCenter;
