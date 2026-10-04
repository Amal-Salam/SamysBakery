import type * as React from "react";

import { cn } from "@/lib/utils";

type StateProps = {
  /** Optional decorative drawing shown above the title (aria-hidden). */
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center gap-3 py-12", className)}
    >
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-border border-t-primary"
      />
      <span className="text-body-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function EmptyState({ illustration, title, description, action, className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-12 text-center",
        className
      )}
    >
      {illustration ? <div className="mb-2 text-primary">{illustration}</div> : null}
      <p className="font-heading text-heading-3 font-semibold">{title}</p>
      {description ? (
        <p className="max-w-prose text-body-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function ErrorState({ title, description, action, className }: StateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 py-12 text-center",
        className
      )}
    >
      <p className="font-heading text-heading-3 font-semibold text-destructive">
        {title}
      </p>
      {description ? (
        <p className="max-w-prose text-body-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState, ErrorState, LoadingState };
