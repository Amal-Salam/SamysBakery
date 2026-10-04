import { cn } from "@/lib/utils";

// Doodle-style badge (design pass, owner-approved 2026-10-04): the text is the
// real label; a hand-drawn outline sits behind it. The words always state the
// meaning, so colour is never the only signal.

export type DoodleTone = "filled" | "success" | "warning" | "accent";

const TONES: Record<DoodleTone, { text: string; stroke: string; tilt: string }> = {
  filled: { text: "text-primary-foreground", stroke: "fill-primary stroke-primary", tilt: "-rotate-3" },
  success: { text: "text-success", stroke: "stroke-success", tilt: "rotate-1" },
  warning: { text: "text-warning", stroke: "stroke-warning", tilt: "rotate-2" },
  accent: { text: "text-accent", stroke: "stroke-accent", tilt: "-rotate-2" },
};

export function DoodleBadge({
  tone,
  shape = "box",
  className,
  children,
}: {
  tone: DoodleTone;
  shape?: "box" | "oval";
  className?: string;
  children: React.ReactNode;
}) {
  const style = TONES[tone];
  return (
    <span
      className={cn(
        "relative isolate inline-grid w-fit place-items-center px-3.5 py-1.5 text-caption font-semibold tracking-wide motion-reduce:rotate-0",
        shape === "oval" && "px-5 py-2 font-heading text-body-lg font-bold tracking-normal",
        style.text,
        style.tilt,
        className
      )}
    >
      <svg
        viewBox={shape === "oval" ? "0 0 140 46" : "0 0 100 40"}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
        className={cn("absolute inset-0 -z-10 size-full overflow-visible", style.stroke)}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      >
        {shape === "oval" ? (
          <>
            <path vectorEffect="non-scaling-stroke" d="M70 4c38 0 66 7.6 65.6 19.4C135 36 107 42.4 69 42.2 32 42 4.6 35.6 4.4 23.4 4.2 11 32.2 4 70 4z" />
            <path vectorEffect="non-scaling-stroke" strokeOpacity={0.5} d="M60 4.6c30-1.6 58 3.6 69 12" />
          </>
        ) : (
          <>
            <path vectorEffect="non-scaling-stroke" d="M6 8c29-3.6 58-3.3 87 .4 2.6 8 2.8 16 .6 24-29.4 3.6-58.6 3.8-88 .4-2.6-8-2.4-16.4.4-24.8" />
            {tone === "filled" ? null : (
              <path vectorEffect="non-scaling-stroke" strokeOpacity={0.5} d="M8 5.6c28-2.4 56-2.2 84 .6" />
            )}
          </>
        )}
      </svg>
      {children}
    </span>
  );
}
