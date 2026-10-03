import { render } from "@react-email/render";

// Order confirmation email (AGENTS.md §32): order number, products, quantities,
// subtotal, delivery address, delivery date. React escapes every value, so
// customer-entered text (notes, names) can't inject HTML.

export type OrderConfirmationData = {
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number; unitPrice: string; lineTotal: string }[];
  subtotal: string;
  deliveryDate: string;
  recipient: string;
  phone: string;
  address: string;
  additionalInfo: string | null;
  specialNotes: string | null;
  orderUrl: string;
};

// Email clients need inline styles; values mirror the design tokens.
const colors = {
  background: "#f8f3ea",
  surface: "#fffdf9",
  text: "#2c211c",
  muted: "#756860",
  primary: "#4a2f27",
  border: "#ded4c8",
  accentSoft: "#ead7dc",
};

const serif = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const sans = "Inter, Arial, Helvetica, sans-serif";

export function OrderConfirmationEmail(data: OrderConfirmationData) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`Order ${data.orderNumber} confirmed`}</title>
      </head>
      <body style={{ margin: 0, padding: "24px 12px", backgroundColor: colors.background, fontFamily: sans, color: colors.text }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 560, margin: "0 auto" }}>
          <tbody>
            <tr>
              <td style={{ padding: "8px 0 20px", fontFamily: serif, fontSize: 26, color: colors.primary }}>
                Samy&apos;s Bakery
              </td>
            </tr>
            <tr>
              <td style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 24 }}>
                <h1 style={{ margin: "0 0 4px", fontFamily: serif, fontSize: 28, color: colors.primary }}>Order Confirmed</h1>
                <p style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>{data.orderNumber}</p>
                <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 1.5 }}>
                  {data.customerName ? `Thank you, ${data.customerName}! ` : "Thank you! "}
                  We&apos;ve received your payment and your order is with the bakery.
                </p>

                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ fontSize: 14 }}>
                  <tbody>
                    {data.items.map((item, index) => (
                      <tr key={index}>
                        <td style={{ padding: "8px 0", borderBottom: `1px solid ${colors.border}` }}>
                          <strong>{item.name}</strong>
                          <br />
                          <span style={{ color: colors.muted }}>
                            {item.quantity} × {item.unitPrice}
                          </span>
                        </td>
                        <td align="right" style={{ padding: "8px 0", borderBottom: `1px solid ${colors.border}`, fontWeight: 600 }}>
                          {item.lineTotal}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ padding: "12px 0 0", fontWeight: 700, fontSize: 16 }}>Subtotal</td>
                      <td align="right" style={{ padding: "12px 0 0", fontWeight: 700, fontSize: 16 }}>
                        {data.subtotal}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h2 style={{ margin: "24px 0 6px", fontFamily: serif, fontSize: 20, color: colors.primary }}>Delivery</h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                  <strong>{data.deliveryDate}</strong>
                  <br />
                  {data.recipient} · {data.phone}
                  <br />
                  {data.address}
                  {data.additionalInfo ? (
                    <>
                      <br />
                      <span style={{ color: colors.muted }}>{data.additionalInfo}</span>
                    </>
                  ) : null}
                </p>
                {data.specialNotes ? (
                  <p style={{ margin: "12px 0 0", fontSize: 14 }}>
                    <span style={{ color: colors.muted }}>Your notes: </span>
                    {data.specialNotes}
                  </p>
                ) : null}

                <p style={{ margin: "20px 0 0", padding: "12px 14px", backgroundColor: colors.accentSoft, borderRadius: 6, fontSize: 13, lineHeight: 1.5 }}>
                  Delivery fee is handled separately by our delivery partner and is not included in the amount paid to
                  Samy&apos;s Bakery.
                </p>

                <p style={{ margin: "24px 0 0" }}>
                  <a
                    href={data.orderUrl}
                    style={{ display: "inline-block", backgroundColor: colors.primary, color: colors.surface, padding: "12px 20px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: 14 }}
                  >
                    View your order
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "16px 0", fontSize: 12, color: colors.muted, textAlign: "center" }}>
                Samy&apos;s Bakery · Artisanal bakes. Exciting flavours. Fresh every week.
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export function orderConfirmationText(data: OrderConfirmationData): string {
  return [
    `Order Confirmed: ${data.orderNumber}`,
    "",
    `${data.customerName ? `Thank you, ${data.customerName}! ` : "Thank you! "}We've received your payment and your order is with the bakery.`,
    "",
    ...data.items.map((item) => `${item.quantity} × ${item.name} (${item.unitPrice} each): ${item.lineTotal}`),
    `Subtotal: ${data.subtotal}`,
    "",
    `Delivery date: ${data.deliveryDate}`,
    `Deliver to: ${data.recipient}, ${data.phone}`,
    data.address,
    ...(data.additionalInfo ? [data.additionalInfo] : []),
    ...(data.specialNotes ? ["", `Your notes: ${data.specialNotes}`] : []),
    "",
    "Delivery fee is handled separately by our delivery partner and is not included in the amount paid to Samy's Bakery.",
    "",
    `View your order: ${data.orderUrl}`,
  ].join("\n");
}

export async function renderOrderConfirmation(data: OrderConfirmationData) {
  return {
    subject: `Your Samy's Bakery order ${data.orderNumber} is confirmed`,
    html: await render(<OrderConfirmationEmail {...data} />),
    text: orderConfirmationText(data),
  };
}
