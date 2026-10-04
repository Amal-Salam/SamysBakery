// Pure validation of the app's public configuration (unit tested).
// Only PUBLIC values may ever be bundled into the app: anyone can extract them
// from the installed package. Secrets (service-role, Paystack, Resend) live on
// the server only.

export type AppConfig = { apiUrl: string; supabaseUrl: string; supabaseKey: string };

export type RawConfig = {
  apiUrl: string | undefined;
  supabaseUrl: string | undefined;
  supabaseKey: string | undefined;
};

function checkUrl(name: string, value: string | undefined, allowHttp: boolean, problems: string[]): string {
  if (!value) {
    problems.push(`${name} is missing`);
    return "";
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    problems.push(`${name} is not a valid URL`);
    return "";
  }
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    problems.push(`${name} must use https`);
  }
  return value.replace(/\/+$/, "");
}

/**
 * Validates configuration. Plain http is allowed only in development builds
 * (a phone talking to the developer's Mac on the local network).
 */
export function validateConfig(raw: RawConfig, isDevelopment: boolean): AppConfig {
  const problems: string[] = [];
  const apiUrl = checkUrl("EXPO_PUBLIC_API_URL", raw.apiUrl, isDevelopment, problems);
  const supabaseUrl = checkUrl("EXPO_PUBLIC_SUPABASE_URL", raw.supabaseUrl, isDevelopment, problems);
  const supabaseKey = raw.supabaseKey ?? "";
  if (!supabaseKey) problems.push("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing");
  // Guard against ever shipping a secret key by mistake.
  if (/^sb_secret_/.test(supabaseKey) || /service_role/.test(decodeJwtPayload(supabaseKey))) {
    problems.push("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be the publishable key, never a secret key");
  }
  if (problems.length > 0) throw new Error(`App configuration problem: ${problems.join("; ")}`);
  return { apiUrl, supabaseUrl, supabaseKey };
}

function decodeJwtPayload(value: string): string {
  const part = value.split(".")[1];
  if (!part) return "";
  try {
    return atob(part.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return "";
  }
}
