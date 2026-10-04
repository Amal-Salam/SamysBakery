import Link from "next/link";

import type { AuditEntry } from "@/features/admin/audit";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Read-only audit entries: when, who, what, and a link to the record. */
export function ActivityList({
  entries,
  empty,
  showLinks = false,
}: {
  entries: AuditEntry[];
  empty: string;
  showLinks?: boolean;
}) {
  if (entries.length === 0) return <p className="text-body-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="flex flex-col gap-2 text-body-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-0.5 rounded-md border border-border bg-surface px-3 py-2">
          <span className="text-caption text-muted-foreground">
            <time dateTime={entry.at}>{timeFormat.format(new Date(entry.at))}</time> · {entry.actor}
          </span>
          <span className="font-medium">
            {entry.label}
            {showLinks && entry.href ? (
              <>
                {" "}
                <Link href={entry.href} className="font-normal text-accent underline underline-offset-4">
                  {entry.hrefLabel}
                </Link>
              </>
            ) : null}
          </span>
          {entry.detail ? <span className="text-muted-foreground">{entry.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}
