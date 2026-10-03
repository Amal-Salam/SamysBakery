import { availabilityMessage, type AvailabilityStatus } from "@/features/inventory/rules";
import { cn } from "@/lib/utils";

// The text always states the availability; colour only reinforces it.
const STYLES: Record<AvailabilityStatus, string> = {
  AVAILABLE: "bg-success/10 text-success",
  LOW_STOCK: "bg-warning/10 text-warning",
  SOLD_OUT: "bg-primary text-primary-foreground tracking-wide",
};

export function AvailabilityBadge({
  status,
  available,
  className,
}: {
  status: AvailabilityStatus;
  available: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-caption font-semibold",
        STYLES[status],
        className
      )}
    >
      {availabilityMessage(status, available)}
    </span>
  );
}
