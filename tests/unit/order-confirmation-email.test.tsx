import { describe, expect, it } from "vitest";

import { renderOrderConfirmation, type OrderConfirmationData } from "@/emails/order-confirmation";

const data: OrderConfirmationData = {
  orderNumber: "SAM-1042",
  customerName: "Ada",
  items: [
    { name: "Country Sourdough", quantity: 2, unitPrice: "₦6,500", lineTotal: "₦13,000" },
    { name: "Cinnamon Roll", quantity: 1, unitPrice: "₦2,500", lineTotal: "₦2,500" },
  ],
  subtotal: "₦15,500",
  deliveryDate: "Thursday 8 October 2026",
  recipient: "Ada Obi",
  phone: "0803 123 4567",
  address: "12 Aminu Kano Crescent, Wuse 2, Abuja, FCT",
  additionalInfo: "Blue gate",
  specialNotes: "Please call on arrival",
  orderUrl: "https://example.com/order-confirmation/SAM-1042",
};

describe("order confirmation email (AGENTS.md §32)", () => {
  it("includes every required detail in HTML and text", async () => {
    const email = await renderOrderConfirmation(data);
    expect(email.subject).toBe("Your Samy's Bakery order SAM-1042 is confirmed");
    for (const required of [
      "SAM-1042",
      "Country Sourdough",
      "Cinnamon Roll",
      "₦15,500",
      "Thursday 8 October 2026",
      "12 Aminu Kano Crescent, Wuse 2, Abuja, FCT",
      "Ada Obi",
      "Delivery fee is handled separately",
    ]) {
      expect(email.html).toContain(required);
      expect(email.text).toContain(required);
    }
    expect(email.text).toContain("2 × Country Sourdough (₦6,500 each): ₦13,000");
    expect(email.html).toContain('href="https://example.com/order-confirmation/SAM-1042"');
  });

  it("escapes customer-entered text (no HTML injection)", async () => {
    const email = await renderOrderConfirmation({
      ...data,
      specialNotes: '<script>alert("x")</script><a href="https://evil.example">click</a>',
      customerName: "<b>Ada</b>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain('href="https://evil.example"');
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("omits optional sections when empty", async () => {
    const email = await renderOrderConfirmation({ ...data, specialNotes: null, additionalInfo: null });
    expect(email.text).not.toContain("Your notes");
    expect(email.html).not.toContain("Blue gate");
  });
});
