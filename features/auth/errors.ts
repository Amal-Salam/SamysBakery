import type { ActionError } from "@/types/api";

type AuthErrorLike = { code?: string | null; status?: number | null } | null | undefined;

/**
 * Maps a Supabase Auth error to an approved error code and a safe message.
 * Unknown errors become INTERNAL_ERROR; provider messages are never surfaced.
 */
export function mapAuthError(error: AuthErrorLike): ActionError {
  switch (error?.code) {
    case "invalid_credentials":
      return { code: "UNAUTHENTICATED", message: "Incorrect email or password." };
    case "email_not_confirmed":
      return {
        code: "UNAUTHENTICATED",
        message: "Please verify your email address first. Check your inbox for the link.",
      };
    case "weak_password":
      return {
        code: "VALIDATION_ERROR",
        message: "Please choose a stronger password.",
        fieldErrors: { password: ["Please choose a stronger password."] },
      };
    case "same_password":
      return {
        code: "VALIDATION_ERROR",
        message: "Choose a password different from your current one.",
        fieldErrors: { password: ["Choose a password different from your current one."] },
      };
    case "user_banned":
      return { code: "FORBIDDEN", message: "This account cannot sign in." };
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return {
        code: "UNAUTHENTICATED",
        message: "Your session has expired. Please sign in again.",
      };
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      // No approved RATE_LIMITED code exists; keep the code generic, message helpful.
      return {
        code: "INTERNAL_ERROR",
        message: "Too many attempts. Please wait a few minutes and try again.",
      };
    default:
      return { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." };
  }
}
