import type { RevenueMetrics } from "@/features/admin/revenue";
import { formatNaira } from "@/features/weekly-menu/rules";

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// The approved revenue figures (Milestone 15): Paid, Cancelled, Refunded, Net.
export function RevenueFigures({ metrics }: { metrics: RevenueMetrics }) {
  const figures = [
    { label: "Paid", value: formatNaira(metrics.paidTotal), note: plural(metrics.paidCount, "paid order") },
    {
      label: "Cancelled",
      value: formatNaira(metrics.cancelledTotal),
      note: `${plural(metrics.cancelledCount, "order")} cancelled`,
    },
    {
      label: "Refunded",
      value: formatNaira(metrics.refundedTotal),
      note: `${plural(metrics.refundedCount, "refund")} confirmed by Paystack`,
    },
    { label: "Net", value: formatNaira(metrics.netTotal), note: "Paid minus refunded" },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {figures.map((figure) => (
        <div key={figure.label} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <dt className="text-body-sm text-muted-foreground">{figure.label}</dt>
          <dd className="font-heading text-heading-2 font-semibold text-primary">{figure.value}</dd>
          <dd className="text-caption text-muted-foreground">{figure.note}</dd>
        </div>
      ))}
    </dl>
  );
}
