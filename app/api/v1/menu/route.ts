import { getPublishedMenu } from "@/features/weekly-menu/storefront";
import { toApiMenu } from "@/lib/api/menu";
import { apiRoute } from "@/lib/api/handler";

// GET /api/v1/menu — this week's published menu (null when none is published).
export const GET = apiRoute({ auth: "optional" }, async () => toApiMenu(await getPublishedMenu()));
