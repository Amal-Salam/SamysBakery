import { describe, expect, it } from "vitest";

import { chunkKey, countKey, safeKey, splitIntoChunks } from "./chunks";

describe("secure-storage chunking", () => {
  it("splits and rejoins large values exactly", () => {
    const value = "x".repeat(4000) + "é✓";
    const chunks = splitIntoChunks(value, 1800);
    expect(chunks).toHaveLength(3);
    expect(chunks.join("")).toBe(value);
    expect(splitIntoChunks("")).toEqual([""]);
  });

  it("keeps keys within SecureStore's allowed characters", () => {
    expect(safeKey("sb-abc-auth-token")).toBe("sb-abc-auth-token");
    expect(safeKey("a/b:c d")).toBe("a_b_c_d");
    expect(chunkKey("sb:x", 2)).toBe("sb_x.2");
    expect(countKey("sb:x")).toBe("sb_x.count");
  });
});
