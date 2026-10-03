import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export const CHECKOUT_STEPS = ["Customer", "Delivery", "Review", "Payment"] as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

/** Compact progress indicator (Design System §12). */
export function CheckoutStepIndicator({ current }: { current: CheckoutStep }) {
  const currentIndex = CHECKOUT_STEPS.indexOf(current);
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex flex-wrap items-center gap-2 text-body-sm">
        {CHECKOUT_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step} className="flex items-center gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
                  active && "border-primary bg-primary text-primary-foreground",
                  done && "border-success/40 text-success",
                  !active && !done && "border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : <span aria-hidden="true">{index + 1}.</span>}
                {step}
                {done ? <span className="sr-only"> (completed)</span> : null}
              </span>
              {index < CHECKOUT_STEPS.length - 1 ? <span aria-hidden="true" className="text-border">—</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
