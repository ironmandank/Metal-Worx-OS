import { useMemo, useState } from "react";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  List,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconBook2,
  IconBuildingFactory2,
  IconCalendarEvent,
  IconCash,
  IconChecks,
  IconFileInvoice,
  IconHelp,
  IconHome,
  IconMessageReport,
  IconPackage,
  IconPhone,
  IconSearch,
  IconSettings,
  IconShoppingCart,
  IconTool,
  IconUsers,
} from "@tabler/icons-react";

const CATEGORIES = [
  { id: "all", label: "All Guides", icon: IconBook2, color: "red" },
  { id: "start", label: "Start Here", icon: IconHome, color: "blue" },
  { id: "sales", label: "Orders & Customers", icon: IconShoppingCart, color: "red" },
  { id: "outside", label: "Outside Projects", icon: IconTool, color: "orange" },
  { id: "quotes", label: "Quotes", icon: IconFileInvoice, color: "grape" },
  { id: "production", label: "Production", icon: IconBuildingFactory2, color: "cyan" },
  { id: "inventory", label: "Inventory", icon: IconPackage, color: "yellow" },
  { id: "office", label: "Office & Management", icon: IconUsers, color: "green" },
];

const ARTICLES = [
  {
    id: "sign-in-navigation",
    category: "start",
    title: "Signing In and Navigating Metal Worx OS",
    summary: "Access the live system, understand the navigation, and safely end a session.",
    purpose: "Use this guide when opening Metal Worx OS for the first time or when helping another employee get started.",
    required: ["An active employee login", "The production URL", "A supported browser such as Edge or Chrome"],
    steps: [
      "Open the official Metal Worx OS production URL.",
      "Enter the employee email and password issued by the office.",
      "Use the left navigation groups to open Office, Sales, Outside, Inventory, Production, Stations, and Setup.",
      "Use the back arrow inside a page when available instead of the browser Back button.",
      "Refresh a page when a recently completed action has not appeared yet.",
      "Sign out from the lower-left account control when using a shared workstation.",
    ],
    next: "Open the Operations Command Center and review the current workload before starting work.",
    mistakes: [
      "Sharing employee passwords",
      "Leaving a shared workstation signed in",
      "Using an old localhost address instead of the production URL",
    ],
    related: ["Operations Command Center", "Employee Logins", "Pilot Feedback"],
  },
  {
    id: "command-center",
    category: "start",
    title: "Operations Command Center",
    summary: "Read the dashboard counts, commitments, workflow queues, and office closeout.",
    purpose: "The Command Center is the starting point for understanding what requires attention across Metal Worx.",
    required: ["A current employee login", "Accurate order, project, and production statuses"],
    steps: [
      "Review the top counts for open work, overdue actions, visits, installs, and production.",
      "Review Today's Commitments and Hot Today items before normal-priority work.",
      "Use the In-Shop Orders and Outside Projects toggle to review the correct workflow.",
      "Select a workflow stage to filter the queue beneath it.",
      "Open the Office Closeout queue to finish completed internal and outside work.",
      "Use Open Production Control when starting or completing fabrication work.",
    ],
    next: "Open the specific order, project, commitment, or closeout item requiring action.",
    mistakes: [
      "Treating dashboard counts as a substitute for updating the underlying record",
      "Leaving completed work in an active status",
      "Starting lower-priority work before checking commitments",
    ],
    related: ["Production Control", "Hot Today", "Office Closeout"],
  },
  {
    id: "customers",
    category: "sales",
    title: "Creating and Maintaining Customers",
    summary: "Create one reliable customer record and keep contact information current.",
    purpose: "Customer records connect internal orders, outside projects, quotes, contact information, and history.",
    required: ["Customer or company name", "Primary contact", "Phone or email when available"],
    steps: [
      "Open Sales, then Customers.",
      "Search before creating a customer to prevent duplicate records.",
      "Create the customer and enter the best available contact information.",
      "Use the company name for commercial accounts and the contact name for the individual representative.",
      "Open the customer record to review connected orders and activity.",
      "Update the existing customer rather than creating a second version when information changes.",
    ],
    next: "Create the internal order, outside project, or standalone quote associated with the customer.",
    mistakes: ["Creating duplicate customers", "Using a project name as the customer name", "Leaving all contact methods blank"],
    related: ["New Internal Order", "Outside Project Intake", "Standalone Quotes"],
  },
  {
    id: "new-internal-order",
    category: "sales",
    title: "Creating an Internal Customer Order",
    summary: "Create an in-shop order with products, design needs, due dates, notes, and images.",
    purpose: "Use an internal customer order for work produced primarily through the Metal Worx shop workflow.",
    required: [
      "Customer",
      "Requested product or custom item",
      "Quantity",
      "Due date or customer commitment",
      "Design and reference information",
    ],
    steps: [
      "Open Sales, then New Order.",
      "Select an existing customer or create the customer.",
      "Add every requested item and quantity.",
      "Record dimensions, material, finish, wording, artwork, and other production instructions.",
      "Attach customer reference images when available.",
      "Select the correct starting department and required workflow stages.",
      "Record order totals and payment requirements.",
      "Review the complete order before saving.",
    ],
    next: "Complete required design, approval, and payment steps, then release the order to production.",
    mistakes: [
      "Saving a custom item without dimensions",
      "Using notes instead of individual item lines for multiple products",
      "Releasing work before customer approval",
    ],
    related: ["Customer Order Details", "Recording Payments", "Releasing Internal Work"],
  },
  {
    id: "internal-order-details",
    category: "sales",
    title: "Managing Customer Order Details",
    summary: "Review products, notes, images, design status, payment, and production connection.",
    purpose: "The order detail page is the authoritative record for an internal order.",
    required: ["An existing customer order"],
    steps: [
      "Open Sales, then Customer Orders.",
      "Search by customer, order number, status, or assignment.",
      "Open the order and confirm the customer, products, quantities, due date, and notes.",
      "Review reference images and design requirements.",
      "Confirm payment history and remaining balance.",
      "Review the connected production job after release.",
      "Export or print the order PDF when a physical record is needed.",
    ],
    next: "Complete the next required action shown by the order status.",
    mistakes: ["Editing the wrong customer order", "Ignoring a remaining balance", "Creating a second production job"],
    related: ["Design Queue", "Production Control", "Office Closeout"],
  },
  {
    id: "record-order-payment",
    category: "sales",
    title: "Recording Internal Order Payments",
    summary: "Record design fees, deposits, partial payments, and final payments.",
    purpose: "Payment history must match money actually received and controls final closeout readiness.",
    required: ["Payment type", "Amount", "Method", "Payment date", "Reference number when available"],
    steps: [
      "Open the customer order.",
      "Select Record Payment.",
      "Choose Design Fee, Deposit, Partial Payment, or Final Payment.",
      "Enter the exact amount and payment method.",
      "Confirm the payment date and add the receipt, check, or transaction reference.",
      "Add a short note when clarification may be needed later.",
      "Save and verify the amount paid and remaining balance.",
    ],
    next: "When the balance reaches zero, confirm that the order displays Paid in Full.",
    mistakes: ["Recording promised money as received", "Using the wrong payment type", "Entering the order total instead of the payment amount"],
    related: ["Customer Order Details", "Office Closeout", "Payment History"],
  },
  {
    id: "outside-intake",
    category: "outside",
    title: "Creating an Outside Project",
    summary: "Set up site work, field fabrication, installation, and other outside workflows.",
    purpose: "Use an outside project when the work involves a customer site, field measurements, installation, or a multi-stage fabrication project.",
    required: [
      "Customer or company",
      "Project name",
      "Contact information",
      "Job address",
      "Assigned owner",
      "Required workflow stages",
    ],
    steps: [
      "Open Outside, then create a new project.",
      "Select or create the customer.",
      "Enter the project name, contact, address, owner, priority, and target date.",
      "Mark whether site visit, measurements, quote, design, fabrication, test fit, finish, assembly, and installation are required.",
      "Enter finish type and installation notes when known.",
      "Save the project and review the generated workflow.",
    ],
    next: "Complete the first required workflow action, usually a site visit, measurements, or quote.",
    mistakes: ["Marking every stage required by default", "Omitting the job address", "Using an internal order for installation work"],
    related: ["Site Visits", "Outside Quote", "Production Readiness"],
  },
  {
    id: "site-visit",
    category: "outside",
    title: "Scheduling and Completing a Site Visit",
    summary: "Schedule field measurements and document the results needed for quoting or design.",
    purpose: "Site visits create a clear field commitment and provide the information required to quote and fabricate correctly.",
    required: ["Project", "Site address", "Date and time", "Assigned employee", "Customer contact"],
    steps: [
      "Open the outside project and choose Schedule or the site-visit action.",
      "Confirm the address, customer contact, start time, expected duration, and assigned employee.",
      "Add access instructions, measurement needs, and known site conditions.",
      "After the visit, record measurements, photos, notes, and customer decisions.",
      "Mark the site visit complete only after the information is saved.",
      "Update the next action to quote, design, or another required step.",
    ],
    next: "Prepare the formal quote or design using the verified field information.",
    mistakes: ["Completing the visit before notes are saved", "Failing to record access restrictions", "Keeping a completed visit in the active schedule"],
    related: ["Field Schedule", "Quote Builder", "Outside Project Details"],
  },
  {
    id: "outside-readiness",
    category: "outside",
    title: "Releasing an Outside Project to Production",
    summary: "Confirm approval, payment, materials, and required stages before fabrication begins.",
    purpose: "Production Readiness prevents work from starting before commercial and material requirements are satisfied.",
    required: ["Customer approval", "Required deposit", "Required material availability", "Defined workflow"],
    steps: [
      "Open the project and select the Production tab.",
      "Review customer approval status.",
      "Confirm the required deposit has been received.",
      "Confirm required material is available or received.",
      "Review design, fabrication, test fit, finish, assembly, and installation requirements.",
      "Select Release to Production.",
      "Verify that the first required production stage appears in Production Control.",
    ],
    next: "Start the first Ready stage in Production Control when physical work begins.",
    mistakes: ["Releasing before deposit", "Releasing without customer approval", "Creating a second active production job"],
    related: ["Production Control", "Project Payments", "Procurement"],
  },
  {
    id: "install-schedule",
    category: "outside",
    title: "Scheduling an Installation",
    summary: "Confirm the installation window after fabrication, correction, finish, and assembly readiness.",
    purpose: "Installation scheduling creates the field commitment and advances the project to its final execution stage.",
    required: ["Ready-for-install status", "Customer-confirmed date", "Start time", "Expected end time", "Crew and site notes"],
    steps: [
      "Confirm all pre-installation stages are complete.",
      "Open the project in Production Control or Project Details.",
      "Select Schedule Installation.",
      "Enter the confirmed start and expected end date and time.",
      "Record crew, access, customer contact, equipment, and site instructions.",
      "Save and verify the project displays the scheduled installation.",
      "After installation, record completion and any remaining corrections.",
    ],
    next: "Complete final inspection, collect the balance, and send the project to Office Closeout.",
    mistakes: ["Scheduling before customer confirmation", "Leaving required finish work incomplete", "Omitting access or equipment notes"],
    related: ["Field Schedule", "Final Inspection", "Office Closeout"],
  },
  {
    id: "standalone-quote",
    category: "quotes",
    title: "Creating a Standalone Formal Quote",
    summary: "Issue a formal quote without first creating an outside project or site visit.",
    purpose: "Standalone quotes are appropriate for companies or customers requesting formal pricing before a project record is needed.",
    required: ["Customer or company", "Contact information", "Quote/project name", "Quote owner"],
    steps: [
      "Open Quote Center.",
      "Select New Standalone Quote.",
      "Choose an existing customer when available or enter the company and contact information.",
      "Select a saved quote template when appropriate.",
      "Enter the quote name, owner, address, and contact information.",
      "Create the quote, then open the Quote Builder.",
      "Complete all wording, pricing, images, terms, and validity information.",
    ],
    next: "Preview the quote, mark it Sent when delivered, and update it to Approved or Declined when the customer decides.",
    mistakes: ["Creating a blank outside project only to make a quote", "Leaving the customer name incomplete", "Sending a quote without previewing it"],
    related: ["Quote Templates", "Quote Builder", "Converting an Approved Quote"],
  },
  {
    id: "quote-builder",
    category: "quotes",
    title: "Building and Editing a Quote",
    summary: "Edit the commercial scope, pricing, schedule, warranty, exclusions, and presentation.",
    purpose: "The Quote Builder creates the complete customer-facing commercial proposal.",
    required: ["Customer information", "Scope", "Pricing", "Terms", "Quote-valid-through date"],
    steps: [
      "Open the quote from Quote Center or the connected outside project.",
      "Confirm customer, project, quote owner, date, and validity period.",
      "Apply the correct saved template.",
      "Edit every populated section to match the actual job.",
      "Add labor, material, fabrication, installation, service, and optional line items.",
      "Confirm quantities, unit prices, tax, subtotal, and total.",
      "Add approved reference images and captions when needed.",
      "Save before opening Preview.",
    ],
    next: "Review the professional preview from top to bottom before sending it.",
    mistakes: ["Assuming template wording fits every job", "Leaving zero-dollar placeholder items", "Forgetting exclusions or customer responsibilities"],
    related: ["Quote Templates", "Quote Preview", "Quote Statuses"],
  },
  {
    id: "quote-template",
    category: "quotes",
    title: "Using and Saving Quote Templates",
    summary: "Standardize wording and reusable items while keeping every quote editable.",
    purpose: "Templates improve consistency without replacing job-specific review and editing.",
    required: ["A quote open in Quote Builder", "An active saved template"],
    steps: [
      "Open the Saved Quote Templates section.",
      "Choose the template matching the work type.",
      "Choose Fill Blank Fields to preserve existing quote content or Replace to intentionally overwrite it.",
      "Set the quote-valid-for period.",
      "Apply the template and review every section.",
      "Edit job-specific wording, pricing, schedule, warranty, and exclusions.",
      "Use Save Quote as New Template only when creating a reusable standard.",
    ],
    next: "Finish pricing and preview the customer-facing quote.",
    mistakes: ["Applying Replace unintentionally", "Sending generic template wording unchanged", "Updating the wrong shared template"],
    related: ["Quote Builder", "Standalone Quotes", "Quote Preview"],
  },
  {
    id: "convert-quote",
    category: "quotes",
    title: "Converting an Approved Quote into a Project",
    summary: "Turn awarded standalone work into an outside project without re-entering the customer information.",
    purpose: "Conversion preserves the approved quote while creating the operational project record.",
    required: ["Approved standalone quote", "Confirmed customer", "Defined work requirements"],
    steps: [
      "Open Quote Center and locate the approved standalone quote.",
      "Confirm the status is Approved and the commercial information is correct.",
      "Select Convert to Project.",
      "Review the prefilled customer, contact, project name, amount, and address.",
      "Select the required outside workflow stages.",
      "Complete the conversion.",
      "Open the new project and verify its quote connection and next action.",
    ],
    next: "Complete deposit, materials, and production-readiness requirements.",
    mistakes: ["Converting a draft quote", "Creating a separate duplicate project", "Changing approved pricing without documenting the revision"],
    related: ["Outside Project Intake", "Production Readiness", "Project Payments"],
  },
  {
    id: "production-control",
    category: "production",
    title: "Using Production Control",
    summary: "Start, complete, hold, and hand work to the next required stage.",
    purpose: "Production Control is the execution board for both internal orders and outside projects.",
    required: ["Released production work", "Correct employee or department assignment"],
    steps: [
      "Open Production, then Production Control.",
      "Choose In-Shop Orders or Outside Projects.",
      "Search or filter to the correct work card.",
      "Verify the customer, order/project number, required stage, and instructions.",
      "Select Start when physical work begins.",
      "Select Complete only after the station work and required notes are finished.",
      "Verify the next stage becomes Ready.",
      "Use On Hold with a reason when work cannot continue.",
    ],
    next: "The next required station starts its work; final production completion advances the record toward closeout.",
    mistakes: ["Completing work that has not physically finished", "Working from the wrong card", "Failing to record why work is on hold"],
    related: ["Department Queues", "Outside Production", "Office Closeout"],
  },
  {
    id: "internal-production",
    category: "production",
    title: "Internal Shop Production Flow",
    summary: "Move internal orders through Design, Laser, Welding, Prep, Finish, Assembly, and Final QC.",
    purpose: "The route contains only the stations required for that order.",
    required: ["Released internal order", "Connected production job"],
    steps: [
      "Open the Ready card for the current station.",
      "Review products, quantity, drawings, reference images, notes, material, and due date.",
      "Start the stage when work begins.",
      "Record corrections or production notes as required.",
      "Complete the stage after checking the work.",
      "Confirm the next required station receives the card.",
      "At Final QC, confirm the completed item and move it to office closeout readiness.",
    ],
    next: "Office confirms payment, customer notification, and pickup or delivery.",
    mistakes: ["Skipping required QC", "Completing a partial quantity as the full order", "Using Outside Project stages for an internal order"],
    related: ["Production Control", "Customer Order Details", "Office Closeout"],
  },
  {
    id: "outside-production",
    category: "production",
    title: "Outside Project Production Flow",
    summary: "Execute Design, Fabrication, Test Fit, Finish/Corrections, Assembly, and Installation.",
    purpose: "Outside production excludes showroom routing and continues toward installation at the customer site.",
    required: ["Released outside project", "Correct required-stage configuration"],
    steps: [
      "Open Outside Projects in Production Control.",
      "Start and complete Design when required.",
      "Start and complete Welding/Fabrication.",
      "Complete Test Fit and record required corrections.",
      "Complete Finish/Corrections and Assembly when required.",
      "Advance the project to Ready for Installation.",
      "Schedule and complete installation.",
      "Complete final inspection and balance requirements.",
    ],
    next: "The project enters unified Office Closeout with internal orders.",
    mistakes: ["Routing outside work to Showroom", "Skipping Test Fit when required", "Marking installation complete before site work is finished"],
    related: ["Installation Scheduling", "Final Inspection", "Office Closeout"],
  },
  {
    id: "inventory-catalog",
    category: "inventory",
    title: "Using the Inventory Catalog",
    summary: "Search items and review quantities, storage, images, category, and readiness.",
    purpose: "The catalog is the source of truth for Metal Worx inventory items and stock visibility.",
    required: ["Inventory access", "An item name, SKU, item number, category, or storage position"],
    steps: [
      "Open Inventory, then Inventory Items.",
      "Search by item name, SKU, item number, category, group, or location.",
      "Use filters to narrow a large catalog.",
      "Review On Hand and Available quantities.",
      "Open the item for images, storage, reorder settings, and history.",
      "Use the appropriate action rather than editing quantity values informally.",
    ],
    next: "Receive, adjust, count, label, or request the item as needed.",
    mistakes: ["Creating a duplicate item", "Confusing On Hand with Available", "Changing stock without an inventory movement"],
    related: ["Receiving Inventory", "Quantity Adjustments", "Count Mode"],
  },
  {
    id: "inventory-receiving",
    category: "inventory",
    title: "Receiving Inventory",
    summary: "Add delivered stock and preserve an auditable movement history.",
    purpose: "Receiving records actual incoming material or stock.",
    required: ["Inventory item", "Received quantity", "Storage bin/location", "Reference or notes"],
    steps: [
      "Open Inventory Receiving.",
      "Search for and select the correct inventory item.",
      "Confirm the item number and unit of measure.",
      "Enter the quantity actually received.",
      "Select the correct storage location or bin.",
      "Add the purchase order, packing slip, vendor, or receipt note when available.",
      "Save and confirm the new quantity.",
    ],
    next: "Place the physical stock in the recorded location and label it when required.",
    mistakes: ["Receiving against the wrong item", "Entering package count instead of inventory unit", "Leaving stock in a different bin than recorded"],
    related: ["Inventory Catalog", "Storage Locations", "Inventory History"],
  },
  {
    id: "inventory-adjustment",
    category: "inventory",
    title: "Adjusting Inventory Quantities",
    summary: "Correct counts, damage, usage, loss, or other approved stock differences.",
    purpose: "Adjustments explain why system quantity changed outside normal receiving or material consumption.",
    required: ["Inventory item", "Adjustment amount or corrected quantity", "Reason", "Employee"],
    steps: [
      "Open the inventory item or Quantity Adjustment.",
      "Verify the item, unit, location, and current quantity.",
      "Choose the correct adjustment reason.",
      "Enter the quantity carefully, noting whether the action adds, removes, or sets stock.",
      "Add a clear explanation.",
      "Save and confirm the resulting quantity and history entry.",
    ],
    next: "Investigate repeated unexplained differences and correct storage or usage procedures.",
    mistakes: ["Using adjustment instead of receiving", "Reversing positive and negative quantities", "Using a vague reason such as fix"],
    related: ["Inventory History", "Count Mode", "Receiving Inventory"],
  },
  {
    id: "inventory-import",
    category: "inventory",
    title: "Importing the Inventory Excel Workbook",
    summary: "Preview and apply approved workbook updates without unintentionally duplicating items.",
    purpose: "Excel import synchronizes the controlled inventory workbook with the application after review.",
    required: ["Current approved workbook", "Inventory backup", "Stable item numbers/SKUs", "Import permission"],
    steps: [
      "Confirm the workbook is the newest approved copy.",
      "Back up the current inventory data before importing.",
      "Open Inventory Import Wizard and upload the workbook.",
      "Review column mapping, duplicate matches, images, item numbers, and quantities.",
      "Resolve every warning before committing.",
      "Import a small verified sample first when the workbook format has changed.",
      "Commit the full import only after the preview totals are correct.",
      "Spot-check several updated and unchanged items afterward.",
    ],
    next: "Run a physical or targeted count to verify critical quantities.",
    mistakes: ["Uploading an older workbook", "Matching by name when item numbers differ", "Committing without reviewing duplicates", "Assuming import automatically means overwrite"],
    related: ["Inventory Catalog", "Count Mode", "Inventory Backup"],
  },
  {
    id: "callbacks",
    category: "office",
    title: "Callbacks and Follow-Ups",
    summary: "Track customer contact commitments until completed or converted.",
    purpose: "Callbacks prevent customer requests and promised follow-ups from being lost.",
    required: ["Customer or contact", "Reason", "Owner", "Due date/time"],
    steps: [
      "Open Office, then Callbacks.",
      "Create the callback with contact information, subject, owner, and due time.",
      "Record the requested action and useful conversation notes.",
      "Complete the contact and update the outcome.",
      "Convert the callback to a customer or project when it becomes real work.",
      "Mark it Completed only when no further action remains.",
    ],
    next: "Converted work continues through customer, quote, order, or project workflow.",
    mistakes: ["Deleting rather than completing", "Leaving the owner blank", "Keeping converted callbacks active"],
    related: ["Customers", "Outside Projects", "Action Center"],
  },
  {
    id: "hot-commitments",
    category: "office",
    title: "Hot Today and Quick Turnaround",
    summary: "Separate today's operational priorities from customer-promised expedited work.",
    purpose: "Hot Today identifies work leadership is actively prioritizing today; Quick Turnaround tracks expedited customer commitments.",
    required: ["Connected work item", "Priority reason", "Owner", "Required-by date/time"],
    steps: [
      "Use Quick Turnaround when Metal Worx promises accelerated completion.",
      "Use Hot Today when leadership promotes an item for immediate attention today.",
      "Record the reason, assignment, and due time.",
      "Review both areas at the morning huddle and before normal-priority work.",
      "Update status as the commitment advances.",
      "Remove or complete Hot Today at the end of the operational need.",
    ],
    next: "The item remains connected to its normal order or project workflow.",
    mistakes: ["Using Hot Today for every overdue item", "Confusing priority with workflow status", "Leaving expired daily priorities active"],
    related: ["Operations Command Center", "Action Center", "Shop TV Mode"],
  },
  {
    id: "office-closeout",
    category: "office",
    title: "Completing Office Closeout",
    summary: "Finish internal and outside work after production, fulfillment, inspection, and payment.",
    purpose: "Office Closeout is the final control point before work leaves active operations.",
    required: [
      "Production or installation complete",
      "Final inspection complete when required",
      "Payment requirements satisfied",
      "Customer notification",
      "Pickup, delivery, or installation confirmation",
    ],
    steps: [
      "Open the Office Closeout queue from the dashboard.",
      "Open the correct internal order or outside project.",
      "Verify the final balance and payment history.",
      "Confirm final inspection and production or installation completion.",
      "Record customer-ready notification when applicable.",
      "Confirm pickup, delivery, or completed installation.",
      "Review the final record and select Complete Office Closeout.",
      "Confirm the item leaves active dashboard and closeout queues.",
    ],
    next: "The completed record remains available for history, reporting, and PDF export.",
    mistakes: ["Closing out unpaid work without authorization", "Skipping customer notification", "Completing the wrong record", "Using closeout to hide unfinished work"],
    related: ["Recording Payments", "Final Inspection", "PDF Records"],
  },
  {
    id: "employee-logins",
    category: "office",
    title: "Managing Employee Logins",
    summary: "Create, reset, disable, or remove access without deleting personnel history.",
    purpose: "Only authorized administrators should manage authentication access.",
    required: ["Employee name", "Unique employee email", "Department", "Temporary password"],
    steps: [
      "Open Setup, then Employee Logins.",
      "Select an existing employee profile when enabling login for current personnel.",
      "Enter the unique email and generate or enter a temporary password.",
      "Create the login and provide credentials privately.",
      "Use Reset Password when access must be restored.",
      "Disable login when access should pause without deleting the profile.",
      "Remove login only when authentication access should be permanently removed.",
    ],
    next: "Have the employee test sign-in and confirm the correct display name.",
    mistakes: ["Creating duplicate employee profiles", "Reusing an email", "Deleting personnel history to remove login access", "Sharing temporary passwords publicly"],
    related: ["Signing In", "Setup", "Pilot Feedback"],
  },
  {
    id: "pilot-feedback",
    category: "office",
    title: "Submitting Pilot Feedback",
    summary: "Report an issue, blocked task, improvement, question, or training need.",
    purpose: "Pilot Feedback creates a trackable record instead of relying on memory or informal messages.",
    required: ["Feedback type", "Priority", "Page or area", "Short title", "Detailed description"],
    steps: [
      "Open Office, then Pilot Feedback.",
      "Select Issue, Improvement, Question, or Training Need.",
      "Choose a realistic priority.",
      "Enter the exact page or area.",
      "Describe what happened and what you were trying to do.",
      "Record what the app did, including visible errors.",
      "Attach a screenshot when possible.",
      "Submit one distinct issue per report.",
    ],
    next: "Management reviews, handles, and resolves the feedback item with resolution notes.",
    mistakes: ["Combining unrelated problems", "Submitting without the page name", "Marking every issue Work Blocked", "Leaving out the error message"],
    related: ["Knowledge Center", "Action Center", "Employee Training"],
  },
];

function ArticleSection({ title, children }) {
  return (
    <Stack gap={7}>
      <Text fw={900} c="white" tt="uppercase" size="sm" lts={0.7}>
        {title}
      </Text>
      {children}
    </Stack>
  );
}

function KnowledgeCenter({ setPage }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState(null);

  const filteredArticles = useMemo(() => {
    const term = search.trim().toLowerCase();

    return ARTICLES.filter((article) => {
      if (category !== "all" && article.category !== category) return false;
      if (!term) return true;

      return [
        article.title,
        article.summary,
        article.purpose,
        article.next,
        ...article.required,
        ...article.steps,
        ...article.mistakes,
        ...article.related,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [category, search]);

  const categoryCounts = useMemo(() => {
    return CATEGORIES.reduce((counts, item) => {
      counts[item.id] =
        item.id === "all"
          ? ARTICLES.length
          : ARTICLES.filter((article) => article.category === item.id).length;
      return counts;
    }, {});
  }, []);

  return (
    <Stack gap="lg">
      <Card
        withBorder
        radius="lg"
        p="xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(18,27,34,.98), rgba(8,12,15,.98))",
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" fw={900} c="red" tt="uppercase" lts={1.4}>
                Metal Worx OS Training and Procedures
              </Text>
              <Title order={1} c="white">
                Knowledge Center
              </Title>
              <Text c="dimmed">
                Search detailed instructions for every major Metal Worx workflow.
              </Text>
            </div>
            <Badge color="green" size="lg" variant="light">
              {ARTICLES.length} Training Articles
            </Badge>
          </Group>

          <TextInput
            size="lg"
            leftSection={<IconSearch size={20} />}
            placeholder="What are you trying to do?"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </Stack>
      </Card>

      <Alert color="blue" icon={<IconChecks size={20} />} radius="lg">
        Update work when it actually starts or finishes so every employee sees
        the same current status.
      </Alert>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
        {CATEGORIES.map((item) => {
          const Icon = item.icon;
          const active = category === item.id;

          return (
            <Card
              key={item.id}
              withBorder
              radius="lg"
              p="md"
              role="button"
              tabIndex={0}
              onClick={() => setCategory(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setCategory(item.id);
                }
              }}
              style={{
                cursor: "pointer",
                borderColor: active ? "var(--mantine-color-red-6)" : undefined,
                background: active ? "rgba(122, 0, 0, .18)" : undefined,
              }}
            >
              <Group wrap="nowrap">
                <ThemeIcon color={item.color} variant={active ? "filled" : "light"}>
                  <Icon size={18} />
                </ThemeIcon>
                <div style={{ minWidth: 0 }}>
                  <Text fw={900} c="white" truncate>
                    {item.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {categoryCounts[item.id]} articles
                  </Text>
                </div>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>

      <Card withBorder radius="lg" p="xl">
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2} c="white">
              {CATEGORIES.find((item) => item.id === category)?.label || "Training Articles"}
            </Title>
            <Text c="dimmed">
              Select an article for the full procedure, requirements, next steps,
              and common mistakes.
            </Text>
          </div>
          <Badge variant="outline" color="red" size="lg">
            {filteredArticles.length} Result{filteredArticles.length === 1 ? "" : "s"}
          </Badge>
        </Group>

        {filteredArticles.length ? (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
            {filteredArticles.map((article) => {
              const categoryItem = CATEGORIES.find(
                (item) => item.id === article.category
              );
              const Icon = categoryItem?.icon || IconBook2;

              return (
                <Card
                  key={article.id}
                  withBorder
                  radius="lg"
                  p="lg"
                  style={{ display: "flex", flexDirection: "column" }}
                >
                  <Group align="flex-start" wrap="nowrap" mb="sm">
                    <ThemeIcon
                      color={categoryItem?.color || "red"}
                      variant="light"
                      size={42}
                      radius="md"
                    >
                      <Icon size={21} />
                    </ThemeIcon>
                    <div style={{ minWidth: 0 }}>
                      <Badge
                        color={categoryItem?.color || "red"}
                        variant="light"
                        size="xs"
                        mb={5}
                      >
                        {categoryItem?.label}
                      </Badge>
                      <Text fw={900} c="white" size="lg" lh={1.2}>
                        {article.title}
                      </Text>
                    </div>
                  </Group>

                  <Text c="dimmed" size="sm" style={{ flex: 1 }}>
                    {article.summary}
                  </Text>

                  <Button
                    mt="md"
                    variant="light"
                    color="red"
                    onClick={() => setSelectedArticle(article)}
                  >
                    Open Procedure
                  </Button>
                </Card>
              );
            })}
          </SimpleGrid>
        ) : (
          <Alert color="orange" title="No matching training article">
            Try another phrase or select All Guides.
          </Alert>
        )}
      </Card>

      <Card withBorder radius="lg" p="xl">
        <Group justify="space-between" align="center">
          <div>
            <Title order={3} c="white">
              Could not find the answer?
            </Title>
            <Text c="dimmed">
              Submit a training request or report a problem through Pilot Feedback.
            </Text>
          </div>
          <Button
            color="red"
            leftSection={<IconMessageReport size={18} />}
            onClick={() => setPage("pilotFeedback")}
          >
            Open Pilot Feedback
          </Button>
        </Group>
      </Card>

      <Modal
        opened={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        title={selectedArticle?.title || "Training Article"}
        size="xl"
        centered
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {selectedArticle && (
          <Stack gap="lg">
            <Text c="dimmed">{selectedArticle.summary}</Text>

            <ArticleSection title="What this is for">
              <Text>{selectedArticle.purpose}</Text>
            </ArticleSection>

            <Divider />

            <ArticleSection title="Information required">
              <List spacing="xs">
                {selectedArticle.required.map((item) => (
                  <List.Item key={item}>{item}</List.Item>
                ))}
              </List>
            </ArticleSection>

            <Divider />

            <ArticleSection title="Step-by-step procedure">
              <Stack gap="sm">
                {selectedArticle.steps.map((step, index) => (
                  <Group key={step} align="flex-start" wrap="nowrap">
                    <Badge color="red" variant="filled" circle mt={2}>
                      {index + 1}
                    </Badge>
                    <Text>{step}</Text>
                  </Group>
                ))}
              </Stack>
            </ArticleSection>

            <Divider />

            <ArticleSection title="What happens next">
              <Alert color="green" icon={<IconChecks size={18} />}>
                {selectedArticle.next}
              </Alert>
            </ArticleSection>

            <ArticleSection title="Common mistakes to avoid">
              <List spacing="xs">
                {selectedArticle.mistakes.map((item) => (
                  <List.Item key={item}>{item}</List.Item>
                ))}
              </List>
            </ArticleSection>

            <ArticleSection title="Related guides">
              <Group gap="xs">
                {selectedArticle.related.map((item) => (
                  <Badge key={item} variant="outline" color="gray">
                    {item}
                  </Badge>
                ))}
              </Group>
            </ArticleSection>

            <Divider />

            <Group justify="space-between">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => setSelectedArticle(null)}
              >
                Close
              </Button>
              <Button
                color="red"
                leftSection={<IconHelp size={18} />}
                onClick={() => {
                  setSelectedArticle(null);
                  setPage("pilotFeedback");
                }}
              >
                Ask for Help
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default KnowledgeCenter;
