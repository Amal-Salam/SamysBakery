# Tests

Four layers (AGENTS.md §46). Everything runs against the **local** Supabase stack — the
hosted project is only touched by `npm run test:schema:linked`, inside rolled-back transactions.

## Running

| Layer | Command | Needs |
| --- | --- | --- |
| Unit + static security checks | `npm test` | nothing (offline) |
| Database (pgTAP) | `npm run test:schema` | `npx supabase start` |
| Integration + security (Data API) | `npm run test:db` | `npx supabase start` |
| E2E (Playwright) | `npx playwright test` | `npx supabase start` (with its mail catcher, port 54324) |
| Database on the hosted project | `npm run test:schema:linked` | `npx supabase link` — not once real customers use it (see DEPLOYMENT.md) |

E2E builds a production bundle into `.next-e2e` and starts it with a mock Paystack
(`tests/e2e/mock-paystack.mjs`, port 3999) and mock Resend (`mock-resend.mjs`, port 3998).
No real payment or email provider is ever called. Auth emails (verification, password reset)
are read from the local Supabase mail catcher.

Projects that need the single current weekly menu run in order:
`admin-menu → admin-journey → storefront-setup → storefront-desktop/mobile → storefront-teardown`.

## Requirement → tests

### Mandatory journeys (AGENTS.md §47–48, Implementation Spec §39)

| Journey | Test |
| --- | --- |
| Customer: Homepage → Menu → Product → Cart → Register + verify email → Checkout → Address → Delivery date → Review → Paystack → Verified payment → Confirmation + email → Order history → Cancel → Stock released | `e2e/customer-journey.spec.ts` |
| Admin: Login → Dashboard → Product Library → Create product → Create week → Add product, price, quantity → Publish → Orders → View order → Received → Preparing → Ready → Handed to delivery → Delivered → Inventory | `e2e/admin-journey.spec.ts` |

### Security (AGENTS.md §49)

| Requirement | Tests |
| --- | --- |
| Customer A cannot read Customer B's order | `03_rls` (“reads only own orders”), `e2e/account.spec.ts` |
| Customer A cannot modify Customer B's address | `03_rls` (“cannot create/reassign an address for B”) |
| Customer cannot modify inventory / payment status / refunds | `03_rls`, `08_inventory`, `09_payments`, `13_cancellation_refunds`, `security/admin-reporting.test.ts` |
| Customer cannot access admin data | `03_rls`, `14`–`16` pgTAP, `security/admin-reporting.test.ts`, every admin E2E spec's “customers cannot …” test |
| Public user cannot access private data | `03_rls` (anon), `security/public-api-surface.test.ts` |
| Admin can perform approved operations | admin E2E specs, `04`/`05`/`10`/`13`/`15` pgTAP |
| Service-role isolation | `security/service-role-isolation.static.test.ts`, bundle check in Milestone 18 |
| Database invariants (RLS everywhere, pinned search_path, no client-callable internals) | `17_security_hardening` |
| Rate limits | `integration/rate-limits.test.ts` |
| Headers, webhook body cap | `e2e/security.spec.ts` |

### Inventory (AGENTS.md §50)

| Requirement | Tests |
| --- | --- |
| Exact stock purchase, insufficient stock, sold-out transition | `08_inventory`, `06_availability`, `e2e/cart.spec.ts` |
| Temporary reservation, release, conversion to confirmed | `08_inventory`, `09_payments`, `e2e/payment.spec.ts` |
| Cancellation release | `13_cancellation_refunds`, `e2e/customer-journey.spec.ts` |
| Inventory increase | `08_inventory`, `15_admin_operations`, `e2e/admin-weekly-menu.spec.ts` |
| Concurrent purchase (stock 1, two buyers → one succeeds) | `integration/inventory-concurrency.test.ts` |

### Payments (AGENTS.md §51)

| Requirement | Tests |
| --- | --- |
| Successful payment, duplicate webhook, webhook retry, already processed | `e2e/payment.spec.ts`, `09_payments` |
| Failed / abandoned payment | `09_payments` |
| Invalid webhook signature | `e2e/payment.spec.ts`, `e2e/security.spec.ts`, `unit/payment-rules.test.ts` |
| Amount mismatch, currency mismatch | `09_payments` |
| Verification failure | `e2e/payment.spec.ts`, `09_payments` |
| Customer closes the payment flow | `e2e/payment.spec.ts` |
| Late payment refused and refunded | `e2e/payment.spec.ts`, `09_payments` |

### Unit (Implementation Spec §26)

Price and availability calculations, delivery-date and cutoff rules, order status matrix,
validation schemas, revenue periods, audit descriptions and other business rules:
`unit/*.test.ts`. Order-number generation is concurrency-safe in the database and is
tested in `02_constraints`.
