import { describe, expect, it } from "vitest";

import { AUDIT_ACTION_NAMES, describeAuditEvent, humanizeAction } from "@/features/admin/audit-format";

describe("describeAuditEvent", () => {
  it("order status changes show labels, corrections and reasons", () => {
    expect(
      describeAuditEvent("ORDER_STATUS_CHANGED", { from: "READY", to: "BAKING", direction: "CORRECTION", reason: "Too early" })
    ).toEqual({ label: "Status changed: Ready → Baking/Preparing (correction)", detail: "Reason: Too early" });
    expect(describeAuditEvent("ORDER_STATUS_CHANGED", { from: "PAID", to: "RECEIVED", direction: "FORWARD" })).toEqual({
      label: "Status changed: Paid → Received",
      detail: null,
    });
  });

  it("cancellations say who cancelled", () => {
    expect(describeAuditEvent("ORDER_CANCELLED", { from: "PAID", cancelled_by: "CUSTOMER" }).label).toBe(
      "Order cancelled by the customer (was Paid)"
    );
    expect(describeAuditEvent("ORDER_CANCELLED", { from: "BAKING", cancelled_by: "ADMIN", reason: "Oven broke" })).toEqual({
      label: "Order cancelled by an admin (was Baking/Preparing)",
      detail: "Reason: Oven broke",
    });
  });

  it("refund steps are distinguishable", () => {
    expect(describeAuditEvent("REFUND_INITIATED", { amount: 7500 }).label).toBe("Refund of ₦7,500 requested");
    expect(describeAuditEvent("REFUND_REQUESTED", { provider_status: "pending", reason: "CANCELLATION" })).toEqual({
      label: "Refund sent to Paystack",
      detail: "Paystack status: pending",
    });
    expect(describeAuditEvent("REFUND_REQUESTED", { reason: "LATE_PAYMENT" }).label).toBe("Refund sent to Paystack (late payment)");
    expect(describeAuditEvent("REFUND_CONFIRMED", {}).label).toBe("Refund confirmed by Paystack");
    expect(describeAuditEvent("REFUND_FAILED", {}).label).toBe("Refund failed at Paystack");
  });

  it("menu product changes list before → after values", () => {
    expect(
      describeAuditEvent("MENU_PRODUCT_UPDATED", {
        name: "Bun",
        changes: { price: { from: 3000, to: 3500 }, weekly_quantity: { from: 12, to: 15 } },
        fields: ["description"],
      })
    ).toEqual({ label: "Bun changed", detail: "Price ₦3,000 → ₦3,500; Quantity 12 → 15; Edited description" });
    expect(
      describeAuditEvent("MENU_PRODUCT_ADDED", { name: "Bun", price: 3000, weekly_quantity: 12, low_stock_threshold: 2 })
    ).toEqual({ label: "Bun added: ₦3,000, 12 available", detail: "Low-stock alert at 2" });
  });

  it("stock additions show the resulting availability and reason", () => {
    expect(
      describeAuditEvent("INVENTORY_INCREASED", {
        product: "Loaf", quantity: 5, reason: "Extra batch", available_before: 2, available_after: 7,
      })
    ).toEqual({ label: "+5 Loaf (available 2 → 7)", detail: "Reason: Extra batch" });
  });

  it("settings, roles and accounts", () => {
    expect(describeAuditEvent("ORDER_CUTOFF_CHANGED", { from: "17:00", to: "16:30" }).label).toBe(
      "Ordering cutoff changed: 5:00 PM → 4:30 PM"
    );
    expect(describeAuditEvent("ACCOUNT_ADMIN_ACTION", { from: "CUSTOMER", to: "ADMIN", name: "Ada", via: "OPERATOR" })).toEqual({
      label: "Role changed: Customer → Admin (Ada)",
      detail: "Changed by the operator script",
    });
    expect(describeAuditEvent("ACCOUNT_DELETED", { orders_anonymized: 1 }).detail).toBe("1 past order anonymized");
  });

  it("product edits name the fields and the previous name", () => {
    expect(describeAuditEvent("PRODUCT_UPDATED", { name: "Sourdough", previous_name: "Loaf", fields: ["name", "description"] })).toEqual({
      label: "Product edited: Sourdough",
      detail: "Changed name, description; previously “Loaf”",
    });
  });

  it("tolerates missing or odd metadata and unknown actions", () => {
    expect(describeAuditEvent("MENU_PUBLISHED", null)).toEqual({ label: "Menu published", detail: null });
    expect(describeAuditEvent("SOMETHING_NEW", "not-an-object")).toEqual({ label: "Something new", detail: null });
    expect(humanizeAction("A_B")).toBe("A b");
  });

  it("every named action has a description that isn't just its code", () => {
    for (const action of Object.keys(AUDIT_ACTION_NAMES)) {
      expect(describeAuditEvent(action, {}).label).not.toBe(action);
    }
  });
});
