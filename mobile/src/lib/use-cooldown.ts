import { useEffect, useState } from "react";

/** Seconds left before "send again" is allowed (avoids hammering the email service). */
export function useCooldown(seconds = 60) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until, now]);
  return { left: Math.max(0, Math.ceil((until - now) / 1000)), start: () => { const t = Date.now(); setNow(t); setUntil(t + seconds * 1000); } };
}
