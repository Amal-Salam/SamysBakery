import { Badge } from "@/components/ui/badge";
import type { MenuStatus } from "@/features/weekly-menu/rules";

const LABELS: Record<MenuStatus, string> = {
  DRAFT: "Draft — not visible to customers",
  PUBLISHED: "Published — customers can order",
  EXPIRED: "Expired",
};

export function MenuStatusBadge({ status }: { status: MenuStatus }) {
  return (
    <Badge variant={status === "PUBLISHED" ? "default" : "outline"} className="h-auto py-1">
      {LABELS[status]}
    </Badge>
  );
}
