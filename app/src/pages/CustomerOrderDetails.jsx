import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Image,
  Loader,
  Modal,
  NumberInput,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBell,
  IconBuildingFactory2,
  IconCash,
  IconCheck,
  IconClipboardCheck,
  IconPackage,
  IconPrinter,
  IconReceipt,
  IconRefresh,
  IconTruckDelivery,
  IconUser,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not set";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function getCustomerName(customer) {
  if (!customer) return "No customer assigned";

  return (
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    customer.contact_name ||
    customer.name ||
    customer.company_name ||
    "Unnamed Customer"
  );
}

function getCustomerCompany(customer) {
  if (!customer?.company_name) return "";
  return customer.company_name === getCustomerName(customer)
    ? ""
    : customer.company_name;
}

function getOrderItemName(item) {
  return (
    item?.product_template?.name ||
    item?.design_name ||
    item?.item_name ||
    item?.description ||
    item?.notes ||
    "Product"
  );
}

function getOrderItemNames(items) {
  const names = (items || []).map(getOrderItemName).filter(Boolean);
  return names.length ? [...new Set(names)].join(" | ") : "Item not specified";
}

function getOrderTotal(order) {
  return Number(order?.order_total ?? order?.total_amount ?? 0);
}

function getDepositAmount(order) {
  return Number(order?.down_payment ?? order?.deposit_amount ?? 0);
}

function getRemainingBalance(order) {
  if (order?.balance_due !== null && order?.balance_due !== undefined) {
    return Math.max(Number(order.balance_due || 0), 0);
  }

  return Math.max(getOrderTotal(order) - getDepositAmount(order), 0);
}

function getStatusColor(status) {
  if (status === "Completed") return "green";
  if (status === "Production Complete") return "teal";
  if (status === "In Production") return "red";
  if (status === "Design Needed" || status === "In Design") return "orange";
  if (status === "On Hold") return "yellow";
  if (status === "Cancelled") return "gray";
  return "gray";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function CustomerOrderDetails({
  selectedCustomerOrder,
  setPage,
  activeUser = "",
}) {
  const [order, setOrder] = useState(selectedCustomerOrder || null);
  const [referenceImages, setReferenceImages] = useState([]);
  const [productionJob, setProductionJob] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentType: "Partial Payment",
    amount: "",
    paymentMethod: "Card",
    paymentDate: new Date().toISOString().slice(0, 10),
    referenceNumber: "",
    notes: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [closeout, setCloseout] = useState({
    fulfillmentMethod: "Pickup",
    readyNotificationSent: false,
    fulfillmentCompleted: false,
    finalPaymentReceived: false,
  });

  const loadOrder = useCallback(async () => {
    if (!selectedCustomerOrder?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const { data: orderData, error: orderError } = await supabase
        .from("customer_orders")
        .select("*")
        .eq("id", selectedCustomerOrder.id)
        .single();

      if (orderError) throw orderError;

      const [
        customerResult,
        itemsResult,
        imagesResult,
        jobsResult,
        paymentsResult,
      ] = await Promise.all([
        orderData.customer_id
          ? supabase
              .from("customers")
              .select("*")
              .eq("id", orderData.customer_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("customer_order_items")
          .select("*")
          .eq("order_id", orderData.id)
          .order("id", { ascending: true }),
        supabase
          .from("customer_order_reference_images")
          .select("*")
          .eq("customer_order_id", orderData.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("production_jobs")
          .select("*")
          .eq("customer_order_id", orderData.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("customer_order_payments")
          .select("*")
          .eq("customer_order_id", orderData.id)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      const relatedError =
        customerResult.error ||
        itemsResult.error ||
        imagesResult.error ||
        jobsResult.error ||
        paymentsResult.error;

      if (relatedError) throw relatedError;

      const items = itemsResult.data || [];
      const templateIds = [
        ...new Set(
          items.map((item) => item.product_template_id).filter(Boolean),
        ),
      ];

      let templatesById = {};
      if (templateIds.length) {
        const { data: templates, error: templatesError } = await supabase
          .from("product_templates")
          .select("*")
          .in("id", templateIds);

        if (templatesError) throw templatesError;

        templatesById = Object.fromEntries(
          (templates || []).map((template) => [template.id, template]),
        );
      }

      const hydratedOrder = {
        ...orderData,
        customer: customerResult.data || null,
        items: items.map((item) => ({
          ...item,
          product_template: templatesById[item.product_template_id] || null,
        })),
      };

      let loadedWorkOrders = [];
      if (jobsResult.data?.id) {
        const { data: workOrderData, error: workOrderError } = await supabase
          .from("work_orders")
          .select("*")
          .eq("production_job_id", jobsResult.data.id)
          .order("step_order", { ascending: true })
          .order("id", { ascending: true });

        if (workOrderError) throw workOrderError;
        loadedWorkOrders = workOrderData || [];
      }

      setOrder(hydratedOrder);
      setReferenceImages(imagesResult.data || []);
      setProductionJob(jobsResult.data || null);
      setWorkOrders(loadedWorkOrders);
      setPayments(paymentsResult.data || []);
      const loadedBalance = getRemainingBalance(orderData);
      setCloseout({
        fulfillmentMethod: orderData.fulfillment_method || "Pickup",
        readyNotificationSent: Boolean(orderData.ready_notification_sent),
        fulfillmentCompleted: Boolean(orderData.fulfillment_completed),
        finalPaymentReceived: loadedBalance <= 0,
      });
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.message || "The customer order could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerOrder?.id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const remainingBalance = getRemainingBalance(order);
  const paymentIsSatisfied = remainingBalance <= 0;
  const closeoutCompletedCount = useMemo(
    () =>
      [
        closeout.readyNotificationSent,
        closeout.fulfillmentCompleted,
        paymentIsSatisfied,
      ].filter(Boolean).length,
    [
      closeout.readyNotificationSent,
      closeout.fulfillmentCompleted,
      paymentIsSatisfied,
    ],
  );
  const closeoutReady =
    closeout.readyNotificationSent &&
    closeout.fulfillmentCompleted &&
    paymentIsSatisfied;
  const productionIsComplete =
    [
      "Production Complete",
      "Ready for Pickup",
      "Ready to Ship",
      "Ready for Installation",
      "Completed",
    ].includes(order?.status) ||
    Number(productionJob?.progress_percent || 0) >= 100;
  const orderIsCompleted = order?.status === "Completed";

  function openPaymentModal(type = "Partial Payment") {
    const suggestedAmount = type === "Final Payment" ? remainingBalance : "";

    setPaymentForm({
      paymentType: type,
      amount: suggestedAmount,
      paymentMethod: "Card",
      paymentDate: new Date().toISOString().slice(0, 10),
      referenceNumber: "",
      notes: "",
    });
    setPaymentModalOpen(true);
  }

  async function recordPayment() {
    if (!order?.id || recordingPayment) return;

    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      notifications.show({
        title: "Enter a Valid Amount",
        message: "Payment amount must be greater than zero.",
        color: "red",
      });
      return;
    }

    if (amount > remainingBalance + 0.005) {
      notifications.show({
        title: "Payment Exceeds Balance",
        message: `The most that can be recorded is ${formatMoney(remainingBalance)}.`,
        color: "red",
      });
      return;
    }

    if (!paymentForm.paymentDate) {
      notifications.show({
        title: "Payment Date Required",
        message: "Select the date the payment was received.",
        color: "red",
      });
      return;
    }

    setRecordingPayment(true);

    try {
      const { error: paymentError } = await supabase.rpc(
        "record_customer_order_payment",
        {
          p_customer_order_id: order.id,
          p_payment_type: paymentForm.paymentType,
          p_amount: amount,
          p_payment_method: paymentForm.paymentMethod,
          p_payment_date: paymentForm.paymentDate,
          p_reference_number: paymentForm.referenceNumber.trim() || null,
          p_notes: paymentForm.notes.trim() || null,
          p_recorded_by: activeUser || order.order_owner || "Metal Worx Team",
        },
      );

      if (paymentError) throw paymentError;

      notifications.show({
        title: "Payment Recorded",
        message: `${formatMoney(amount)} was applied to ${
          order.order_number || "the customer order"
        }.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });

      setPaymentModalOpen(false);
      await loadOrder();
    } catch (error) {
      notifications.show({
        title: "Payment Could Not Be Recorded",
        message: error?.message || "The payment was not saved.",
        color: "red",
      });
    } finally {
      setRecordingPayment(false);
    }
  }

  async function saveCloseout(finalize = false) {
    if (!order?.id || saving) return;

    if (finalize && !closeoutReady) {
      notifications.show({
        title: "Closeout Not Ready",
        message:
          "Complete the customer notification, pickup or delivery, and final payment first.",
        color: "red",
      });
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        "save_customer_order_closeout",
        {
          p_customer_order_id: order.id,
          p_fulfillment_method: closeout.fulfillmentMethod,
          p_ready_notification_sent: closeout.readyNotificationSent,
          p_fulfillment_completed: closeout.fulfillmentCompleted,
          p_final_payment_received: paymentIsSatisfied,
          p_finalize: finalize,
          p_closed_by: activeUser || order.order_owner || "Metal Worx Team",
        },
      );

      if (error) throw error;

      setOrder((current) => ({ ...current, ...(data || {}) }));

      notifications.show({
        title: finalize ? "Order Completed" : "Closeout Saved",
        message: finalize
          ? `${order.order_number || "Customer order"} is fully closed.`
          : "The office closeout progress was saved.",
        color: "green",
        icon: <IconCheck size={18} />,
      });

      await loadOrder();
    } catch (error) {
      notifications.show({
        title: finalize
          ? "Order Could Not Complete"
          : "Closeout Could Not Save",
        message: error.message,
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MWSection title="Customer Order">
        <Group justify="center" py="xl">
          <Loader color="red" />
          <Text c="dimmed">Loading customer order...</Text>
        </Group>
      </MWSection>
    );
  }

  if (!order) {
    return (
      <>
        <MWPageHeader
          title="Customer Order"
          subtitle="No customer order is selected."
          setPage={setPage}
          showBack
          backPage="customerOrders"
          backLabel="Customer Orders"
        />
        <MWSection title="Order Not Found">
          <Stack>
            {errorMessage && (
              <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                {errorMessage}
              </Alert>
            )}
            <Button color="red" onClick={() => setPage("customerOrders")}>
              Back to Customer Orders
            </Button>
          </Stack>
        </MWSection>
      </>
    );
  }

  const customer = order.customer;
  const items = order.items || [];
  const customerName = getCustomerName(customer);
  const companyName = getCustomerCompany(customer);
  const itemNames = getOrderItemNames(items);
  const orderTotal = getOrderTotal(order);
  const depositAmount = getDepositAmount(order);
  const amountPaid = Math.max(orderTotal - remainingBalance, 0);
  const orderDisplayName = `${customerName} - ${itemNames}`;
  const designIsComplete =
    Boolean(order.design_needed) &&
    (Boolean(productionJob) ||
      [
        "In Production",
        "Production Complete",
        "Ready for Pickup",
        "Ready to Ship",
        "Ready for Installation",
        "Completed",
      ].includes(order.status));
  const designStatusDisplay = !order.design_needed
    ? "Not Required"
    : designIsComplete
      ? "Completed"
      : order.design_status || "Design Needed";
  const designStatusColor =
    designStatusDisplay === "Completed"
      ? "green"
      : designStatusDisplay === "Not Required"
        ? "gray"
        : "orange";

  function printInternalOrderRecord() {
    const printWindow = window.open("", "_blank", "width=1050,height=800");
    if (!printWindow) {
      notifications.show({
        title: "Print Window Blocked",
        message: "Allow pop-ups for Metal Worx OS and try again.",
        color: "red",
      });
      return;
    }

    const itemRows = items.length
      ? items
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(getOrderItemName(item))}</td>
                <td>${escapeHtml(item.product_template?.category || "Order Item")}</td>
                <td class="center">${escapeHtml(item.quantity || 1)}</td>
                <td class="money">${escapeHtml(formatMoney(item.unit_price))}</td>
                <td>${escapeHtml(item.description || item.notes || "")}</td>
              </tr>`,
          )
          .join("")
      : `<tr><td colspan="5">No itemized product lines. Production job is connected.</td></tr>`;

    const productionRows = workOrders.length
      ? workOrders
          .map(
            (step) => `
              <tr>
                <td class="center">${escapeHtml(step.step_order || "")}</td>
                <td>${escapeHtml(step.step_name || step.department || "")}</td>
                <td>${escapeHtml(step.department || "")}</td>
                <td>${escapeHtml(step.status || "")}</td>
                <td>${escapeHtml(
                  formatDate(
                    step.started_at || step.start_time || step.started_on,
                    true,
                  ),
                )}</td>
                <td>${escapeHtml(
                  formatDate(
                    step.completed_at || step.end_time || step.completed_on,
                    true,
                  ),
                )}</td>
              </tr>`,
          )
          .join("")
      : `<tr><td colspan="6">No individual production steps recorded.</td></tr>`;

    const paymentRows = payments.length
      ? payments
          .map(
            (payment) => `
              <tr>
                <td>${escapeHtml(formatDate(payment.payment_date))}</td>
                <td>${escapeHtml(payment.payment_type)}</td>
                <td>${escapeHtml(payment.payment_method || "Other")}</td>
                <td>${escapeHtml(payment.reference_number || "")}</td>
                <td>${escapeHtml(payment.recorded_by || "Metal Worx Team")}</td>
                <td class="money">${escapeHtml(formatMoney(payment.amount))}</td>
              </tr>`,
          )
          .join("")
      : `<tr><td colspan="6">No itemized payments recorded.</td></tr>`;

    const imageCards = referenceImages.length
      ? referenceImages
          .map(
            (image) => `
              <figure>
                <img src="${escapeHtml(image.image_url)}" alt="${escapeHtml(
                  image.caption || "Reference image",
                )}" />
                <figcaption>${escapeHtml(
                  image.caption || "Reference Image",
                )}</figcaption>
              </figure>`,
          )
          .join("")
      : `<p class="empty">No reference images attached.</p>`;

    const generatedAt = new Date().toLocaleString();
    const fulfillmentLabel =
      order.fulfillment_method || closeout.fulfillmentMethod || "Pickup";

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(order.order_number || "Customer Order")} - Internal Order Record</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #151515;
              background: #fff;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11px;
              line-height: 1.35;
            }
            .record { width: 100%; max-width: 980px; margin: 0 auto; padding: 24px; }
            .header {
              display: grid;
              grid-template-columns: 150px 1fr auto;
              gap: 18px;
              align-items: center;
              border-bottom: 4px solid #c90018;
              padding-bottom: 16px;
            }
            .logo { width: 145px; max-height: 70px; object-fit: contain; }
            h1 { margin: 0; font-size: 25px; letter-spacing: .02em; }
            .eyebrow { color: #c90018; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
            .record-number { text-align: right; }
            .record-number strong { display: block; font-size: 17px; }
            .status { display: inline-block; margin-top: 5px; padding: 4px 9px; border-radius: 999px; background: #1e1e1e; color: #fff; font-weight: 800; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
            .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .box { border: 1px solid #c9c9c9; border-radius: 7px; padding: 11px; break-inside: avoid; }
            .label { color: #666; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
            .value { margin-top: 3px; font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
            section { margin-top: 18px; break-inside: avoid; }
            h2 { margin: 0 0 8px; padding-bottom: 5px; border-bottom: 2px solid #c90018; font-size: 15px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cfcfcf; padding: 6px 7px; vertical-align: top; }
            th { color: #fff; background: #222; font-size: 9px; letter-spacing: .04em; text-align: left; text-transform: uppercase; }
            td.center, th.center { text-align: center; }
            td.money, th.money { text-align: right; white-space: nowrap; }
            .check-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
            .check { border: 1px solid #bbb; border-radius: 6px; padding: 9px; text-align: center; font-weight: 800; }
            .check.done { border-color: #238636; background: #eaf7ed; color: #176326; }
            .notes { white-space: pre-wrap; overflow-wrap: anywhere; min-height: 45px; }
            .images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            figure { margin: 0; border: 1px solid #ccc; border-radius: 6px; padding: 6px; break-inside: avoid; }
            figure img { width: 100%; height: 150px; object-fit: contain; display: block; }
            figcaption { margin-top: 5px; text-align: center; font-size: 9px; color: #555; }
            .empty { color: #666; font-style: italic; }
            footer { margin-top: 22px; padding-top: 9px; border-top: 1px solid #aaa; color: #666; display: flex; justify-content: space-between; font-size: 9px; }
            @page { size: letter; margin: .42in; }
            @media print {
              .record { max-width: none; padding: 0; }
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <main class="record">
            <header class="header">
              <img class="logo" src="/metal_worx_header_logo_transparent(1).png" alt="Metal Worx" />
              <div>
                <div class="eyebrow">Internal Production Record</div>
                <h1>${escapeHtml(orderDisplayName)}</h1>
              </div>
              <div class="record-number">
                <span class="label">Order Number</span>
                <strong>${escapeHtml(order.order_number || `Order ${order.id}`)}</strong>
                <span class="status">${escapeHtml(order.status || "Unknown")}</span>
              </div>
            </header>

            <div class="grid">
              <div class="box">
                <div class="label">Customer</div>
                <div class="value">${escapeHtml(customerName)}</div>
                <div>${escapeHtml(companyName)}</div>
              </div>
              <div class="box">
                <div class="label">Contact</div>
                <div class="value">${escapeHtml(customer?.phone || order.phone || "Not provided")}</div>
                <div>${escapeHtml(customer?.email || order.email || "Not provided")}</div>
              </div>
            </div>

            <div class="grid three">
              <div class="box"><div class="label">Order Owner</div><div class="value">${escapeHtml(order.order_owner || "Unassigned")}</div></div>
              <div class="box"><div class="label">Due Date</div><div class="value">${escapeHtml(formatDate(order.due_date))}</div></div>
              <div class="box"><div class="label">Production Job</div><div class="value">${escapeHtml(productionJob?.production_job_number || "Not connected")}</div></div>
              <div class="box"><div class="label">Order Total</div><div class="value">${escapeHtml(formatMoney(orderTotal))}</div></div>
              <div class="box"><div class="label">Amount Paid</div><div class="value">${escapeHtml(formatMoney(amountPaid))}</div></div>
              <div class="box"><div class="label">Remaining Balance</div><div class="value">${escapeHtml(formatMoney(remainingBalance))}</div></div>
            </div>

            <section>
              <h2>Products / Items</h2>
              <table>
                <thead><tr><th>Product</th><th>Category</th><th class="center">Qty</th><th class="money">Unit Price</th><th>Instructions</th></tr></thead>
                <tbody>${itemRows}</tbody>
              </table>
            </section>

            <section>
              <h2>Production Route</h2>
              <table>
                <thead><tr><th class="center">Step</th><th>Work</th><th>Department</th><th>Status</th><th>Started</th><th>Completed</th></tr></thead>
                <tbody>${productionRows}</tbody>
              </table>
            </section>

            <section>
              <h2>Payment History</h2>
              <table>
                <thead><tr><th>Payment Date</th><th>Type</th><th>Method</th><th>Reference</th><th>Recorded By</th><th class="money">Amount</th></tr></thead>
                <tbody>${paymentRows}</tbody>
              </table>
            </section>

            <section>
              <h2>Office Closeout</h2>
              <div class="check-grid">
                <div class="check ${order.ready_notification_sent ? "done" : ""}">${order.ready_notification_sent ? "Customer Notified" : "Notification Pending"}</div>
                <div class="check ${order.fulfillment_completed ? "done" : ""}">${order.fulfillment_completed ? `${escapeHtml(fulfillmentLabel)} Complete` : `${escapeHtml(fulfillmentLabel)} Pending`}</div>
                <div class="check ${paymentIsSatisfied ? "done" : ""}">${paymentIsSatisfied ? "Paid in Full" : `Balance ${escapeHtml(formatMoney(remainingBalance))}`}</div>
              </div>
              <div class="grid">
                <div class="box"><div class="label">Notified</div><div class="value">${escapeHtml(formatDate(order.ready_notification_sent_at, true))}</div></div>
                <div class="box"><div class="label">Fulfilled</div><div class="value">${escapeHtml(formatDate(order.fulfilled_at, true))}</div></div>
                <div class="box"><div class="label">Closed</div><div class="value">${escapeHtml(formatDate(order.closed_at, true))}</div></div>
                <div class="box"><div class="label">Closed By</div><div class="value">${escapeHtml(order.closed_by || "Not recorded")}</div></div>
              </div>
            </section>

            <section>
              <h2>Design & Order Notes</h2>
              <div class="grid">
                <div class="box"><div class="label">Design Status</div><div class="value">${escapeHtml(designStatusDisplay)}</div><div class="notes">${escapeHtml(order.design_notes || "No design notes.")}</div></div>
                <div class="box"><div class="label">Order Notes</div><div class="notes">${escapeHtml(order.notes || "No order notes.")}</div></div>
              </div>
            </section>

            <section>
              <h2>Reference Images</h2>
              <div class="images">${imageCards}</div>
            </section>

            <footer>
              <span>Metal Worx OS · Internal Production Record</span>
              <span>Generated ${escapeHtml(generatedAt)}</span>
            </footer>
          </main>
          <script>
            window.addEventListener("load", function () {
              window.setTimeout(function () { window.print(); }, 500);
            });
          </script>
        </body>
      </html>`);
    printWindow.document.close();
  }

  return (
    <Stack gap="lg">
      <MWPageHeader
        title={orderDisplayName}
        subtitle={[
          companyName,
          order.order_number || "Customer Order",
          order.status,
        ]
          .filter(Boolean)
          .join(" | ")}
        setPage={setPage}
        showBack
        backPage="customerOrders"
        backLabel="Customer Orders"
      />

      {errorMessage && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Order Warning"
        >
          {errorMessage}
        </Alert>
      )}

      <MWSection
        title="Order Command Center"
        subtitle="Customer, production, payment, and closeout status"
        rightSection={
          <Group gap="sm">
            <Button
              variant="light"
              color="gray"
              leftSection={<IconPrinter size={17} />}
              onClick={printInternalOrderRecord}
            >
              Export Record PDF
            </Button>
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconRefresh size={17} />}
              onClick={loadOrder}
            >
              Refresh
            </Button>
          </Group>
        }
      >
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Card withBorder radius="lg" p="md">
            <Text size="xs" fw={800} c="dimmed">
              ORDER STATUS
            </Text>
            <Badge color={getStatusColor(order.status)} size="lg" mt="xs">
              {order.status || "New"}
            </Badge>
          </Card>

          <Card withBorder radius="lg" p="md">
            <Text size="xs" fw={800} c="dimmed">
              PRODUCTION
            </Text>
            <Title order={3} mt={4}>
              {productionJob
                ? `${productionJob.progress_percent || 0}%`
                : "Not built"}
            </Title>
            <Text size="sm" c="dimmed">
              {productionJob?.production_job_number || "No production job"}
            </Text>
          </Card>

          <Card withBorder radius="lg" p="md">
            <Text size="xs" fw={800} c="dimmed">
              REMAINING BALANCE
            </Text>
            <Title order={3} mt={4}>
              {formatMoney(remainingBalance)}
            </Title>
            <Text size="sm" c="dimmed">
              Total {formatMoney(orderTotal)}
            </Text>
          </Card>

          <Card withBorder radius="lg" p="md">
            <Text size="xs" fw={800} c="dimmed">
              CLOSEOUT
            </Text>
            <Group justify="space-between" mt={4} mb="xs">
              <Title order={3}>{closeoutCompletedCount}/3</Title>
              <Text size="sm" c="dimmed">
                requirements
              </Text>
            </Group>
            <Progress
              value={(closeoutCompletedCount / 3) * 100}
              color={closeoutReady ? "green" : "red"}
              size="md"
              radius="xl"
            />
          </Card>
        </SimpleGrid>
      </MWSection>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <MWSection
          title="Customer & Order"
          subtitle="Order contact and responsibility"
        >
          <Stack gap="md">
            <Group gap="sm" align="flex-start">
              <ThemeIcon color="red" variant="light" size="lg" radius="md">
                <IconUser size={20} />
              </ThemeIcon>
              <div>
                <Title order={3}>{customerName}</Title>
                {companyName && <Text fw={700}>{companyName}</Text>}
                <Text c="dimmed">
                  {order.order_number || "Customer Order"} |{" "}
                  {order.order_type || "Standard Product"}
                </Text>
              </div>
            </Group>
            <Divider />
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="xs" fw={800} c="dimmed">
                  PHONE
                </Text>
                <Text fw={700}>{customer?.phone || "Not set"}</Text>
              </div>
              <div>
                <Text size="xs" fw={800} c="dimmed">
                  EMAIL
                </Text>
                <Text fw={700}>{customer?.email || "Not set"}</Text>
              </div>
              <div>
                <Text size="xs" fw={800} c="dimmed">
                  ORDER OWNER
                </Text>
                <Text fw={700}>{order.order_owner || "Unassigned"}</Text>
              </div>
              <div>
                <Text size="xs" fw={800} c="dimmed">
                  DUE DATE
                </Text>
                <Text fw={700}>{formatDate(order.due_date)}</Text>
              </div>
            </SimpleGrid>
          </Stack>
        </MWSection>

        <MWSection
          title="Payment Summary"
          subtitle="Order value and recorded payments"
          rightSection={
            !orderIsCompleted ? (
              <Button
                color="green"
                leftSection={<IconCash size={18} />}
                disabled={remainingBalance <= 0}
                onClick={() =>
                  openPaymentModal(
                    remainingBalance > 0 && remainingBalance < orderTotal
                      ? "Final Payment"
                      : "Partial Payment",
                  )
                }
              >
                Record Payment
              </Button>
            ) : null
          }
        >
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Card withBorder radius="lg" p="md">
              <Text size="xs" fw={800} c="dimmed">
                ORDER TOTAL
              </Text>
              <Title order={3}>{formatMoney(orderTotal)}</Title>
            </Card>
            <Card withBorder radius="lg" p="md">
              <Text size="xs" fw={800} c="dimmed">
                AMOUNT PAID
              </Text>
              <Title order={3} c={amountPaid > 0 ? "green.4" : undefined}>
                {formatMoney(amountPaid)}
              </Title>
            </Card>
            <Card withBorder radius="lg" p="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" fw={800} c="dimmed">
                    REMAINING BALANCE
                  </Text>
                  <Title
                    order={3}
                    c={remainingBalance > 0 ? "red.4" : "green.4"}
                  >
                    {formatMoney(remainingBalance)}
                  </Title>
                </div>
                <IconCash
                  size={28}
                  color={remainingBalance > 0 ? "#ff2b2b" : "#2ecc71"}
                />
              </Group>
            </Card>
          </SimpleGrid>
          {depositAmount > 0 && (
            <Text size="sm" c="dimmed" mt="md">
              Deposit reflected on order: {formatMoney(depositAmount)}
            </Text>
          )}
        </MWSection>
      </SimpleGrid>

      <MWSection
        title="Payment History"
        subtitle={`${payments.length} recorded payment${payments.length === 1 ? "" : "s"}`}
        rightSection={
          !orderIsCompleted && remainingBalance > 0 ? (
            <Button
              variant="light"
              color="green"
              leftSection={<IconReceipt size={18} />}
              onClick={() => openPaymentModal("Partial Payment")}
            >
              Add Payment
            </Button>
          ) : null
        }
      >
        {payments.length === 0 ? (
          <Card withBorder radius="lg" p="xl">
            <Stack align="center" gap="xs">
              <ThemeIcon color="gray" variant="light" size="xl" radius="xl">
                <IconReceipt size={24} />
              </ThemeIcon>
              <Text fw={700}>No itemized payments recorded yet</Text>
              <Text size="sm" c="dimmed" ta="center">
                Existing amounts reflected in the order balance remain included
                in Amount Paid. New payments will appear here with their payment
                dates and details.
              </Text>
            </Stack>
          </Card>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="sm" miw={850}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Payment Date</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Reference / Check #</Table.Th>
                  <Table.Th>Notes</Table.Th>
                  <Table.Th>Recorded By</Table.Th>
                  <Table.Th>Entered</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {payments.map((payment) => (
                  <Table.Tr key={payment.id}>
                    <Table.Td fw={700}>
                      {formatDate(payment.payment_date)}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          payment.payment_type === "Final Payment"
                            ? "green"
                            : "gray"
                        }
                      >
                        {payment.payment_type}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{payment.payment_method || "Other"}</Table.Td>
                    <Table.Td>{payment.reference_number || "-"}</Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2}>
                        {payment.notes || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {payment.recorded_by || "Metal Worx Team"}
                    </Table.Td>
                    <Table.Td>{formatDate(payment.created_at, true)}</Table.Td>
                    <Table.Td ta="right" fw={800} c="green.4">
                      {formatMoney(payment.amount)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </MWSection>

      <MWSection
        title="Office Closeout"
        subtitle="Production completion does not close the customer order until all three requirements are recorded"
      >
        {!productionIsComplete && (
          <Alert
            color="orange"
            icon={<IconBuildingFactory2 size={20} />}
            mb="lg"
          >
            Closeout controls become available after production reaches
            Production Complete.
          </Alert>
        )}

        {orderIsCompleted && (
          <Alert
            color="green"
            icon={<IconCheck size={20} />}
            mb="lg"
            title="Order Fully Completed"
          >
            Closed {formatDate(order.closed_at, true)}
            {order.closed_by ? ` by ${order.closed_by}` : ""}.
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
          <Card withBorder radius="lg" p="lg">
            <Stack>
              <Group gap="sm">
                <ThemeIcon color="red" variant="light" size="lg" radius="md">
                  <IconBell size={20} />
                </ThemeIcon>
                <div>
                  <Title order={4}>Customer Notified</Title>
                  <Text size="sm" c="dimmed">
                    Customer was told the order is ready.
                  </Text>
                </div>
              </Group>
              <Switch
                size="md"
                label="Ready notification sent"
                checked={closeout.readyNotificationSent}
                disabled={!productionIsComplete || orderIsCompleted}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setCloseout((current) => ({
                    ...current,
                    readyNotificationSent: checked,
                  }));
                }}
              />
              {order.ready_notification_sent_at && (
                <Text size="xs" c="dimmed">
                  Recorded {formatDate(order.ready_notification_sent_at, true)}
                </Text>
              )}
            </Stack>
          </Card>

          <Card withBorder radius="lg" p="lg">
            <Stack>
              <Group gap="sm">
                <ThemeIcon color="red" variant="light" size="lg" radius="md">
                  <IconTruckDelivery size={20} />
                </ThemeIcon>
                <div>
                  <Title order={4}>Pickup / Delivery</Title>
                  <Text size="sm" c="dimmed">
                    Record how the order left Metal Worx.
                  </Text>
                </div>
              </Group>
              <Select
                label="Fulfillment Method"
                data={["Pickup", "Delivery"]}
                value={closeout.fulfillmentMethod}
                disabled={!productionIsComplete || orderIsCompleted}
                onChange={(value) =>
                  setCloseout((current) => ({
                    ...current,
                    fulfillmentMethod: value || "Pickup",
                  }))
                }
              />
              <Switch
                size="md"
                label={`${closeout.fulfillmentMethod} completed`}
                checked={closeout.fulfillmentCompleted}
                disabled={!productionIsComplete || orderIsCompleted}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setCloseout((current) => ({
                    ...current,
                    fulfillmentCompleted: checked,
                  }));
                }}
              />
              {order.fulfilled_at && (
                <Text size="xs" c="dimmed">
                  Recorded {formatDate(order.fulfilled_at, true)}
                </Text>
              )}
            </Stack>
          </Card>

          <Card withBorder radius="lg" p="lg">
            <Stack>
              <Group gap="sm">
                <ThemeIcon color="red" variant="light" size="lg" radius="md">
                  <IconCash size={20} />
                </ThemeIcon>
                <div>
                  <Title order={4}>Final Payment</Title>
                  <Text size="sm" c="dimmed">
                    Confirm the remaining balance was received.
                  </Text>
                </div>
              </Group>
              <Text fw={800} size="lg">
                Balance: {formatMoney(remainingBalance)}
              </Text>
              <Badge
                size="lg"
                color={paymentIsSatisfied ? "green" : "red"}
                variant="light"
              >
                {paymentIsSatisfied ? "Paid in Full" : "Payment Required"}
              </Badge>
              {!paymentIsSatisfied && !orderIsCompleted && (
                <Button
                  color="green"
                  variant="light"
                  leftSection={<IconCash size={18} />}
                  onClick={() => openPaymentModal("Final Payment")}
                >
                  Record Final Payment
                </Button>
              )}
              {order.final_payment_received_at && (
                <Text size="xs" c="dimmed">
                  Recorded {formatDate(order.final_payment_received_at, true)}
                </Text>
              )}
            </Stack>
          </Card>
        </SimpleGrid>

        {productionIsComplete && !orderIsCompleted && (
          <Group justify="flex-end" mt="lg" wrap="wrap">
            <Button
              variant="light"
              color="gray"
              loading={saving}
              onClick={() => saveCloseout(false)}
            >
              Save Closeout Progress
            </Button>
            <Button
              color="green"
              loading={saving}
              disabled={!closeoutReady}
              leftSection={<IconClipboardCheck size={18} />}
              onClick={() => saveCloseout(true)}
            >
              Complete Customer Order
            </Button>
          </Group>
        )}
      </MWSection>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <MWSection
          title="Products / Items"
          subtitle={`${items.length} order line${items.length === 1 ? "" : "s"}`}
        >
          <Stack>
            {items.length === 0 && !productionJob ? (
              <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
                No product is attached. Add a product before production.
              </Alert>
            ) : items.length === 0 ? (
              <Card withBorder radius="lg" p="xl">
                <Stack align="center" gap="xs">
                  <ThemeIcon
                    color="green"
                    variant="light"
                    size="xl"
                    radius="xl"
                  >
                    <IconCheck size={24} />
                  </ThemeIcon>
                  <Text fw={700}>Production is connected</Text>
                  <Text size="sm" c="dimmed" ta="center">
                    This legacy order has no itemized product lines, but its
                    production job is already connected.
                  </Text>
                </Stack>
              </Card>
            ) : (
              items.map((item) => (
                <Card key={item.id} withBorder radius="lg" p="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Title order={4}>{getOrderItemName(item)}</Title>
                      <Text size="sm" c="dimmed">
                        {item.product_template?.category || "Order Item"}
                      </Text>
                    </div>
                    <Badge color="gray">Qty {item.quantity || 1}</Badge>
                  </Group>
                  <Text mt="sm" fw={700}>
                    Unit Price: {formatMoney(item.unit_price)}
                  </Text>
                </Card>
              ))
            )}
          </Stack>
        </MWSection>

        <MWSection
          title="Design & Notes"
          subtitle="Artwork and production instructions"
        >
          <Stack>
            <Card withBorder radius="lg" p="md">
              <Group justify="space-between">
                <Text fw={700}>Design Status</Text>
                <Badge color={designStatusColor} variant="light">
                  {designStatusDisplay}
                </Badge>
              </Group>
              <Text mt="sm" style={{ whiteSpace: "pre-wrap" }}>
                {order.design_notes || "No design notes."}
              </Text>
            </Card>
            <Card withBorder radius="lg" p="md">
              <Text size="xs" fw={800} c="dimmed">
                ORDER NOTES
              </Text>
              <Text mt="xs" style={{ whiteSpace: "pre-wrap" }}>
                {order.notes || "No order notes."}
              </Text>
            </Card>
          </Stack>
        </MWSection>
      </SimpleGrid>

      <MWSection
        title="Reference Images"
        subtitle={`${referenceImages.length} image${referenceImages.length === 1 ? "" : "s"}`}
      >
        {referenceImages.length === 0 ? (
          <Card withBorder radius="lg" p="xl">
            <Text c="dimmed" ta="center">
              No reference images uploaded.
            </Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {referenceImages.map((image) => (
              <Card key={image.id} withBorder radius="lg" p="sm">
                <Card.Section>
                  <Image
                    src={image.image_url}
                    alt={image.caption || "Reference image"}
                    h={220}
                    fit="contain"
                  />
                </Card.Section>
                <Text size="sm" mt="sm">
                  {image.caption || "Reference Image"}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </MWSection>

      <Modal
        opened={paymentModalOpen}
        onClose={() => !recordingPayment && setPaymentModalOpen(false)}
        title={
          <Text fw={800} c="white" size="lg">
            Record Customer Payment
          </Text>
        }
        centered
        size="lg"
        closeOnClickOutside={!recordingPayment}
        closeOnEscape={!recordingPayment}
        styles={{
          header: { backgroundColor: "#242424" },
          content: { backgroundColor: "#242424" },
          body: { backgroundColor: "#242424" },
          close: { color: "#ffffff" },
        }}
      >
        <Stack gap="md">
          <Alert color="blue" icon={<IconCash size={20} />}>
            Remaining balance: <strong>{formatMoney(remainingBalance)}</strong>
          </Alert>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Payment Type"
              required
              data={[
                "Design Fee",
                "Deposit",
                "Partial Payment",
                "Final Payment",
              ]}
              value={paymentForm.paymentType}
              onChange={(value) => {
                const paymentType = value || "Partial Payment";
                setPaymentForm((current) => ({
                  ...current,
                  paymentType,
                  amount:
                    paymentType === "Final Payment"
                      ? remainingBalance
                      : current.amount,
                }));
              }}
            />

            <NumberInput
              label="Amount"
              required
              prefix="$"
              min={0.01}
              max={remainingBalance}
              decimalScale={2}
              fixedDecimalScale
              value={paymentForm.amount}
              onChange={(value) =>
                setPaymentForm((current) => ({ ...current, amount: value }))
              }
            />

            <Select
              label="Payment Method"
              required
              data={["Cash", "Card", "Check", "ACH", "Other"]}
              value={paymentForm.paymentMethod}
              onChange={(value) =>
                setPaymentForm((current) => ({
                  ...current,
                  paymentMethod: value || "Other",
                }))
              }
            />

            <TextInput
              label="Payment Date"
              type="date"
              required
              styles={{ input: { colorScheme: "dark" } }}
              value={paymentForm.paymentDate}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  paymentDate: event.currentTarget.value,
                }))
              }
            />
          </SimpleGrid>

          <TextInput
            label="Reference / Check Number"
            placeholder="Optional receipt, transaction, or check number"
            value={paymentForm.referenceNumber}
            onChange={(event) =>
              setPaymentForm((current) => ({
                ...current,
                referenceNumber: event.currentTarget.value,
              }))
            }
          />

          <Textarea
            label="Notes"
            placeholder="Optional payment notes"
            minRows={3}
            autosize
            value={paymentForm.notes}
            onChange={(event) =>
              setPaymentForm((current) => ({
                ...current,
                notes: event.currentTarget.value,
              }))
            }
          />

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              disabled={recordingPayment}
              onClick={() => setPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="green"
              loading={recordingPayment}
              leftSection={<IconCash size={18} />}
              onClick={recordPayment}
            >
              Record Payment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default CustomerOrderDetails;
