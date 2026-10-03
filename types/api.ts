// Standard server-operation contract — docs/API & Server Action Contract.md §3–4.

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "OUT_OF_STOCK",
  "MENU_UNAVAILABLE",
  "PRODUCT_UNAVAILABLE",
  "DELIVERY_DATE_INVALID",
  "ORDER_CUTOFF_PASSED",
  "CHECKOUT_INVALID",
  "PAYMENT_FAILED",
  "PAYMENT_VERIFICATION_FAILED",
  "PAYMENT_AMOUNT_MISMATCH",
  "PAYMENT_ALREADY_PROCESSED",
  "ORDER_NOT_CANCELLABLE",
  "REFUND_FAILED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ActionError = {
  code: ErrorCode;
  message: string;
  /** Per-field validation messages, safe to show next to form inputs. */
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: ActionError };
