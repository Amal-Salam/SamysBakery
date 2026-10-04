import { DoodleBadge, type DoodleTone } from "@/components/brand/doodle-badge";
import { availabilityMessage, type AvailabilityStatus } from "@/features/inventory/rules";

// The text always states the availability; colour and the drawn outline only reinforce it.
const TONES: Record<AvailabilityStatus, DoodleTone> = {
  AVAILABLE: "success",
  LOW_STOCK: "warning",
  SOLD_OUT: "filled",
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
    <DoodleBadge tone={TONES[status]} className={className}>
      {availabilityMessage(status, available)}
    </DoodleBadge>
  );
}
