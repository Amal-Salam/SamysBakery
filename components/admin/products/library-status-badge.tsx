import { Badge } from "@/components/ui/badge";
import type { LibraryStatus } from "@/features/products/rules";

const LABELS: Record<LibraryStatus, string> = {
  ON_CURRENT_MENU: "On current menu",
  ON_DRAFT_MENU: "On draft menu",
  USED_PREVIOUSLY: "Used on past menus",
  NEVER_USED: "Not yet on a menu",
};

// Text labels carry the meaning; colour is secondary (no colour-only state).
export function LibraryStatusBadge({ status }: { status: LibraryStatus }) {
  const active = status === "ON_CURRENT_MENU" || status === "ON_DRAFT_MENU";
  return <Badge variant={active ? "default" : "outline"}>{LABELS[status]}</Badge>;
}
