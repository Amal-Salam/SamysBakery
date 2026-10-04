import type { Metadata } from "next";
import Link from "next/link";

import { CreateWeekForm } from "@/components/admin/menu/create-week-form";
import { Button } from "@/components/ui/button";
import { getCurrentAdminMenu } from "@/features/weekly-menu/queries";
import { menuWeekStartFor, weekEndFor } from "@/features/weekly-menu/rules";
import { formatWeekRange, lagosToday } from "@/lib/utils/dates";
import { isAdminViewer } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Create New Week" };

export default async function CreateWeekPage() {
  if (!(await isAdminViewer())) return null;
  const current = await getCurrentAdminMenu();
  const weekStart = menuWeekStartFor(lagosToday());

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-heading-1 text-primary">Create New Week</h1>

      {current ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <p>
            A menu for <strong>{formatWeekRange(current.weekStart, current.weekEnd)}</strong> is
            already {current.status === "PUBLISHED" ? "published" : "in draft"}. A new week can be
            created once the current week has ended.
          </p>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/admin/menu">Go to the current menu</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <p>
            This creates an empty draft menu for{" "}
            <strong>{formatWeekRange(weekStart, weekEndFor(weekStart))}</strong>. Customers won&apos;t
            see it until you publish it.
          </p>
          <CreateWeekForm />
        </div>
      )}
    </div>
  );
}
