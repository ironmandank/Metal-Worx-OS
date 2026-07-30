import {
  createClient,
} from "@supabase/supabase-js";

const supabaseUrl =
  "https://xpjvpcreljzavelbtjxj.supabase.co";

const supabaseKey =
  "sb_publishable_ODr-ZjEuq14IRSwBBrhVgA_-aj0dOh9";

const MW_SESSION_EXPIRATION_KEY =
  "metal-worx-os-session-expires-at";

const MW_BROWSER_SESSION_KEY =
  "metal-worx-os-browser-session";

export const MW_SESSION_DURATION_MS =
  24 * 60 * 60 * 1000;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey:
        "metal-worx-os-auth-session",
    },
  }
);

function browserStorageAvailable() {
  return (
    typeof window !== "undefined" &&
    window.localStorage &&
    window.sessionStorage
  );
}

export function startMetalWorxSession(
  keepSignedIn = true
) {
  if (!browserStorageAvailable()) {
    return;
  }

  if (keepSignedIn) {
    const expirationTime =
      Date.now() +
      MW_SESSION_DURATION_MS;

    window.localStorage.setItem(
      MW_SESSION_EXPIRATION_KEY,
      String(expirationTime)
    );

    window.sessionStorage.removeItem(
      MW_BROWSER_SESSION_KEY
    );

    return;
  }

  window.localStorage.removeItem(
    MW_SESSION_EXPIRATION_KEY
  );

  window.sessionStorage.setItem(
    MW_BROWSER_SESSION_KEY,
    "active"
  );
}

export function clearMetalWorxSession() {
  if (!browserStorageAvailable()) {
    return;
  }

  window.localStorage.removeItem(
    MW_SESSION_EXPIRATION_KEY
  );

  window.sessionStorage.removeItem(
    MW_BROWSER_SESSION_KEY
  );
}

export function getMetalWorxSessionStatus() {
  if (!browserStorageAvailable()) {
    return {
      valid: false,
      mode: "unavailable",
      expiresAt: null,
    };
  }

  const storedExpiration =
    window.localStorage.getItem(
      MW_SESSION_EXPIRATION_KEY
    );

  const browserSessionActive =
    window.sessionStorage.getItem(
      MW_BROWSER_SESSION_KEY
    ) === "active";

  if (storedExpiration) {
    const expirationTime =
      Number(storedExpiration);

    if (
      Number.isFinite(
        expirationTime
      ) &&
      expirationTime > Date.now()
    ) {
      return {
        valid: true,
        mode: "remembered",
        expiresAt:
          expirationTime,
      };
    }

    window.localStorage.removeItem(
      MW_SESSION_EXPIRATION_KEY
    );

    return {
      valid: false,
      mode: "expired",
      expiresAt:
        Number.isFinite(
          expirationTime
        )
          ? expirationTime
          : null,
    };
  }

  if (browserSessionActive) {
    return {
      valid: true,
      mode: "browser",
      expiresAt: null,
    };
  }

  return {
    valid: false,
    mode: "missing",
    expiresAt: null,
  };
}

export function isMetalWorxSessionValid() {
  return getMetalWorxSessionStatus()
    .valid;
}

export function getMetalWorxSessionExpiration() {
  return getMetalWorxSessionStatus()
    .expiresAt;
}