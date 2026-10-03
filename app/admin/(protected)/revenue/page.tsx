import type { Metadata } from "next";
import Link from "next/link";

import { RevenueFigures } from "@/components/admin/revenue/revenue-figures";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRevenueMetrics } from "@/features/admin/revenue";
import {
  parseRevenuePeriod,
  REVENUE_PERIOD_LABELS,
  REVENUE_PERIODS,
  revenuePeriodRange,
  type DateRange,
} from "@/features/admin/rules";
import { formatLongDate, formatWeekRange, lagosToday } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Revenue" };

function rangeLabel(range: DateRange) {
  if (!range.from || !range.to) return "All orders ever paid";
  if (range.from === range.to) return `Orders paid ${formatLongDate(range.to)}`;
  return `Orders paid ${formatWeekRange(range.from, range.to)}`;
}

export default async function AdminRevenuePage({ searchParams }: PageProps<"/admin/revenue">) {
  const period = parseRevenuePeriod((await searchParams).period);
  const range = revenuePeriodRange(period, lagosToday());
  const metrics = await getRevenueMetrics(range);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading-1 text-primary">Revenue</h1>
        <p className="text-body-sm text-muted-foreground">{rangeLabel(range)} (Lagos time).</p>
      </div>

      <nav aria-label="Revenue period" className="flex flex-wrap gap-2">
        {REVENUE_PERIODS.map((value) => (
          <Button key={value} asChild size="sm" variant={period === value ? "default" : "outline"}>
            <Link href={`/admin/revenue?period=${value}`} aria-current={period === value ? "page" : undefined}>
              {REVENUE_PERIOD_LABELS[value]}
            </Link>
          </Button>
        ))}
      </nav>

      <RevenueFigures metrics={metrics} />

      <section aria-labelledby="sold-heading" className="flex flex-col gap-3">
        <h2 id="sold-heading" className="text-heading-2 text-primary">
          Products sold <span className="text-muted-foreground">({metrics.productsSold})</span>
        </h2>
        {metrics.products.length === 0 ? (
          <EmptyState title="No products sold in this period." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.products.map((product) => (
                  <TableRow key={product.name}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell className="text-right">{product.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="definitions-heading" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 id="definitions-heading" className="text-heading-3 text-primary">
          How these are counted
        </h2>
        <dl className="grid gap-2 text-body-sm">
          <div>
            <dt className="font-medium">Paid</dt>
            <dd className="text-muted-foreground">Every order paid in the period, including orders cancelled later.</dd>
          </div>
          <div>
            <dt className="font-medium">Cancelled</dt>
            <dd className="text-muted-foreground">Of those, the orders that were cancelled.</dd>
          </div>
          <div>
            <dt className="font-medium">Refunded</dt>
            <dd className="text-muted-foreground">
              Refunds of those orders that Paystack has confirmed. Requested or failed refunds are not counted.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Net</dt>
            <dd className="text-muted-foreground">Paid minus refunded.</dd>
          </div>
          <div>
            <dt className="font-medium">Products sold</dt>
            <dd className="text-muted-foreground">Units in paid orders that were not cancelled.</dd>
          </div>
        </dl>
        <p className="text-caption text-muted-foreground">
          &ldquo;This week&rdquo; starts on the latest Tuesday. Late payments refunded automatically never became
          orders and are not included.
        </p>
      </section>
    </div>
  );
}
