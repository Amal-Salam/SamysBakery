import { describe, expect, it } from "vitest";

import { deliveryDateStatus, eligibleDeliveryDates } from "@/features/checkout/rules";
import { formatClockTime, formatDeliveryDate, lagosTimeNow } from "@/lib/utils/dates";
import { addressInputSchema } from "@/schemas/address";
import { prepareCheckoutSchema } from "@/schemas/checkout";

// Week of Tue 6 Oct – Sat 10 Oct 2026; cutoff 17:00 (owner decision).
const menu = { weekStart: "2026-10-06", weekEnd: "2026-10-10" };
const CUTOFF = "17:00";

describe("eligibleDeliveryDates", () => {
  it("Sunday/Monday before the week: all of Tuesday–Saturday", () => {
    expect(eligibleDeliveryDates(menu, "2026-10-04", "09:00", CUTOFF)).toEqual([
      "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10",
    ]);
    expect(eligibleDeliveryDates(menu, "2026-10-05", "20:00", CUTOFF)).toHaveLength(5);
  });

  it("before the cutoff, today is offered (same-day delivery)", () => {
    expect(eligibleDeliveryDates(menu, "2026-10-08", "16:59", CUTOFF)[0]).toBe("2026-10-08");
  });

  it("at/after the cutoff, today disappears and the next day is earliest", () => {
    expect(eligibleDeliveryDates(menu, "2026-10-08", "17:00", CUTOFF)).toEqual(["2026-10-09", "2026-10-10"]);
  });

  it("never offers past days", () => {
    expect(eligibleDeliveryDates(menu, "2026-10-09", "08:00", CUTOFF)).toEqual(["2026-10-09", "2026-10-10"]);
  });

  it("Saturday after the cutoff: ordering for the week has closed", () => {
    expect(eligibleDeliveryDates(menu, "2026-10-10", "18:00", CUTOFF)).toEqual([]);
  });

  it("no menu or an ended menu: no dates", () => {
    expect(eligibleDeliveryDates(null, "2026-10-08", "09:00", CUTOFF)).toEqual([]);
    expect(eligibleDeliveryDates(menu, "2026-10-11", "09:00", CUTOFF)).toEqual([]);
  });
});

describe("deliveryDateStatus (API contract §11 examples)", () => {
  const status = (date: string, today = "2026-10-07", now = "09:00") =>
    deliveryDateStatus(date, menu, today, now, CUTOFF);

  it.each([
    ["Sunday", "2026-10-11", "DELIVERY_DATE_INVALID"],
    ["Monday", "2026-10-12", "DELIVERY_DATE_INVALID"],
    ["next week's Tuesday", "2026-10-13", "DELIVERY_DATE_INVALID"],
    ["yesterday", "2026-10-06", "DELIVERY_DATE_INVALID"],
    ["current eligible Thursday", "2026-10-08", "VALID"],
  ])("%s → %s", (_label, date, expected) => {
    expect(status(date)).toBe(expected);
  });

  it("today after cutoff → ORDER_CUTOFF_PASSED", () => {
    expect(status("2026-10-07", "2026-10-07", "17:30")).toBe("ORDER_CUTOFF_PASSED");
  });

  it("no published menu → MENU_UNAVAILABLE", () => {
    expect(deliveryDateStatus("2026-10-08", null, "2026-10-07", "09:00", CUTOFF)).toBe("MENU_UNAVAILABLE");
  });
});

describe("date formatting", () => {
  it("labels today and tomorrow", () => {
    expect(formatDeliveryDate("2026-10-07", "2026-10-07")).toBe("Today, Wed 7 Oct");
    expect(formatDeliveryDate("2026-10-08", "2026-10-07")).toBe("Tomorrow, Thu 8 Oct");
    expect(formatDeliveryDate("2026-10-10", "2026-10-07")).toBe("Sat 10 Oct");
  });
  it("formats the cutoff for customers", () => {
    expect(formatClockTime("17:00")).toBe("5:00 PM");
    expect(formatClockTime("00:30")).toBe("12:30 AM");
  });
  it("reads Lagos wall-clock time", () => {
    expect(lagosTimeNow(new Date("2026-10-07T16:30:00Z"))).toBe("17:30");
  });
});

describe("addressInputSchema", () => {
  const valid = {
    label: "",
    recipientName: "Ada Obi",
    phone: "0803 123 4567",
    addressLine: "12 Aminu Kano Crescent, Wuse 2",
    city: "Abuja",
    state: "FCT",
    additionalInfo: "",
  };
  it("defaults the label and empties optional details", () => {
    expect(addressInputSchema.parse(valid)).toMatchObject({ label: "Home", additionalInfo: null });
  });
  it.each(["+2348031234567", "08031234567", "0803-123-4567"])("accepts phone %s", (phone) => {
    expect(addressInputSchema.safeParse({ ...valid, phone }).success).toBe(true);
  });
  it.each(["", "abc", "123", "<script>"])("rejects phone %s", (phone) => {
    expect(addressInputSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });
  it("requires the street, city and state", () => {
    for (const field of ["addressLine", "city", "state", "recipientName"] as const) {
      expect(addressInputSchema.safeParse({ ...valid, [field]: " " }).success).toBe(false);
    }
  });
});

describe("prepareCheckoutSchema", () => {
  const address = "40000000-0000-4000-8000-000000000001";
  it("requires exactly one of saved address or new address", () => {
    expect(prepareCheckoutSchema.safeParse({ deliveryDate: "2026-10-08", specialNotes: "" }).success).toBe(false);
    expect(prepareCheckoutSchema.safeParse({ deliveryDate: "2026-10-08", addressId: address, specialNotes: "" }).success).toBe(true);
  });
  it("limits special notes to 500 characters", () => {
    const base = { deliveryDate: "2026-10-08", addressId: address };
    expect(prepareCheckoutSchema.safeParse({ ...base, specialNotes: "x".repeat(500) }).success).toBe(true);
    expect(prepareCheckoutSchema.safeParse({ ...base, specialNotes: "x".repeat(501) }).success).toBe(false);
  });
  it("rejects malformed dates", () => {
    expect(prepareCheckoutSchema.safeParse({ deliveryDate: "Friday", addressId: address, specialNotes: "" }).success).toBe(false);
  });
});
