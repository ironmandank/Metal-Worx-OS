import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconKey,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import {
  createEmployeeLogin,
  EMPLOYEE_DEPARTMENTS,
  generateTemporaryPassword,
  getEmployeeLogins,
  getEmployeesWithoutLogins,
  removeEmployeeLogin,
  resetEmployeePassword,
  setEmployeeLoginActive,
} from "../services/employeeLoginService";

const EMPTY_FORM = {
  profile_id: null,
  display_name: "",
  email: "",
  department: "Operations",
  password: "",
};

function EmployeeLoginManagement() {
  const [logins, setLogins] = useState([]);
  const [employeesWithoutLogins, setEmployeesWithoutLogins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resetEmployee, setResetEmployee] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [removeEmployee, setRemoveEmployee] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    loadLogins();
  }, []);

  async function loadLogins() {
    setLoading(true);
    try {
      const [loginRows, availableRows] = await Promise.all([
        getEmployeeLogins(),
        getEmployeesWithoutLogins(),
      ]);
      setLogins(loginRows);
      setEmployeesWithoutLogins(availableRows);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not load employee logins",
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectExistingEmployee(profileId) {
    if (!profileId) {
      setForm(EMPTY_FORM);
      return;
    }

    const employee = employeesWithoutLogins.find(
      (profile) => String(profile.id) === String(profileId),
    );
    if (!employee) return;

    setForm({
      profile_id: String(employee.id),
      display_name: employee.display_name || "",
      email: employee.email || "",
      department: employee.department || "Operations",
      password: "",
    });
  }

  function makePassword(target = "create") {
    const password = generateTemporaryPassword();
    if (target === "reset") {
      setResetPassword(password);
    } else {
      setField("password", password);
    }
  }

  async function submitNewLogin() {
    if (!form.display_name.trim() || !form.email.trim() || !form.password) {
      notifications.show({
        color: "orange",
        title: "Employee information required",
        message: "Enter the employee name, email, and temporary password.",
      });
      return;
    }

    setSaving(true);
    try {
      const result = await createEmployeeLogin(form);
      notifications.show({
        color: "green",
        title: "Employee login created",
        message: result.message,
      });
      setForm(EMPTY_FORM);
      await loadLogins();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not create employee login",
        message: error.message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleLogin(employee, isActive) {
    try {
      const result = await setEmployeeLoginActive(employee.id, isActive);
      notifications.show({
        color: isActive ? "green" : "orange",
        title: isActive ? "Login activated" : "Login deactivated",
        message: result.message,
      });
      await loadLogins();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not change login status",
        message: error.message,
      });
    }
  }

  async function submitPasswordReset() {
    if (!resetEmployee || resetPassword.length < 8) {
      notifications.show({
        color: "orange",
        title: "Password is too short",
        message: "The new temporary password must contain at least 8 characters.",
      });
      return;
    }

    setResetting(true);
    try {
      const result = await resetEmployeePassword(resetEmployee.id, resetPassword);
      notifications.show({
        color: "green",
        title: "Password reset",
        message: result.message,
      });
      setResetEmployee(null);
      setResetPassword("");
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not reset password",
        message: error.message,
      });
    } finally {
      setResetting(false);
    }
  }

  async function confirmRemoveLogin() {
    if (!removeEmployee) return;

    setRemoving(true);
    try {
      const result = await removeEmployeeLogin(removeEmployee.id);
      notifications.show({
        color: "green",
        title: "Employee login removed",
        message: result.message,
      });
      setRemoveEmployee(null);
      await loadLogins();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not remove employee login",
        message: error.message,
      });
    } finally {
      setRemoving(false);
    }
  }

  const metrics = useMemo(
    () => ({
      total: logins.length,
      active: logins.filter((employee) => employee.is_active).length,
      inactive: logins.filter((employee) => !employee.is_active).length,
      administrators: logins.filter(
        (employee) => employee.access_level === "Administrator"
      ).length,
    }),
    [logins]
  );

  return (
    <>
      <MWPageHeader
        title="Employee Login Management"
        subtitle="Create and manage secure Metal Worx OS employee accounts."
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
        {[
          ["Total Logins", metrics.total, IconUsers, "gray"],
          ["Active", metrics.active, IconUserCheck, "green"],
          ["Inactive", metrics.inactive, IconAlertTriangle, "orange"],
          [
            "Awaiting Login",
            employeesWithoutLogins.length,
            IconUserPlus,
            "orange",
          ],
        ].map(([label, value, Icon, color]) => (
          <Card
            key={label}
            withBorder
            radius="lg"
            p="lg"
            style={{
              background:
                "linear-gradient(145deg, rgba(27,31,36,.98), rgba(16,19,23,.98))",
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <div>
                <Title order={2} c={color} style={{ lineHeight: 1 }}>
                  {value}
                </Title>
                <Text size="xs" fw={900} c="dimmed" tt="uppercase" mt={8}>
                  {label}
                </Text>
              </div>
              <Icon size={28} color={`var(--mantine-color-${color}-6)`} />
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <MWSection
        title="Enable Employee Login"
        subtitle="Connect an existing employee profile to a secure Metal Worx OS login."
      >
        <Stack gap="lg">
          <Alert color="blue" icon={<IconShieldCheck size={20} />}>
            Every authenticated employee receives the same operational access
            during the pilot. Selecting an existing employee prevents duplicate
            personnel records.
          </Alert>

          <Select
            label="Existing Employee"
            description="Select a person who does not already have a login"
            placeholder="Choose Chad, Lori, Austin, or another employee"
            searchable
            clearable
            data={employeesWithoutLogins.map((employee) => ({
              value: String(employee.id),
              label: `${employee.display_name}${
                employee.department ? ` — ${employee.department}` : ""
              }`,
            }))}
            value={form.profile_id}
            onChange={selectExistingEmployee}
          />

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <TextInput
              required
              label="Employee Name"
              description={
                form.profile_id
                  ? "Loaded from the existing employee profile"
                  : "Use only for a genuinely new employee"
              }
              placeholder="First and last name"
              value={form.display_name}
              readOnly={Boolean(form.profile_id)}
              onChange={(event) => setField("display_name", event.currentTarget.value)}
            />
            <TextInput
              required
              type="email"
              label="Login Email"
              placeholder="employee@metalworx.com"
              value={form.email}
              onChange={(event) => setField("email", event.currentTarget.value)}
            />
            <Select
              required
              searchable
              label="Department"
              data={EMPLOYEE_DEPARTMENTS}
              value={form.department}
              onChange={(value) => setField("department", value || "Operations")}
            />
          </SimpleGrid>

          <Group align="flex-end" wrap="wrap">
            <PasswordInput
              required
              label="Temporary Password"
              description="At least 8 characters"
              value={form.password}
              onChange={(event) => setField("password", event.currentTarget.value)}
              style={{ flex: "1 1 300px" }}
            />
            <Button variant="light" color="gray" onClick={() => makePassword("create")}>
              Generate Password
            </Button>
            <CopyButton value={form.password} timeout={1800}>
              {({ copied, copy }) => (
                <Button
                  variant="light"
                  color={copied ? "green" : "gray"}
                  leftSection={copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
                  disabled={!form.password}
                  onClick={copy}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </CopyButton>
          </Group>

          <Group justify="flex-end">
            <Button
              color="red"
              size="md"
              leftSection={<IconUserPlus size={18} />}
              loading={saving}
              onClick={submitNewLogin}
            >
              {form.profile_id
                ? "Enable Login for Existing Employee"
                : "Create New Employee and Login"}
            </Button>
          </Group>
        </Stack>
      </MWSection>

      <MWSection
        title="Current Employee Logins"
        subtitle={`${logins.length} Supabase Auth-linked employee account${
          logins.length === 1 ? "" : "s"
        }`}
      >
        <Group justify="flex-end" mb="lg">
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconRefresh size={17} />}
            onClick={loadLogins}
          >
            Refresh
          </Button>
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader color="red" />
          </Group>
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
            {logins.map((employee) => (
              <Card key={employee.id} withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Title order={3}>{employee.display_name}</Title>
                      <Text c="dimmed" size="sm">
                        {employee.email}
                      </Text>
                    </div>
                    <Badge color={employee.is_active ? "green" : "orange"}>
                      {employee.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Group>

                  <Group gap="xs">
                    <Badge color="red" variant="light">
                      {employee.access_level || "Administrator"}
                    </Badge>
                    <Badge color="gray" variant="outline">
                      {employee.department || "No Department"}
                    </Badge>
                    <Badge color="green" variant="outline">
                      Auth Linked
                    </Badge>
                  </Group>

                  <Group justify="space-between" align="center" wrap="wrap">
                    <Switch
                      color="green"
                      label={employee.is_active ? "Login enabled" : "Login disabled"}
                      checked={Boolean(employee.is_active)}
                      onChange={(event) =>
                        toggleLogin(employee, event.currentTarget.checked)
                      }
                    />
                    <Group gap="sm">
                      <Button
                        variant="light"
                        color="gray"
                        leftSection={<IconKey size={17} />}
                        onClick={() => {
                          setResetEmployee(employee);
                          setResetPassword("");
                        }}
                      >
                        Reset Password
                      </Button>
                      <Button
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={17} />}
                        onClick={() => setRemoveEmployee(employee)}
                      >
                        Remove Login
                      </Button>
                    </Group>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </MWSection>

      <Modal
        opened={Boolean(resetEmployee)}
        onClose={() => setResetEmployee(null)}
        title="Reset Employee Password"
        centered
      >
        <Stack gap="lg">
          <Text>
            Set a new temporary password for <strong>{resetEmployee?.display_name}</strong>.
          </Text>
          <PasswordInput
            label="New Temporary Password"
            description="At least 8 characters"
            value={resetPassword}
            onChange={(event) => setResetPassword(event.currentTarget.value)}
          />
          <Group grow>
            <Button variant="light" color="gray" onClick={() => makePassword("reset")}>
              Generate
            </Button>
            <CopyButton value={resetPassword} timeout={1800}>
              {({ copied, copy }) => (
                <Button
                  variant="light"
                  color={copied ? "green" : "gray"}
                  disabled={!resetPassword}
                  onClick={copy}
                >
                  {copied ? "Copied" : "Copy Password"}
                </Button>
              )}
            </CopyButton>
          </Group>
          <Button
            color="red"
            leftSection={<IconKey size={17} />}
            loading={resetting}
            onClick={submitPasswordReset}
          >
            Reset Password
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(removeEmployee)}
        onClose={() => {
          if (!removing) setRemoveEmployee(null);
        }}
        title="Remove Employee Login"
        centered
        closeOnClickOutside={!removing}
        closeOnEscape={!removing}
      >
        <Stack gap="lg">
          <Alert color="red" icon={<IconAlertTriangle size={20} />}>
            This permanently deletes the Supabase login for{" "}
            <strong>{removeEmployee?.display_name}</strong>. Their employee
            profile, department, assignments, and work history will remain.
          </Alert>
          <Text size="sm" c="dimmed">
            You can enable a new login for this employee later when their
            correct email address is available.
          </Text>
          <Group grow>
            <Button
              variant="light"
              color="gray"
              disabled={removing}
              onClick={() => setRemoveEmployee(null)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={17} />}
              loading={removing}
              onClick={confirmRemoveLogin}
            >
              Permanently Remove Login
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default EmployeeLoginManagement;
