// Pure inventory rules (no I/O). The database (available_quantity /
// availability_status) is authoritative; these mirror it for display and tests.

export type AvailabilityStatus = "AVAILABLE" | "LOW_STOCK" | "SOLD_OUT";

/** available = weekly quantity + stock increases − active reservations (never < 0). */
export function calculateAvailable(
  weeklyQuantity: number,
  stockIncreases: number,
  activeReservations: number
): number {
  return Math.max(0, weeklyQuantity + stockIncreases - activeReservations);
}

export function availabilityStatus(available: number, lowStockThreshold: number): AvailabilityStatus {
  if (available <= 0) return "SOLD_OUT";
  if (lowStockThreshold > 0 && available <= lowStockThreshold) return "LOW_STOCK";
  return "AVAILABLE";
}

/** Customer-facing availability text (Design System §8). */
export function availabilityMessage(status: AvailabilityStatus, available: number): string {
  switch (status) {
    case "SOLD_OUT":
      return "SOLD OUT";
    case "LOW_STOCK":
      return `Only ${available} left`;
    default:
      return `${available} available`;
  }
}
