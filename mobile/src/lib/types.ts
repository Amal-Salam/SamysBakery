// Shapes returned by the Samy's Bakery API (/api/v1). The server is the source
// of truth for every price, quantity and status shown here.

export type AvailabilityStatus = "AVAILABLE" | "LOW_STOCK" | "SOLD_OUT";
export type OrderStatus = "PAID" | "RECEIVED" | "BAKING" | "READY" | "HANDED_TO_DELIVERY" | "DELIVERED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  ingredients: string;
  price: number;
  image: { url: string; alt: string } | null;
  category: string | null;
  categoryOrder: number | null;
  availableQuantity: number;
  availabilityStatus: AvailabilityStatus;
};

export type Menu = { weekStart: string; weekEnd: string; products: Product[] };

export type CartItem = {
  productId: string;
  slug: string | null;
  name: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  available: number;
  issue: "UNAVAILABLE" | "SOLD_OUT" | "EXCEEDS_AVAILABLE" | null;
  image: { url: string; alt: string } | null;
};

export type Cart = { items: CartItem[]; subtotal: number; itemCount: number; canCheckout: boolean };

export type Address = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  additionalInfo: string | null;
  isDefault: boolean;
};

export type CheckoutContext = {
  customer: { name: string; email: string };
  addresses: Address[];
  deliveryDates: string[];
  cutoff: string;
  today: string;
};

export type CheckoutSummary = {
  customer: { name: string; email: string };
  lines: { productId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  currency: "NGN";
  deliveryDate: string;
  address: Address;
  specialNotes: string | null;
};

export type PaymentStatusResult =
  | { status: "CONFIRMED"; orderNumber: string }
  | { status: "PENDING" | "FAILED" | "REFUNDED_LATE" | "REJECTED" };

export type OrderSummary = {
  orderNumber: string;
  placedAt: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  deliveryDate: string;
  items: { name: string; quantity: number }[];
};

export type OrderDetail = Omit<OrderSummary, "items"> & {
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  recipientName: string;
  phone: string;
  address: string;
  additionalInfo: string | null;
  specialNotes: string | null;
  canCancel: boolean;
};
