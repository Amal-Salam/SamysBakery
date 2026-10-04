import type { Metadata } from "next";
import Link from "next/link";

import { ActivityList } from "@/components/admin/audit/activity-list";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { getAuditLogs, type AuditCursor } from "@/features/admin/audit";
import { AUDIT_ACTION_NAMES } from "@/features/admin/audit-format";
import { isAdminViewer } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Audit log" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Cursor timestamps are passed back exactly as the database returned them (microseconds).
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const ACTIONS = Object.entries(AUDIT_ACTION_NAMES).sort((a, b) => a[1].localeCompare(b[1]));

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  if (!(await isAdminViewer())) return null;
  const { action: actionParam, at, id } = await searchParams;
  const action = typeof actionParam === "string" && actionParam in AUDIT_ACTION_NAMES ? actionParam : undefined;
  const before =
    typeof at === "string" && TIMESTAMP.test(at) && typeof id === "string" && UUID.test(id) ? { at, id } : undefined;
  const { entries, next } = await getAuditLogs({ action, before });

  const pageHref = (cursor: AuditCursor | null) => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (cursor) {
      params.set("at", cursor.at);
      params.set("id", cursor.id);
    }
    const qs = params.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading-1 text-primary">Audit log</h1>
        <p className="text-body-sm text-muted-foreground">
          A permanent, read-only record of important changes. Entries can&apos;t be edited or deleted.
        </p>
      </div>

      <form role="search" aria-label="Filter the audit log" action="/admin/audit" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-action">Event</Label>
          <NativeSelect id="audit-action" name="action" defaultValue={action ?? ""}>
            <option value="">All events</option>
            {ACTIONS.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">Filter</Button>
        {action || before ? (
          <Button asChild variant="ghost">
            <Link href="/admin/audit">Clear</Link>
          </Button>
        ) : null}
      </form>

      <ActivityList entries={entries} showLinks empty={action ? "No events of this kind yet." : "Nothing recorded yet."} />

      <nav aria-label="Audit log pages" className="flex gap-2">
        {before ? (
          <Button asChild variant="outline">
            <Link href={pageHref(null)}>Newest</Link>
          </Button>
        ) : null}
        {next ? (
          <Button asChild variant="outline">
            <Link href={pageHref(next)}>Older entries</Link>
          </Button>
        ) : null}
      </nav>
    </div>
  );
}
