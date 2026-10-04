// Pure parsing of the server's standard response envelope (unit tested):
// { success: true, data } | { success: false, error: { code, message } }.

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const GENERIC = "Something went wrong. Please try again.";

export function parseEnvelope<T>(status: number, body: unknown): T {
  if (body && typeof body === "object" && "success" in body) {
    const envelope = body as { success: boolean; data?: unknown; error?: { code?: unknown; message?: unknown } };
    if (envelope.success === true) return envelope.data as T;
    const code = typeof envelope.error?.code === "string" ? envelope.error.code : "INTERNAL_ERROR";
    const message = typeof envelope.error?.message === "string" ? envelope.error.message : GENERIC;
    throw new ApiError(code, message, status);
  }
  throw new ApiError("INTERNAL_ERROR", GENERIC, status);
}
