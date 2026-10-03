import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/features/orders/rules";
import { cn } from "@/lib/utils";

// The label always states the status; colour only reinforces it.
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto py-0.5",
        status === "CANCELLED" && "border-destructive/40 bg-destructive/10 text-destructive line-through",
        status === "READY" && "border-success/40 bg-success/10 text-success",
        status === "DELIVERED" && "bg-muted text-muted-foreground"
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="outline" className={cn("h-auto py-0.5", status === "REFUNDED" && "text-warning")}>
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
