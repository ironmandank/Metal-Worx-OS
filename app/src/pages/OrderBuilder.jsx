import { useEffect, useState } from "react";

import {
  Alert,
  Button,
  Card,
  FileInput,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";

import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconSearch,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import { releaseCustomerOrder } from "../lib/productionWorkflow";

import {
  createNotificationForAssignedName,
  getActiveProfiles,
} from "../services/notificationService";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import ProductStep from "../components/orderbuilder/ProductStep";

function OrderBuilder({
  setPage,
  selectedCustomer,
}) {
  const [customers, setCustomers] = useState([]);
  const [people, setPeople] = useState([]);

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [showQuickAdd, setShowQuickAdd] =
    useState(false);

  const [
    selectedOrderCustomer,
    setSelectedOrderCustomer,
  ] = useState(selectedCustomer || null);

  const [quickCustomer, setQuickCustomer] =
    useState({
      first_name: "",
      last_name: "",
      company_name: "",
      phone: "",
      email: "",
    });

  const [products, setProducts] = useState([]);
  const [customItemName, setCustomItemName] = useState("");

  const [dueDate, setDueDate] = useState(null);

  const [rush, setRush] = useState(false);

  const [notes, setNotes] = useState("");

  const [isSaving, setIsSaving] =
    useState(false);

  const [orderOwner, setOrderOwner] =
    useState("");

  const [orderType, setOrderType] = useState(
    "Standard Product"
  );

  const [designNeeded, setDesignNeeded] =
    useState(false);

  const [
    designFeeRequired,
    setDesignFeeRequired,
  ] = useState(false);

  const [
    designFeeStatus,
    setDesignFeeStatus,
  ] = useState("Not Required");

  const [designFeeAmount, setDesignFeeAmount] =
    useState(50);

  const [designStatus, setDesignStatus] =
    useState("Not Required");

  const [designNotes, setDesignNotes] =
    useState("");

  const [
    startingDepartment,
    setStartingDepartment,
  ] = useState("Laser");

  const [
    referenceImages,
    setReferenceImages,
  ] = useState([]);

  useEffect(() => {
    loadPageData();
  }, []);

  async function loadPageData() {
    await Promise.all([
      loadCustomers(),
      loadPeople(),
    ]);
  }

  function formatDateForSupabase(value) {
    if (!value) return null;

    return new Date(value)
      .toISOString()
      .slice(0, 10);
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Load customers error:",
        error
      );

      return;
    }

    setCustomers(data || []);
  }

  async function loadPeople() {
    try {
      const profiles = await getActiveProfiles();

      const personNames = (profiles || [])
        .filter(
          (profile) =>
            profile.profile_type === "Person"
        )
        .map(
          (profile) => profile.display_name
        )
        .filter(Boolean);

      setPeople(personNames);
    } catch (error) {
      console.error(
        "Order owner profile load error:",
        error
      );

      notifications.show({
        title: "Employee Profiles",
        message:
          "Order owner options could not be loaded.",
        color: "orange",
      });
    }
  }

  function customerName(customer) {
    if (!customer) {
      return "No customer selected";
    }

    return (
      `${customer.first_name || ""} ${
        customer.last_name || ""
      }`.trim() ||
      customer.contact_name ||
      customer.name ||
      customer.company_name ||
      "Unnamed Customer"
    );
  }

  function customerCompany(customer) {
    if (!customer?.company_name) return "";
    return customer.company_name === customerName(customer)
      ? ""
      : customer.company_name;
  }

  function orderItemNames() {
    const names = products.map((product) => product.name).filter(Boolean);

    if (customItemName.trim()) {
      names.push(customItemName.trim());
    }

    return names.length
      ? [...new Set(names)].join(", ")
      : "Item not specified";
  }

  function updateQuickCustomer(field, value) {
    setQuickCustomer((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function createQuickCustomer() {
    const hasPersonName =
      quickCustomer.first_name.trim() ||
      quickCustomer.last_name.trim();

    if (!hasPersonName) {
      notifications.show({
        title: "Person Who Ordered Is Required",
        message:
          "Enter the first or last name of the person placing the order. The company is optional.",
        color: "red",
      });

      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert([
        {
          first_name:
            quickCustomer.first_name || "",

          last_name:
            quickCustomer.last_name || "",

          company_name:
            quickCustomer.company_name || "",

          phone:
            quickCustomer.phone || "",

          email:
            quickCustomer.email || "",
        },
      ])
      .select()
      .single();

    if (error) {
      notifications.show({
        title: "Customer Save Failed",
        message: error.message,
        color: "red",
      });

      return;
    }

    setSelectedOrderCustomer(data);

    setCustomerSearch("");

    setShowQuickAdd(false);

    setQuickCustomer({
      first_name: "",
      last_name: "",
      company_name: "",
      phone: "",
      email: "",
    });

    await loadCustomers();

    notifications.show({
      title: "Customer Created",
      message: `${customerName(
        data
      )} was selected for this order.`,
      color: "green",
    });
  }

  const filteredCustomers =
    customerSearch.trim().length === 0
      ? []
      : customers
          .filter((customer) => {
            const text = `
              ${customer.first_name || ""}
              ${customer.last_name || ""}
              ${customer.company_name || ""}
              ${customer.phone || ""}
              ${customer.email || ""}
            `.toLowerCase();

            return text.includes(
              customerSearch.toLowerCase()
            );
          })
          .slice(0, 8);

  const productTotal = products.reduce(
    (total, product) => {
      return (
        total +
        Number(product.online_price || 0)
      );
    },
    0
  );

  const designFeeTotal =
    designFeeRequired &&
    designFeeStatus !== "Waived"
      ? Number(designFeeAmount || 0)
      : 0;

  const estimatedTotal =
    productTotal + designFeeTotal;

  function addProduct(template) {
    setProducts((current) => {
      if (current.some((product) => product.id === template.id)) {
        notifications.show({
          title: "Product Already Added",
          message: `${template.name || "This product"} is already on the order.`,
          color: "orange",
        });

        return current;
      }

      return [...current, template];
    });
  }

  function removeProduct(productId) {
    setProducts((current) =>
      current.filter(
        (product) => product.id !== productId
      )
    );
  }

  function applyOrderType(value) {
    setOrderType(value);

    if (value === "Custom Artwork") {
      setDesignNeeded(true);

      setDesignFeeRequired(true);

      setDesignFeeStatus("Pending");

      setDesignFeeAmount(50);

      setDesignStatus("Design Needed");

      setStartingDepartment("Design");

      return;
    }

    if (
      value === "Repeat / Existing Design"
    ) {
      setDesignNeeded(false);

      setDesignFeeRequired(false);

      setDesignFeeStatus("Not Required");

      setDesignStatus("Existing Design");

      setStartingDepartment("Laser");

      return;
    }

    if (value === "Field Fabrication") {
      setDesignNeeded(false);

      setDesignFeeRequired(false);

      setDesignFeeStatus("Not Required");

      setDesignStatus("Not Required");

      setStartingDepartment("Design");

      return;
    }

    setDesignNeeded(false);

    setDesignFeeRequired(false);

    setDesignFeeStatus("Not Required");

    setDesignStatus("Not Required");

    setStartingDepartment("Laser");
  }

  async function uploadReferenceImages(
    orderId
  ) {
    if (
      !referenceImages ||
      referenceImages.length === 0
    ) {
      return;
    }

    for (
      let index = 0;
      index < referenceImages.length;
      index += 1
    ) {
      const file = referenceImages[index];

      const fileExtension = file.name
        .split(".")
        .pop();

      const safeFileName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(
          /[^a-zA-Z0-9-_]/g,
          "-"
        );

      const filePath =
        `${orderId}/` +
        `${Date.now()}-${index}-` +
        `${safeFileName}.${fileExtension}`;

      const { error: uploadError } =
        await supabase.storage
          .from("order-reference-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from("order-reference-images")
          .getPublicUrl(filePath);

      const { error: imageError } =
        await supabase
          .from(
            "customer_order_reference_images"
          )
          .insert([
            {
              customer_order_id: orderId,

              image_url:
                publicUrlData.publicUrl,

              caption: file.name,

              image_type:
                "Reference Image",

              show_on_work_order: true,

              sort_order: index + 1,
            },
          ]);

      if (imageError) {
        throw imageError;
      }
    }
  }

  async function createOrder() {
    if (!selectedOrderCustomer) {
      notifications.show({
        title: "Missing Customer",
        message:
          "Select or create a customer before creating the order.",
        color: "red",
      });

      return;
    }

    if (products.length === 0 && !customItemName.trim()) {
      notifications.show({
        title: "Item Ordered Is Required",
        message:
          "Add a catalog product or enter the custom item or design being ordered.",
        color: "red",
      });

      return;
    }

    setIsSaving(true);

    try {
      const orderNumber =
        `MW-${new Date().getFullYear()}-` +
        `${Date.now()}`;

      const orderPayload = {
        order_number: orderNumber,

        customer_id:
          selectedOrderCustomer.id,

        status: designNeeded
          ? "Design Needed"
          : "New",

        due_date:
          formatDateForSupabase(dueDate),

        rush,

        notes,

        total_amount: estimatedTotal,

        deposit_received: false,

        deposit_amount: 0,

        order_type: orderType,

        order_owner:
          orderOwner || null,

        design_needed: designNeeded,

        design_fee_required:
          designFeeRequired,

        design_fee_status:
          designFeeRequired
            ? designFeeStatus
            : "Not Required",

        design_fee_amount:
          designFeeRequired
            ? Number(
                designFeeAmount || 50
              )
            : 0,

        design_status: designStatus,

        design_notes: designNotes,

        starting_department:
          startingDepartment,
      };

      const {
        data: orderData,
        error: orderError,
      } = await supabase
        .from("customer_orders")
        .insert([orderPayload])
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      if (products.length > 0 || customItemName.trim()) {
        const orderItems = products.map(
          (product) => ({
            order_id:
              orderData.id,

            product_template_id:
              product.id,

            quantity: 1,

            unit_price: Number(
              product.online_price || 0
            ),

            notes: "",
          })
        );

        if (customItemName.trim()) {
          orderItems.push({
            order_id: orderData.id,
            product_template_id: null,
            item_name: customItemName.trim(),
            quantity: 1,
            unit_price: 0,
            notes: designNotes || "",
          });
        }

        const { error: itemError } =
          await supabase
            .from("customer_order_items")
            .insert(orderItems);

        if (itemError) {
          throw itemError;
        }
      }

      await uploadReferenceImages(
        orderData.id
      );

      // A new order becomes visible in its first shop queue immediately.
      await releaseCustomerOrder(
        orderData.id,
        startingDepartment,
        orderOwner || "Order Builder"
      );

      let ownerNotificationCreated =
        false;

      if (orderOwner) {
        try {
          const notification =
            await createNotificationForAssignedName({
              assignedTo: orderOwner,

              notificationType:
                "Order Assignment",

              title:
                "New Customer Order Assigned",

              message:
                `${orderNumber} • ` +
                `${customerName(selectedOrderCustomer)} — ` +
                `${orderItemNames()} • ` +
                `${orderType} • ` +
                `Starts in ${startingDepartment}`,

              sourceType:
                "customerOrder",

              sourceId:
                orderData.id,

              targetPage:
                "customerOrders",

              priority: rush
                ? "High"
                : "Medium",
            });

          ownerNotificationCreated =
            Boolean(notification);
        } catch (notificationError) {
          console.error(
            "Order assignment notification error:",
            notificationError
          );

          notifications.show({
            title: "Order Created",
            message:
              "The order was created, but the owner notification could not be created.",
            color: "orange",
          });
        }
      }

      notifications.show({
        title: "Order Created",

        message:
          orderOwner &&
          ownerNotificationCreated
            ? `${orderNumber} was created and ${orderOwner} was notified.`
            : designNeeded
              ? `${orderNumber} was created and marked for Design.`
              : `${orderNumber} was created successfully.`,

        color: "green",
      });

      setPage("customerOrders");
    } catch (error) {
      notifications.show({
        title: "Order Error",
        message:
          error.message ||
          "Something went wrong.",
        color: "red",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <MWPageHeader
        title="New Order"
        subtitle="Create standard product orders, repeat orders, and custom artwork orders."
        setPage={setPage}
        showBack
        backPage="customerOrders"
        backLabel="Customer Orders"
      />

      <SimpleGrid
        cols={{
          base: 1,
          md: 2,
        }}
        spacing="lg"
      >
        <MWSection
          title="Person Who Ordered"
          subtitle="Select the customer contact placing this order. Company is shown separately."
        >
          <Stack>
            {selectedOrderCustomer ? (
              <Card
                withBorder
                radius="lg"
                p="md"
              >
                <Group
                  justify="space-between"
                  align="flex-start"
                >
                  <div>
                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      Person Who Ordered
                    </Text>

                    <Title order={4}>
                      {customerName(
                        selectedOrderCustomer
                      )}
                    </Title>

                    {customerCompany(selectedOrderCustomer) && (
                      <Text fw={700} size="sm">
                        {customerCompany(selectedOrderCustomer)}
                      </Text>
                    )}

                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      {selectedOrderCustomer.phone ||
                        "No phone"}{" "}
                      •{" "}
                      {selectedOrderCustomer.email ||
                        "No email"}
                    </Text>
                  </div>

                  <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    onClick={() => {
                      setSelectedOrderCustomer(
                        null
                      );

                      setCustomerSearch("");
                    }}
                  >
                    Change
                  </Button>
                </Group>
              </Card>
            ) : (
              <>
                <TextInput
                  label="Customer Search"
                  placeholder="Search by name, company, phone, or email..."
                  leftSection={
                    <IconSearch size={16} />
                  }
                  value={customerSearch}
                  onChange={(event) =>
                    setCustomerSearch(
                      event.currentTarget.value
                    )
                  }
                />

                {customerSearch.trim().length >
                  0 && (
                  <Stack gap="xs">
                    {filteredCustomers.length ===
                    0 ? (
                      <Card
                        withBorder
                        radius="lg"
                        p="md"
                      >
                        <Text
                          c="dimmed"
                          size="sm"
                        >
                          No matching customers
                          found.
                        </Text>
                      </Card>
                    ) : (
                      filteredCustomers.map(
                        (customer) => (
                          <Card
                            key={customer.id}
                            withBorder
                            radius="lg"
                            p="sm"
                            style={{
                              cursor:
                                "pointer",
                            }}
                            onClick={() => {
                              setSelectedOrderCustomer(
                                customer
                              );

                              setCustomerSearch(
                                ""
                              );
                            }}
                          >
                            <Text fw={700}>
                              {customerName(
                                customer
                              )}
                            </Text>

                            {customerCompany(customer) && (
                              <Text size="sm" fw={700}>
                                {customerCompany(customer)}
                              </Text>
                            )}

                            <Text
                              size="sm"
                              c="dimmed"
                            >
                              {customer.phone ||
                                "No phone"}{" "}
                              •{" "}
                              {customer.email ||
                                "No email"}
                            </Text>
                          </Card>
                        )
                      )
                    )}
                  </Stack>
                )}
              </>
            )}

            <Button
              variant="light"
              color="red"
              onClick={() =>
                setShowQuickAdd(
                  (current) => !current
                )
              }
            >
              {showQuickAdd
                ? "Hide Quick Add"
                : "+ Quick Add New Customer"}
            </Button>

            {showQuickAdd && (
              <Card
                withBorder
                radius="lg"
                p="md"
              >
                <Stack>
                  <Text fw={700}>
                    Quick Add New Customer
                  </Text>

                  <Group grow>
                    <TextInput
                      label="First Name"
                      description="Person placing the order"
                      required
                      value={
                        quickCustomer.first_name
                      }
                      onChange={(event) =>
                        updateQuickCustomer(
                          "first_name",
                          event.currentTarget
                            .value
                        )
                      }
                    />

                    <TextInput
                      label="Last Name"
                      description="Person placing the order"
                      value={
                        quickCustomer.last_name
                      }
                      onChange={(event) =>
                        updateQuickCustomer(
                          "last_name",
                          event.currentTarget
                            .value
                        )
                      }
                    />
                  </Group>

                  <TextInput
                    label="Company Name"
                    value={
                      quickCustomer.company_name
                    }
                    onChange={(event) =>
                      updateQuickCustomer(
                        "company_name",
                        event.currentTarget
                          .value
                      )
                    }
                  />

                  <Group grow>
                    <TextInput
                      label="Phone"
                      value={
                        quickCustomer.phone
                      }
                      onChange={(event) =>
                        updateQuickCustomer(
                          "phone",
                          event.currentTarget
                            .value
                        )
                      }
                    />

                    <TextInput
                      label="Email"
                      value={
                        quickCustomer.email
                      }
                      onChange={(event) =>
                        updateQuickCustomer(
                          "email",
                          event.currentTarget
                            .value
                        )
                      }
                    />
                  </Group>

                  <Button
                    color="red"
                    onClick={
                      createQuickCustomer
                    }
                  >
                    Create & Select Customer
                  </Button>
                </Stack>
              </Card>
            )}
          </Stack>
        </MWSection>

        <MWSection
          title="Order Type"
          subtitle="Custom artwork starts in Design. Repeat designs start in Laser."
        >
          <Stack>
            <Select
              label="Order Type"
              data={[
                "Standard Product",
                "Repeat / Existing Design",
                "Custom Artwork",
                "Field Fabrication",
              ]}
              value={orderType}
              onChange={(value) =>
                applyOrderType(
                  value ||
                    "Standard Product"
                )
              }
            />

            <Select
              label="Order Owner"
              description="Person responsible for following the order through completion."
              placeholder="Select employee"
              data={people}
              value={orderOwner || null}
              onChange={(value) =>
                setOrderOwner(value || "")
              }
              searchable
              clearable
            />

            <Switch
              label="Design Needed"
              checked={designNeeded}
              onChange={(event) => {
                const checked =
                  event.currentTarget.checked;

                setDesignNeeded(checked);

                setDesignStatus(
                  checked
                    ? "Design Needed"
                    : "Not Required"
                );

                setStartingDepartment(
                  checked
                    ? "Design"
                    : "Laser"
                );

                setDesignFeeRequired(
                  checked
                );

                setDesignFeeStatus(
                  checked
                    ? "Pending"
                    : "Not Required"
                );

                if (checked) {
                  setOrderType(
                    "Custom Artwork"
                  );

                  setDesignFeeAmount(50);
                } else if (
                  orderType ===
                  "Custom Artwork"
                ) {
                  setOrderType(
                    "Standard Product"
                  );
                }
              }}
            />

            <Switch
              label="$50 Design Fee Required"
              checked={designFeeRequired}
              disabled={
                !designNeeded &&
                orderType !==
                  "Custom Artwork"
              }
              onChange={(event) => {
                const checked =
                  event.currentTarget.checked;

                setDesignFeeRequired(
                  checked
                );

                setDesignFeeStatus(
                  checked
                    ? "Pending"
                    : "Not Required"
                );

                setDesignFeeAmount(
                  checked ? 50 : 0
                );
              }}
            />

            <Group grow>
              <Select
                label="Design Fee Status"
                data={[
                  "Not Required",
                  "Pending",
                  "Paid",
                  "Waived",
                ]}
                value={designFeeStatus}
                onChange={(value) =>
                  setDesignFeeStatus(
                    value ||
                      "Not Required"
                  )
                }
              />

              <NumberInput
                label="Design Fee Amount"
                prefix="$"
                value={designFeeAmount}
                onChange={(value) =>
                  setDesignFeeAmount(
                    value || 0
                  )
                }
              />
            </Group>

            <Group grow>
              <Select
                label="Design Status"
                data={[
                  "Not Required",
                  "Existing Design",
                  "Design Needed",
                  "Design Fee Pending",
                  "Design Fee Paid",
                  "In Design",
                  "Design Proof Sent",
                  "Design Approved",
                  "Ready for Laser",
                ]}
                value={designStatus}
                onChange={(value) =>
                  setDesignStatus(
                    value ||
                      "Not Required"
                  )
                }
              />

              <Select
                label="Starting Department"
                data={[
                  "Design",
                  "Laser",
                  "Prep",
                  "Paint",
                  "QC",
                ]}
                value={
                  startingDepartment
                }
                onChange={(value) =>
                  setStartingDepartment(
                    value || "Laser"
                  )
                }
              />
            </Group>

            <Textarea
              label="Design Notes"
              placeholder="Artwork request, customer idea, design instructions, dimensions, plaque text, etc."
              minRows={5}
              value={designNotes}
              onChange={(event) =>
                setDesignNotes(
                  event.currentTarget.value
                )
              }
            />

            <FileInput
              label="Reference Images"
              placeholder="Upload customer reference images"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              multiple
              value={referenceImages}
              onChange={setReferenceImages}
              clearable
            />

            <Card
              withBorder
              radius="lg"
              p="md"
            >
              <Text
                size="sm"
                c="dimmed"
              >
                Routing
              </Text>

              <Title order={4}>
                This order will start in{" "}
                {startingDepartment}
              </Title>

              <Text
                size="sm"
                c="dimmed"
                mt="xs"
              >
                {designNeeded
                  ? "Design must be completed and approved before production."
                  : "This order can move directly into production."}
              </Text>
            </Card>
          </Stack>
        </MWSection>

      </SimpleGrid>

      <Stack mt="lg">
        <MWSection
          title="Products"
          subtitle="Search the full product catalog and add known or previously designed items."
        >
          <ProductStep
            selectedProducts={products}
            onAddProduct={addProduct}
          />

          <TextInput
            mt="lg"
            label="Custom Item / Design Request"
            description="Use this when the ordered item is not yet in the product catalog. This name follows the order through Design and Production."
            placeholder="Example: 24 in unit crest with crossed arrows"
            value={customItemName}
            onChange={(event) =>
              setCustomItemName(event.currentTarget.value)
            }
          />

          {products.length === 0 && !customItemName.trim() && (
            <Alert
              mt="lg"
              color="red"
              variant="light"
              icon={<IconAlertTriangle size={20} />}
              title="Item Ordered Is Required"
            >
              Add a catalog product or enter the custom item being ordered.
              This prevents unnamed work from entering Design or Production.
            </Alert>
          )}

          {products.length === 0 &&
            customItemName.trim() &&
            designNeeded && (
            <Alert
              mt="lg"
              color="orange"
              variant="light"
              icon={<IconAlertTriangle size={20} />}
              title="Design Intake — Production Blocked"
            >
              This custom item can be saved and sent to Design. Connect it to
              a reusable product template later if Metal Worx plans to sell it
              again.
            </Alert>
          )}

          {(products.length > 0 || customItemName.trim()) && (
            <Alert
              mt="lg"
              color="green"
              variant="light"
              icon={<IconCheck size={20} />}
              title="Order Item Identified"
            >
              {orderItemNames()} will be used as the item identity throughout
              this order.
            </Alert>
          )}
        </MWSection>
      </Stack>

      <SimpleGrid
        cols={{
          base: 1,
          lg: 2,
        }}
        spacing="lg"
        mt="lg"
      >
        <MWSection
          title="Order Details"
          subtitle="Due date, rush status, and notes."
        >
          <Stack>
            <DateInput
              label="Due Date"
              placeholder="Select due date"
              value={dueDate}
              onChange={setDueDate}
            />

            <Switch
              label="Rush Order"
              checked={rush}
              onChange={(event) =>
                setRush(
                  event.currentTarget.checked
                )
              }
            />

            <Textarea
              label="Order Notes"
              placeholder="Customer notes, plaque text, install details, pickup/shipping notes, etc."
              minRows={6}
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.currentTarget.value
                )
              }
            />
          </Stack>
        </MWSection>

        <MWSection
          title="Order Summary"
          subtitle="Live order overview."
        >
          <Stack>
            <Card
              withBorder
              radius="lg"
              p="md"
            >
              <Text
                size="sm"
                c="dimmed"
              >
                Order Identity
              </Text>

              <Title order={4}>
                {customerName(selectedOrderCustomer)} — {orderItemNames()}
              </Title>

              {customerCompany(selectedOrderCustomer) && (
                <Text size="sm" c="dimmed" mt={4}>
                  {customerCompany(selectedOrderCustomer)}
                </Text>
              )}
            </Card>

            <Card
              withBorder
              radius="lg"
              p="md"
            >
              <Group justify="space-between">
                <Text c="dimmed">
                  Order Owner
                </Text>

                <Text fw={700}>
                  {orderOwner ||
                    "Unassigned"}
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text c="dimmed">
                  Order Type
                </Text>

                <Text fw={700}>
                  {orderType}
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text c="dimmed">
                  Starting Department
                </Text>

                <Text fw={700}>
                  {startingDepartment}
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text c="dimmed">
                  Design Needed
                </Text>

                <Text fw={700}>
                  {designNeeded
                    ? "Yes"
                    : "No"}
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text c="dimmed">
                  Design Fee
                </Text>

                <Text fw={700}>
                  {designFeeRequired
                    ? `${designFeeStatus} — $${Number(
                        designFeeAmount ||
                          0
                      ).toFixed(2)}`
                    : "Not Required"}
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text c="dimmed">
                  Reference Images
                </Text>

                <Text fw={700}>
                  {referenceImages?.length ||
                    0}
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text c="dimmed">
                  Products
                </Text>

                <Text fw={700}>
                  {products.length + (customItemName.trim() ? 1 : 0)}
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text c="dimmed">
                  Product Total
                </Text>

                <Text fw={700}>
                  $
                  {productTotal.toFixed(2)}
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text c="dimmed">
                  Estimated Total
                </Text>

                <Text fw={700}>
                  $
                  {estimatedTotal.toFixed(
                    2
                  )}
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text c="dimmed">
                  Rush
                </Text>

                <Text fw={700}>
                  {rush ? "Yes" : "No"}
                </Text>
              </Group>
            </Card>

            {products.map((product) => (
              <Card
                key={product.id}
                withBorder
                radius="lg"
                p="sm"
              >
                <Group justify="space-between">
                  <div>
                    <Text fw={700}>
                      {product.name}
                    </Text>

                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      {product.category ||
                        "Template"}
                    </Text>
                  </div>

                  <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    onClick={() =>
                      removeProduct(
                        product.id
                      )
                    }
                  >
                    Remove
                  </Button>
                </Group>
              </Card>
            ))}

            <Button
              color="red"
              size="md"
              onClick={createOrder}
              loading={isSaving}
              disabled={products.length === 0 && !customItemName.trim()}
            >
              Create Customer Order
            </Button>
          </Stack>
        </MWSection>
      </SimpleGrid>
    </>
  );
}

export default OrderBuilder;
