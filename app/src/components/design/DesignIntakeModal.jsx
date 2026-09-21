import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Button,
  Checkbox,
  FileButton,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconInfoCircle, IconUpload } from "@tabler/icons-react";

import { supabase } from "../../lib/supabase";
import { releaseCustomerOrder } from "../../lib/productionWorkflow";
import { notifyTeam } from "../../services/teamNotificationService";

const DEFAULT_FORM = {
  customerName: "",
  phone: "",
  email: "",
  dateOrdered: new Date(),
  dateRequested: null,
  projectName: "",
  description: "",
  specialInstructions: "",
  designSource: "New Design Required",
  designFeePaid: false,
  paymentMethod: "Card",
  assignedDesigner: "Kory",
  rush: false,
};

function clean(value) {
  return String(value || "").trim();
}

function dateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function uploadOrderImages(orderId, files, imageType = "Reference Image") {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const extension = file.name.split(".").pop();
    const stem = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-");
    const path = `${orderId}/${Date.now()}-${index}-${stem}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("order-reference-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("order-reference-images").getPublicUrl(path);
    const { error: imageError } = await supabase
      .from("customer_order_reference_images")
      .insert({
        customer_order_id: orderId,
        image_url: data.publicUrl,
        caption: file.name,
        image_type: imageType,
        show_on_work_order: true,
        sort_order: index + 1,
      });
    if (imageError) throw imageError;
  }
}

function DesignIntakeModal({ opened, onClose, onCreated, activeUser }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const resetFilePicker = useRef(null);

  useEffect(() => {
    if (opened) {
      setForm({ ...DEFAULT_FORM, dateOrdered: new Date() });
      setFiles([]);
      resetFilePicker.current?.();
    }
  }, [opened]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addReferenceImage(selected) {
    if (!selected) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(selected.type)) {
      notifications.show({
        title: "Image Type Not Supported",
        message: "Choose a JPG, PNG, or WebP image. Design files can be attached from the job after it is created.",
        color: "orange",
      });
      resetFilePicker.current?.();
      return;
    }
    setFiles((current) => [...current, selected]);
    resetFilePicker.current?.();
  }

  function removeReferenceImage(index) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  const needsDesign = form.designSource !== "Design Already on File";
  const feeRequired = form.designSource === "New Design Required";

  async function findOrCreateCustomer() {
    let customer = null;
    if (clean(form.email)) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", clean(form.email))
        .maybeSingle();
      if (error) throw error;
      customer = data;
    }
    if (!customer && clean(form.phone)) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", clean(form.phone))
        .maybeSingle();
      if (error) throw error;
      customer = data;
    }
    if (customer) return customer;

    const nameParts = clean(form.customerName).split(/\s+/);
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");
    const { data, error } = await supabase
      .from("customers")
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone: clean(form.phone) || null,
        email: clean(form.email) || null,
        customer_type: "Retail",
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function saveIntake() {
    if (!clean(form.customerName) || !clean(form.projectName) || !clean(form.description)) {
      notifications.show({
        title: "Missing Required Information",
        message: "Customer name, project name, and project description are required.",
        color: "red",
      });
      return;
    }
    if (!clean(form.phone) && !clean(form.email)) {
      notifications.show({
        title: "Contact Information Required",
        message: "Enter a phone number or email address.",
        color: "red",
      });
      return;
    }

    setSaving(true);
    try {
      const customer = await findOrCreateCustomer();
      const startingDepartment = needsDesign ? "Design" : "Laser";
      const orderNumber = `MW-${new Date().getFullYear()}-${Date.now()}`;
      const { data: order, error: orderError } = await supabase
        .from("customer_orders")
        .insert({
          order_number: orderNumber,
          customer_id: customer.id,
          status: needsDesign ? "Design Needed" : "Ready for Production",
          due_date: dateValue(form.dateRequested),
          rush: form.rush,
          notes: [
            `Date ordered: ${dateValue(form.dateOrdered) || "Not entered"}`,
            clean(form.specialInstructions) ? `Special instructions: ${clean(form.specialInstructions)}` : "",
          ].filter(Boolean).join("\n"),
          total_amount: 0,
          deposit_received: false,
          deposit_amount: 0,
          order_type: "Custom Artwork",
          order_owner: clean(form.assignedDesigner) || "Kory",
          design_needed: needsDesign,
          design_fee_required: feeRequired,
          design_fee_status: feeRequired ? (form.designFeePaid ? "Paid" : "Pending") : "Not Required",
          design_fee_amount: feeRequired ? 50 : 0,
          design_fee_paid: feeRequired && form.designFeePaid,
          design_fee_paid_at: feeRequired && form.designFeePaid ? new Date().toISOString() : null,
          design_status: needsDesign ? "Ready" : "Existing Design",
          design_notes: `${form.designSource}\n${clean(form.description)}`,
          starting_department: startingDepartment,
          fulfillment_method: "Pickup",
        })
        .select()
        .single();
      if (orderError) throw orderError;

      const { error: itemError } = await supabase.from("customer_order_items").insert({
        order_id: order.id,
        product_template_id: null,
        item_name: clean(form.projectName),
        description: clean(form.description),
        quantity: 1,
        unit_price: 0,
        notes: clean(form.specialInstructions) || null,
      });
      if (itemError) throw itemError;

      if (files.length) await uploadOrderImages(order.id, files);

      if (feeRequired && form.designFeePaid) {
        const { error: paymentError } = await supabase.rpc("record_customer_order_payment", {
          p_customer_order_id: order.id,
          p_payment_type: "Design Fee",
          p_amount: 50,
          p_payment_method: form.paymentMethod,
          p_payment_date: dateValue(form.dateOrdered) || dateValue(new Date()),
          p_reference_number: null,
          p_notes: "Recorded during Design Intake",
          p_recorded_by: clean(activeUser) || "Design Intake",
        });
        if (paymentError) throw paymentError;
      }

      await releaseCustomerOrder(order.id, startingDepartment, activeUser || "Design Intake");
      await notifyTeam({
        names: needsDesign ? ["Kory"] : [],
        departments: [startingDepartment],
        title: needsDesign ? "New Design Work Is Ready" : "Artwork Order Released to Laser",
        message: `${form.projectName} for ${form.customerName} is ready in ${startingDepartment}.`,
        sourceId: order.id,
        targetPage: needsDesign ? "designQueue" : "laserQueue",
        priority: form.rush ? "High" : "Medium",
      }).catch((notificationError) => console.warn("Design handoff notification failed", notificationError));
      notifications.show({
        title: needsDesign ? "Added to Design Queue" : "Released to Laser",
        message: needsDesign
          ? `${form.projectName} is ready for Kory or the design team.`
          : `${form.projectName} uses artwork on file and skipped Design.`,
        color: "green",
      });
      onCreated?.(order);
      onClose();
    } catch (error) {
      notifications.show({
        title: "Could Not Save Design Intake",
        message: error?.message || "The intake could not be saved.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Add Design Work" size="xl" centered>
      <Stack>
        <Alert icon={<IconInfoCircle />} color="blue">
          Start here for new artwork, changes to an existing design, or a customer-supplied file.
          Choose <b>Design Already on File</b> when the approved cut file already exists; that sends the order directly to Laser.
        </Alert>

        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <TextInput label="Customer Name" required value={form.customerName} onChange={(event) => update("customerName", event.currentTarget.value)} />
          <TextInput label="Phone" value={form.phone} onChange={(event) => update("phone", event.currentTarget.value)} />
          <TextInput label="Email" type="email" value={form.email} onChange={(event) => update("email", event.currentTarget.value)} />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <DateInput label="Date Ordered" value={form.dateOrdered} onChange={(value) => update("dateOrdered", value)} />
          <DateInput label="Date Requested" value={form.dateRequested} onChange={(value) => update("dateRequested", value)} clearable />
        </SimpleGrid>

        <TextInput label="Project / Item Name" required value={form.projectName} onChange={(event) => update("projectName", event.currentTarget.value)} />
        <Textarea label="Description of Project" required minRows={3} value={form.description} onChange={(event) => update("description", event.currentTarget.value)} />
        <Textarea label="Special Instructions" minRows={2} value={form.specialInstructions} onChange={(event) => update("specialInstructions", event.currentTarget.value)} />

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Select
            label="Artwork / Design Source"
            data={["New Design Required", "Existing Design With Changes", "Customer Supplied Finished File", "Design Already on File"]}
            value={form.designSource}
            onChange={(value) => update("designSource", value || "New Design Required")}
          />
          <Select label="Assigned Designer" data={["Kory", "Design Team", "Dan"]} value={form.assignedDesigner} onChange={(value) => update("assignedDesigner", value || "Kory")} />
        </SimpleGrid>

        <Stack gap={6}>
          <Text size="sm" fw={700}>
            {needsDesign ? "Customer Reference Images / Files" : "Existing Design Reference (Optional)"}
          </Text>
          <Group gap="sm" align="center">
            <FileButton
              resetRef={resetFilePicker}
              accept=".jpg,.jpeg,.png,.webp"
              onChange={addReferenceImage}
            >
              {(props) => (
                <Button {...props} variant="default" leftSection={<IconUpload size={16} />} disabled={saving}>
                  {files.length ? "Add Another Image" : "Add Image"}
                </Button>
              )}
            </FileButton>
            <Text size="sm" c="dimmed">
              {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "No files selected"}
            </Text>
            {files.length > 0 && (
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => {
                  setFiles([]);
                  resetFilePicker.current?.();
                }}
              >
                Clear
              </Button>
            )}
          </Group>
          {files.length > 0 && (
            <Stack gap={4}>
              {files.map((file, index) => (
                <Group key={`${file.name}-${file.lastModified}-${index}`} justify="space-between" gap="sm" wrap="nowrap">
                  <Text size="xs" c="dimmed" truncate>{file.name}</Text>
                  <Button size="compact-xs" variant="subtle" color="red" onClick={() => removeReferenceImage(index)}>
                    Remove
                  </Button>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>

        {feeRequired ? (
          <Stack gap="xs">
            <Checkbox label="$50 design fee has been paid" checked={form.designFeePaid} onChange={(event) => update("designFeePaid", event.currentTarget.checked)} />
            {form.designFeePaid && (
              <Select label="Payment Method" data={["Cash", "Card", "Check", "ACH", "Other"]} value={form.paymentMethod} onChange={(value) => update("paymentMethod", value || "Other")} />
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">No design fee will be charged for this artwork source.</Text>
        )}

        <Checkbox label="Rush / priority order" checked={form.rush} onChange={(event) => update("rush", event.currentTarget.checked)} />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="red" loading={saving} onClick={saveIntake}>Add to Workflow</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export { uploadOrderImages };
export default DesignIntakeModal;
