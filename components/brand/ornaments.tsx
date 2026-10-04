import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

// Hand-drawn line ornaments (design pass, owner-approved 2026-10-04).
// Purely decorative: hidden from assistive technology, never interactive, and
// coloured only through design tokens (currentColor + the accent token).

type DrawingProps = Omit<SVGProps<SVGSVGElement>, "children">;

function Drawing({ className, viewBox = "0 0 48 48", children, ...props }: DrawingProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Accent strokes; `accentClassName` lets dark sections use a lighter accent. */
const ACCENT = "stroke-accent";

export function WhiskDrawing({ accentClassName = ACCENT, ...props }: DrawingProps & { accentClassName?: string }) {
  return (
    <Drawing {...props}>
      <path d="M22 46.5c-.4-5-.2-10.2.5-15.3h3c.8 5.1 1 10.3.5 15.3-1.3.5-2.7.5-4 0z" />
      <path d="M21 31.2h6.2" />
      <path d="M23 31c-9.5-6-10.4-24.4.9-27 11.2 2.2 10.6 20.6 1.2 27" />
      <path d="M23.4 31c-5.5-6.4-5.6-20.8.6-24.6 6.3 3.6 6.4 18 .6 24.6" />
      <path className={accentClassName} d="M24.1 31c-.4-8.4-.3-17.2-.1-25.8" />
    </Drawing>
  );
}

export function WheatDrawing({ accentClassName = ACCENT, ...props }: DrawingProps & { accentClassName?: string }) {
  return (
    <Drawing {...props}>
      <path d="M24 46c-.8-11-.6-24 1-37" />
      <path d="M24.4 34c-4.2-.4-6.6-3.6-6.4-7.4 3.6.6 6 3.6 6.4 7.4zM24.6 34c4-1 5.9-4.4 5.4-8.1-3.5.9-5.5 4.2-5.4 8.1zM24.5 26c-4.1-.5-6.4-3.7-6.1-7.5 3.6.7 5.9 3.7 6.1 7.5zM24.8 26c4-1 5.8-4.4 5.3-8.1-3.4.9-5.4 4.2-5.3 8.1zM24.8 18.2c-3.8-.6-5.9-3.6-5.6-7.1 3.3.7 5.4 3.6 5.6 7.1zM25.1 18.2c3.6-1 5.3-4.1 4.8-7.5-3.1.9-4.9 3.9-4.8 7.5z" />
      <path className={accentClassName} d="M25 9.5c-.4-2.8-1.4-5.4-3-7.6M25.4 9.5c.9-2.6 2.4-4.9 4.3-6.8" />
    </Drawing>
  );
}

export function RollingPinDrawing({ accentClassName = ACCENT, ...props }: DrawingProps & { accentClassName?: string }) {
  return (
    <Drawing {...props}>
      <path d="M12.5 17.6c7.8-.6 15.6-.6 23.2.1 2.6.3 4.3 2.6 4.1 6.4-.2 3.6-1.8 5.9-4.4 6.1-7.8.6-15.4.6-23 0-2.6-.3-4.2-2.6-4.2-6.3.1-3.7 1.8-6.1 4.3-6.3z" />
      <path d="M8.3 23.8H3.6M39.8 23.8h4.6" />
      <circle cx="2.4" cy="23.8" r="1.6" />
      <circle cx="45.6" cy="23.8" r="1.6" />
      <path className={accentClassName} d="M16 21.6c3.4.8 6.9.9 10.4.3M22 26.3c3.2.6 6.4.5 9.6-.2" />
    </Drawing>
  );
}

export function LoafDrawing({ accentClassName = ACCENT, ...props }: DrawingProps & { accentClassName?: string }) {
  return (
    <Drawing {...props}>
      <path d="M6.6 34.2C5.6 21.3 13.5 12.4 24 12.3c10.6-.1 18.4 8.6 17.6 21.9" />
      <path d="M4 34.6c13.3.6 26.7.6 40 0" />
      <path className={accentClassName} d="M14.8 23.6c1.7-1.6 3.6-2.8 5.6-3.6M21.9 20.8c1.8-1.4 3.8-2.4 5.9-3M29.2 22.2c1.6-1.3 3.4-2.2 5.3-2.8" />
      <path d="M9.5 38.5c9.6.4 19.4.4 29 0" />
    </Drawing>
  );
}

/** Empty cart / empty basket. */
export function BasketDrawing(props: DrawingProps) {
  return (
    <Drawing viewBox="0 0 120 100" {...props}>
      <path d="M33 44c-1-17 10-29 27-29s28 12 27 29" />
      <path d="M16.5 44.5c29-1.3 58-1.3 87 0 .4 1.4.4 2.8 0 4.2-29 1.2-58 1.2-87 0-.4-1.4-.4-2.8 0-4.2z" />
      <path d="M20.5 49l7.6 34.6c21.3 1.3 42.6 1.3 63.9 0L99.5 49" />
      <path d="M23.3 61.4c24.5 1 49 1 73.4 0M26 73.4c22.6.9 45.3.9 68 0" />
      <path d="M37 50l2.6 33.4M50 50.4l1 33.6M63 50.5l-.2 33.6M76 50.3l-1.6 33.5M88 49.8l-3 33.6" />
      <path className={ACCENT} d="M44 44.6c4.4-6 11-9.6 16-9.6s11.6 3.6 16 9.6" />
    </Drawing>
  );
}

/** Menu not published yet. */
export function OvenDrawing(props: DrawingProps) {
  return (
    <Drawing viewBox="0 0 120 100" {...props}>
      <path d="M20 24.6c26.6-1.2 53.3-1.2 80 0 1.2 20 1.2 40 0 60-26.7 1.2-53.4 1.2-80 0-1.2-20-1.2-40 0-60z" />
      <path d="M20.4 37c26.4.8 52.8.8 79.2 0" />
      <circle cx="31" cy="30.8" r="2.6" />
      <circle cx="41" cy="30.8" r="2.6" />
      <path d="M66 30.8h22" />
      <path d="M31 46c19.4-.7 38.7-.7 58 0 .7 9 .7 18 0 27-19.3.8-38.6.8-58 0-.8-9-.8-18 0-27z" />
      <path d="M38 50.5c14.7.6 29.3.6 44 0" />
      <path d="M47 69c-.5-6.5 5-10.8 13-10.8s13.4 4.3 13 10.8" />
      <path className={ACCENT} d="M53 63.4l3-2M60 62.4l3-2M66 63.6l2.6-1.8" />
      <path className={ACCENT} d="M50 18c-3-3 3-5.4 0-9M60 17c-3-3 3-5.4 0-9M70 18c-3-3 3-5.4 0-9" />
    </Drawing>
  );
}

/** Section divider: two hairlines with a small wheat sprig between them. */
export function WheatDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center gap-4", className)}>
      <span className="h-px flex-1 bg-border" />
      <svg viewBox="0 0 20 18" className="h-[18px] w-5 stroke-accent" fill="none" strokeWidth={1} strokeLinecap="round">
        <path d="M0 9h20M10 9c-2-2-2-4-1-5M10 9c2-2 2-4 1-5M10 9c-2 2-2 4-1 5M10 9c2 2 2 4 1 5" />
      </svg>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
