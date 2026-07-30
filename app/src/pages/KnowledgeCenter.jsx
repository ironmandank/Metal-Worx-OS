import { useMemo, useState } from "react";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Group,
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
  IconCash,
  IconChecks,
  IconFileInvoice,
  IconMessageReport,
  IconPackage,
  IconSearch,
  IconShoppingCart,
  IconTool,
} from "@tabler/icons-react";

const GUIDES = [
  {
    id: "getting-started",
    title: "Getting Started",
    summary: "Sign in, navigate Metal Worx OS, and understand the command center.",
    icon: IconBook2,
    color: "blue",
    steps: [
      "Sign in with the employee email and temporary password provided by the office.",
      "Use the left navigation to open Office, Sales, Outside, Inventory, Production, Stations, and Setup.",
      "The Command Center shows active commitments, open work, production flow, and office closeout.",
      "Use Refresh when recent work does not appear immediately.",
      "Sign out from the lower-left account control when using a shared computer.",
    ],
  },
  {
    id: "internal-orders",
    title: "Internal Customer Orders",
    summary: "Create and move in-shop orders from intake through office closeout.",
    icon: IconShoppingCart,
    color: "red",
    steps: [
      "Open Sales, then New Order.",
      "Select an existing customer or create the customer record.",
      "Add the requested products, quantities, design needs, images, notes, and due date.",
      "Confirm payment requirements and release the approved order to production.",
      "Production advances through the required shop stations.",
      "After production completion, record final payment, notification, and pickup or delivery in Office Closeout.",
    ],
  },
  {
    id: "outside-projects",
    title: "Outside Projects",
    summary: "Manage field fabrication, site work, test fit, finishing, and installation.",
    icon: IconTool,
    color: "orange",
    steps: [
      "Open Outside, then create or open the project.",
      "Record whether a site visit, measurements, design, fabrication, test fit, finish, assembly, or installation is required.",
      "Complete customer approval, deposit, and material-readiness requirements.",
      "Release the project to Production Control.",
      "Use Start and Complete to advance each required stage.",
      "Schedule installation only after the project reaches Ready for Installation.",
      "Complete final inspection, collect the balance, and finish Office Closeout.",
    ],
  },
  {
    id: "quotes",
    title: "Quotes and Templates",
    summary: "Build project-linked or standalone formal quotes.",
    icon: IconFileInvoice,
    color: "grape",
    steps: [
      "Open Quote Center to view all formal quotes.",
      "Use New Standalone Quote when no site visit or outside project is needed.",
      "Choose a saved quote template and apply it to blank fields or replace existing wording.",
      "Edit scope, specifications, inclusions, exclusions, schedule, payment terms, warranty, and disclaimer.",
      "Add line items, quantities, unit prices, images, and optional items.",
      "Preview the professional quote and confirm all customer and pricing information.",
      "Update the status as the quote moves from Draft to Sent and Approved.",
      "Convert an approved standalone quote into an outside project when work is awarded.",
    ],
  },
  {
    id: "production",
    title: "Production Control",
    summary: "Start, complete, and hand work to the next required station.",
    icon: IconBuildingFactory2,
    color: "cyan",
    steps: [
      "Open Production, then Production Control.",
      "Choose In-Shop Orders or Outside Projects.",
      "Find the ready work card for the required department.",
      "Select Start Work when work physically begins.",
      "Select Complete Stage only when that station's work is actually finished.",
      "The system automatically makes the next required stage ready.",
      "Use On Hold only when work cannot continue and record the reason.",
    ],
  },
  {
    id: "payments-closeout",
    title: "Payments and Office Closeout",
    summary: "Record payments and remove completed work from active queues.",
    icon: IconCash,
    color: "green",
    steps: [
      "Open the order or project payment section.",
      "Record the payment type, amount, method, date, reference number, and notes.",
      "Confirm the remaining balance is correct.",
      "Office Closeout requires production or installation completion, final inspection, and payment requirements.",
      "Confirm customer notification and pickup, delivery, or installation completion.",
      "Select Complete Office Closeout only after all requirements are satisfied.",
      "Completed work then leaves the active dashboard and closeout queue.",
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    summary: "Find items, receive stock, adjust quantities, print labels, and import Excel.",
    icon: IconPackage,
    color: "yellow",
    steps: [
      "Open Inventory Items to search by name, item number, category, group, or storage position.",
      "Open an item to review images, quantities, locations, history, and reorder settings.",
      "Use Receiving when new stock arrives.",
      "Use Quantity Adjustment for counts, corrections, damage, or other approved changes.",
      "Use Count Mode for physical inventory verification.",
      "Use Label Printing for QR and barcode labels.",
      "Use Excel Import only with the approved current workbook and review the preview before committing changes.",
    ],
  },
  {
    id: "feedback",
    title: "Pilot Feedback",
    summary: "Report problems, ideas, questions, or training needs.",
    icon: IconMessageReport,
    color: "pink",
    steps: [
      "Open Office, then Pilot Feedback.",
      "Choose the feedback type and priority.",
      "Enter the page or area where the issue occurred.",
      "Describe what happened, what you were trying to do, and what the app did.",
      "Attach a screenshot whenever it helps explain the issue.",
      "Submit one issue per report so each item can be tracked and resolved clearly.",
    ],
  },
];

function KnowledgeCenter({ setPage }) {
  const [search, setSearch] = useState("");

  const filteredGuides = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return GUIDES;

    return GUIDES.filter((guide) =>
      [guide.title, guide.summary, ...guide.steps]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [search]);

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
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" fw={900} c="red" tt="uppercase" lts={1.4}>
                Metal Worx OS Training
              </Text>
              <Title order={1}>Knowledge Center</Title>
              <Text c="dimmed">
                Search instructions for the workflows used across Metal Worx.
              </Text>
            </div>
            <Badge color="green" size="lg" variant="light">
              Pilot Guide
            </Badge>
          </Group>

          <TextInput
            size="lg"
            leftSection={<IconSearch size={20} />}
            placeholder="Search orders, quotes, production, payments, inventory..."
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </Stack>
      </Card>

      <Alert color="blue" icon={<IconChecks size={20} />} radius="lg">
        Work should be updated when it actually starts or finishes so every
        employee sees the same current status.
      </Alert>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {GUIDES.slice(1, 5).map((guide) => {
          const Icon = guide.icon;

          return (
            <Card key={guide.id} withBorder radius="lg" p="lg">
              <Group align="flex-start" wrap="nowrap">
                <ThemeIcon color={guide.color} size={42} radius="md">
                  <Icon size={22} />
                </ThemeIcon>
                <div>
                  <Text fw={900}>{guide.title}</Text>
                  <Text size="sm" c="dimmed">
                    {guide.summary}
                  </Text>
                </div>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>

      <Card withBorder radius="lg" p="xl">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2}>How to Use the App</Title>
            <Text c="dimmed">
              Open a workflow below for step-by-step instructions.
            </Text>
          </div>
          <Badge variant="outline">
            {filteredGuides.length} guide{filteredGuides.length === 1 ? "" : "s"}
          </Badge>
        </Group>

        {filteredGuides.length ? (
          <Accordion variant="separated" radius="md">
            {filteredGuides.map((guide) => {
              const Icon = guide.icon;

              return (
                <Accordion.Item key={guide.id} value={guide.id}>
                  <Accordion.Control
                    icon={
                      <ThemeIcon color={guide.color} variant="light">
                        <Icon size={18} />
                      </ThemeIcon>
                    }
                  >
                    <Text fw={900}>{guide.title}</Text>
                    <Text size="sm" c="dimmed">
                      {guide.summary}
                    </Text>
                  </Accordion.Control>

                  <Accordion.Panel>
                    <Stack gap="sm">
                      {guide.steps.map((step, index) => (
                        <Group key={step} align="flex-start" wrap="nowrap">
                          <Badge
                            color="red"
                            variant="light"
                            circle
                            mt={2}
                            style={{ flexShrink: 0 }}
                          >
                            {index + 1}
                          </Badge>
                          <Text>{step}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        ) : (
          <Alert color="orange" title="No matching guide">
            Try a different search such as order, quote, payment, production,
            closeout, or inventory.
          </Alert>
        )}
      </Card>

      <Card withBorder radius="lg" p="xl">
        <Group justify="space-between">
          <div>
            <Title order={3}>Still need help?</Title>
            <Text c="dimmed">
              Submit a Pilot Feedback report with the page name and a screenshot.
            </Text>
          </div>
          <Button
            color="red"
            leftSection={<IconMessageReport size={18} />}
            onClick={() => setPage("pilotFeedback")}
          >
            Report Feedback
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}

export default KnowledgeCenter;