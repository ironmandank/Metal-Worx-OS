import { supabase } from "../lib/supabase";

export const EMPLOYEE_DEPARTMENTS = [
  "Operations",
  "Office",
  "Design",
  "Production",
  "Laser",
  "Prep",
  "Paint",
  "Powder",
  "QC",
  "Showroom",
  "Install",
];

async function invokeEmployeeLoginFunction(payload) {
  const { data, error } = await supabase.functions.invoke(
    "manage-employee-login",
    { body: payload },
  );

  if (error) {
    let message = error.message;

    try {
      const responseBody = await error.context?.json();
      message = responseBody?.error || message;
    } catch {
      // Keep the original invocation error when no JSON response is available.
    }

    throw new Error(message || "Employee login management failed.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function getEmployeeLogins() {
  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*")
    .not("auth_user_id", "is", null)
    .order("display_name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getEmployeesWithoutLogins() {
  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) throw error;

  const profiles = data || [];
  const linkedNames = new Set(
    profiles
      .filter((profile) => profile.auth_user_id)
      .map((profile) => String(profile.display_name || "").trim().toLowerCase())
      .filter(Boolean),
  );

  return profiles.filter((profile) => {
    const name = String(profile.display_name || "").trim().toLowerCase();
    return (
      profile.profile_type === "Person" &&
      !profile.auth_user_id &&
      !linkedNames.has(name)
    );
  });
}

export async function createEmployeeLogin(values) {
  return invokeEmployeeLoginFunction({
    action: "create",
    profile_id: values.profile_id || null,
    display_name: values.display_name,
    email: values.email,
    department: values.department,
    password: values.password,
    access_level: "Read Only",
  });
}

export async function resetEmployeePassword(profileId, password) {
  return invokeEmployeeLoginFunction({
    action: "reset_password",
    profile_id: profileId,
    password,
  });
}

export async function setEmployeeLoginActive(profileId, isActive) {
  return invokeEmployeeLoginFunction({
    action: "set_active",
    profile_id: profileId,
    is_active: isActive,
  });
}

export async function removeEmployeeLogin(profileId) {
  return invokeEmployeeLoginFunction({
    action: "remove_login",
    profile_id: profileId,
  });
}

export function generateTemporaryPassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%";
  const all = `${letters}${numbers}${symbols}`;
  const random = new Uint32Array(14);
  crypto.getRandomValues(random);

  const required = [
    letters[random[0] % letters.length],
    numbers[random[1] % numbers.length],
    symbols[random[2] % symbols.length],
  ];

  for (let index = 3; index < random.length; index += 1) {
    required.push(all[random[index] % all.length]);
  }

  return required
    .map((character, index) => ({ character, sort: random[index] }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.character)
    .join("");
}
