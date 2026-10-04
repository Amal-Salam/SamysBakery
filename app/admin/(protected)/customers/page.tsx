import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listCustomers } from "@/features/customers/admin";
import { isAdminViewer } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Customers" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" });

export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  if (!(await isAdminViewer())) return null;
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const customers = await listCustomers(search || null);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-heading-1 text-primary">Customers</h1>

      <form role="search" aria-label="Find customers" action="/admin/customers" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customer-search">Name, email or phone</Label>
          <Input id="customer-search" name="q" defaultValue={search} maxLength={100} className="w-72" />
        </div>
        <Button type="submit">Search</Button>
        {search ? (
          <Button asChild variant="ghost">
            <Link href="/admin/customers">Clear</Link>
          </Button>
        ) : null}
      </form>

      {customers.length === 0 ? (
        <EmptyState title={search ? "No customers match." : "No customers yet."} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Most recent order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="font-medium text-accent underline underline-offset-4"
                    >
                      {customer.name || "(no name)"}
                    </Link>
                  </TableCell>
                  <TableCell className="break-all">{customer.email}</TableCell>
                  <TableCell>{customer.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">{customer.orderCount}</TableCell>
                  <TableCell>
                    {customer.lastOrderNumber && customer.lastOrderAt ? (
                      <>
                        <Link
                          href={`/admin/orders/${customer.lastOrderNumber}`}
                          className="text-accent underline underline-offset-4"
                        >
                          {customer.lastOrderNumber}
                        </Link>{" "}
                        <span className="text-muted-foreground">{dateFormat.format(new Date(customer.lastOrderAt))}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {customers.length === 100 ? (
        <p className="text-body-sm text-muted-foreground">Showing the first 100. Search to narrow the list.</p>
      ) : null}
    </div>
  );
}
