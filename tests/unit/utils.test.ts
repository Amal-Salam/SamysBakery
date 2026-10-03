import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting Tailwind classes, keeping the last", () => {
    expect(cn("px-2 text-body", "px-4")).toBe("text-body px-4");
  });

  it("drops falsy values", () => {
    expect(cn("block", false, undefined, null, "")).toBe("block");
  });
});
