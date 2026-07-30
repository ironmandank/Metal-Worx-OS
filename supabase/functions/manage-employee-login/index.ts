import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";

type AccountAction =
  | "create"
  | "reset_password"
  | "set_active"
  | "remove_login";
type AccessLevel = "Administrator" | "Read Only";

type RequestBody = {
  action?: AccountAction;
  display_name?: string;
  email?: string;
  department?: string;
  password?: string;
  profile_id?: string;
  is_active?: boolean;
  access_level?: AccessLevel;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedAccessLevels = new Set<AccessLevel>([
  "Administrator",
  "Read Only",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAccessLevel(value: unknown): AccessLevel {
  const accessLevel = cleanText(value) as AccessLevel;

  if (allowedAccessLevels.has(accessLevel)) {
    return accessLevel;
  }

  return "Read Only";
}

async function getRequestBody(request: Request): Promise<RequestBody | null> {
  try {
    return (await request.json()) as RequestBody;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const publishableKey =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      "";

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authorization =
      request.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return json(
        {
          error:
            "The Edge Function is missing required Supabase environment variables.",
        },
        500
      );
    }

    if (!authorization.startsWith("Bearer ")) {
      return json(
        {
          error: "Authentication is required.",
        },
        401
      );
    }

    const callerClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return json(
        {
          error: "Your login session could not be verified.",
        },
        401
      );
    }

    const {
      data: callerProfile,
      error: callerProfileError,
    } = await adminClient
      .from("employee_profiles")
      .select(
        "id, display_name, access_level, is_active, auth_user_id"
      )
      .eq("auth_user_id", caller.id)
      .eq("is_active", true)
      .maybeSingle();

    if (callerProfileError) {
      throw callerProfileError;
    }

    if (
      !callerProfile ||
      callerProfile.access_level !== "Administrator"
    ) {
      return json(
        {
          error:
            "An active Administrator login is required.",
        },
        403
      );
    }

    const body = await getRequestBody(request);

    if (!body) {
      return json(
        {
          error: "The request body must contain valid JSON.",
        },
        400
      );
    }

    const action: AccountAction = body.action ?? "create";

    if (
      action !== "create" &&
      action !== "reset_password" &&
      action !== "set_active" &&
      action !== "remove_login"
    ) {
      return json(
        {
          error: "Unsupported account action.",
        },
        400
      );
    }

    if (action === "create") {
      const profileId = cleanText(body.profile_id);
      let displayName = cleanText(body.display_name);
      const email = cleanText(body.email).toLowerCase();
      let department =
        cleanText(body.department) || "Operations";
      const password = cleanText(body.password);
      const accessLevel = getAccessLevel(body.access_level);

      let selectedProfile: any = null;

      if (profileId) {
        const {
          data: existingProfile,
          error: existingProfileError,
        } = await adminClient
          .from("employee_profiles")
          .select("*")
          .eq("id", profileId)
          .maybeSingle();

        if (existingProfileError) {
          throw existingProfileError;
        }

        if (!existingProfile) {
          return json(
            {
              error: "The selected employee profile was not found.",
            },
            404
          );
        }

        if (existingProfile.auth_user_id) {
          return json(
            {
              error:
                "The selected employee already has a Metal Worx login.",
            },
            409
          );
        }

        if (existingProfile.profile_type !== "Person") {
          return json(
            {
              error:
                "Only individual employee profiles can receive a login.",
            },
            400
          );
        }

        const {
          data: linkedNameMatches,
          error: linkedNameError,
        } = await adminClient
          .from("employee_profiles")
          .select("id, display_name, auth_user_id")
          .ilike("display_name", existingProfile.display_name)
          .not("auth_user_id", "is", null)
          .neq("id", existingProfile.id)
          .limit(1);

        if (linkedNameError) {
          throw linkedNameError;
        }

        if ((linkedNameMatches?.length ?? 0) > 0) {
          return json(
            {
              error:
                `${existingProfile.display_name} already has another profile connected to a login.`,
            },
            409
          );
        }

        selectedProfile = existingProfile;
        displayName = cleanText(existingProfile.display_name);
        department =
          cleanText(existingProfile.department) || department;
      }

      if (!displayName) {
        return json(
          {
            error: "Employee name is required.",
          },
          400
        );
      }

      if (!validEmail(email)) {
        return json(
          {
            error: "Enter a valid employee email address.",
          },
          400
        );
      }

      if (password.length < 8) {
        return json(
          {
            error:
              "The temporary password must contain at least 8 characters.",
          },
          400
        );
      }

      const {
        data: matchingProfiles,
        error: matchingProfileError,
      } = await adminClient
        .from("employee_profiles")
        .select("*")
        .ilike("email", email)
        .limit(2);

      if (matchingProfileError) {
        throw matchingProfileError;
      }

      if ((matchingProfiles?.length ?? 0) > 1) {
        return json(
          {
            error:
              "More than one employee profile uses this email address. Correct the duplicate profiles before creating the login.",
          },
          409
        );
      }

      const emailProfile = matchingProfiles?.[0] ?? null;

      if (
        selectedProfile &&
        emailProfile &&
        emailProfile.id !== selectedProfile.id
      ) {
        return json(
          {
            error:
              "That email address belongs to a different employee profile.",
          },
          409
        );
      }

      const matchingProfile = selectedProfile || emailProfile;

      if (matchingProfile?.auth_user_id) {
        return json(
          {
            error:
              "This employee profile is already connected to a login.",
          },
          409
        );
      }

      const {
        data: authResult,
        error: authError,
      } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          department,
          access_level: accessLevel,
        },
      });

      if (authError) {
        return json(
          {
            error: authError.message,
          },
          400
        );
      }

      const authUserId = authResult.user?.id;

      if (!authUserId) {
        return json(
          {
            error:
              "Supabase Auth did not return the new user ID.",
          },
          500
        );
      }

      let profileResult;

      if (matchingProfile) {
        profileResult = await adminClient
          .from("employee_profiles")
          .update({
            display_name: displayName,
            department,
            email,
            access_level: accessLevel,
            auth_user_id: authUserId,
            is_active: true,
          })
          .eq("id", matchingProfile.id)
          .select()
          .single();
      } else {
        profileResult = await adminClient
          .from("employee_profiles")
          .insert({
            display_name: displayName,
            profile_type: "Person",
            role_title: "Employee",
            department,
            email,
            access_level: accessLevel,
            auth_user_id: authUserId,
            is_active: true,
          })
          .select()
          .single();
      }

      if (profileResult.error) {
        const { error: rollbackError } =
          await adminClient.auth.admin.deleteUser(authUserId);

        if (rollbackError) {
          console.error(
            "Unable to roll back newly created Auth user",
            rollbackError
          );
        }

        throw profileResult.error;
      }

      return json({
        success: true,
        message: `${displayName}'s login was created.`,
        profile: profileResult.data,
      });
    }

    const profileId = cleanText(body.profile_id);

    if (!profileId) {
      return json(
        {
          error: "Employee profile ID is required.",
        },
        400
      );
    }

    const {
      data: targetProfile,
      error: targetError,
    } = await adminClient
      .from("employee_profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();

    if (targetError) {
      throw targetError;
    }

    if (!targetProfile) {
      return json(
        {
          error: "Employee profile was not found.",
        },
        404
      );
    }

    if (!targetProfile.auth_user_id) {
      return json(
        {
          error:
            "This employee is not connected to a Supabase login.",
        },
        400
      );
    }

    if (action === "reset_password") {
      const password = cleanText(body.password);

      if (password.length < 8) {
        return json(
          {
            error:
              "The new password must contain at least 8 characters.",
          },
          400
        );
      }

      const { error: passwordError } =
        await adminClient.auth.admin.updateUserById(
          targetProfile.auth_user_id,
          {
            password,
          }
        );

      if (passwordError) {
        throw passwordError;
      }

      return json({
        success: true,
        message: `${targetProfile.display_name}'s password was reset.`,
      });
    }

    if (action === "set_active") {
      if (typeof body.is_active !== "boolean") {
        return json(
          {
            error:
              "The active status must be provided as true or false.",
          },
          400
        );
      }

      const isActive = body.is_active;

      if (
        targetProfile.auth_user_id === caller.id &&
        !isActive
      ) {
        return json(
          {
            error:
              "You cannot deactivate your own login.",
          },
          400
        );
      }

      const { error: authUpdateError } =
        await adminClient.auth.admin.updateUserById(
          targetProfile.auth_user_id,
          {
            ban_duration: isActive ? "none" : "876000h",
          }
        );

      if (authUpdateError) {
        throw authUpdateError;
      }

      const { error: profileUpdateError } =
        await adminClient
          .from("employee_profiles")
          .update({
            is_active: isActive,
          })
          .eq("id", profileId);

      if (profileUpdateError) {
        const { error: authRollbackError } =
          await adminClient.auth.admin.updateUserById(
            targetProfile.auth_user_id,
            {
              ban_duration: targetProfile.is_active
                ? "none"
                : "876000h",
            }
          );

        if (authRollbackError) {
          console.error(
            "Unable to roll back Auth active status",
            authRollbackError
          );
        }

        throw profileUpdateError;
      }

      return json({
        success: true,
        message: `${targetProfile.display_name}'s login was ${
          isActive ? "activated" : "deactivated"
        }.`,
      });
    }

    if (action === "remove_login") {
      if (targetProfile.auth_user_id === caller.id) {
        return json(
          {
            error:
              "You cannot remove the login account you are currently using.",
          },
          400
        );
      }

      const authUserId = targetProfile.auth_user_id;
      const previousEmail = targetProfile.email;
      const previousAccessLevel = targetProfile.access_level;

      const { error: unlinkError } = await adminClient
        .from("employee_profiles")
        .update({
          auth_user_id: null,
          email: null,
          access_level: "Read Only",
          is_active: true,
        })
        .eq("id", profileId);

      if (unlinkError) {
        throw unlinkError;
      }

      const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(authUserId);

      if (deleteError) {
        const { error: rollbackError } = await adminClient
          .from("employee_profiles")
          .update({
            auth_user_id: authUserId,
            email: previousEmail,
            access_level: previousAccessLevel,
            is_active: targetProfile.is_active,
          })
          .eq("id", profileId);

        if (rollbackError) {
          console.error(
            "Unable to restore employee login link after Auth deletion failed",
            rollbackError
          );
        }

        throw deleteError;
      }

      return json({
        success: true,
        message:
          `${targetProfile.display_name}'s login was removed. ` +
          "The employee profile and work history were preserved.",
      });
    }

    return json(
      {
        error: "Unsupported account action.",
      },
      400
    );
  } catch (error) {
    console.error("manage-employee-login error", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : error &&
            typeof error === "object" &&
            "message" in error
          ? String(error.message)
          : typeof error === "string"
            ? error
            : "Employee login management failed.";

    return json(
      {
        error: errorMessage,
      },
      500
    );
  }
});
