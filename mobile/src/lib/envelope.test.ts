import { describe, expect, it } from "vitest";

import { ApiError, parseEnvelope } from "./envelope";

describe("parseEnvelope", () => {
  it("returns data on success", () => {
    expect(parseEnvelope(200, { success: true, data: { a: 1 } })).toEqual({ a: 1 });
  });

  it("throws the server's code and message on failure", () => {
    try {
      parseEnvelope(409, { success: false, error: { code: "OUT_OF_STOCK", message: "Only 2 available." } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ code: "OUT_OF_STOCK", message: "Only 2 available.", status: 409 });
    }
  });

  it("never surfaces unexpected bodies", () => {
    expect(() => parseEnvelope(502, "<html>Bad gateway</html>")).toThrow("Something went wrong. Please try again.");
    expect(() => parseEnvelope(500, { success: false })).toThrow("Something went wrong. Please try again.");
  });
});
