import { service } from "./helpers";

// Order fixtures pile up in the local database across runs, and the admin order
// views list at most 200 rows, so old fixtures can crowd out a test's own
// orders. Before any test starts, close out orders left by earlier runs (local
// stack only). Payment status is untouched, so revenue figures are unaffected.
export default async function globalSetup() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
    throw new Error("E2E global setup only runs against the local Supabase stack");
  }
  const now = new Date().toISOString();
  const { error } = await service
    .from("orders")
    .update({ order_status: "DELIVERED", delivered_at: now })
    .not("order_status", "in", "(CANCELLED,DELIVERED)")
    .lt("created_at", now);
  if (error) throw new Error(`Could not close out earlier E2E orders: ${error.message}`);
}
