// Friendly messages for Supabase Auth errors (never raw server text).
export function authMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Please verify your email address first.";
    case "otp_expired":
    case "otp_disabled":
      return "That code has expired or isn't valid. Request a new one.";
    case "weak_password":
      return "Choose a stronger password (at least 8 characters).";
    case "email_address_invalid":
      return "Enter a valid email address.";
    case "signup_disabled":
      return "New accounts can't be created right now. Please try again later.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    default:
      return fallback;
  }
}
