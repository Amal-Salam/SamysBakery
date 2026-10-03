# AGENTS.md — Samy's Bakery v2

> **SOURCE OF TRUTH FOR AI CODING AGENTS**
>
> Read this file completely before making any change to the repository.
>
> This project is being built as a **production-capable MVP**.
>
> **DO NOT GUESS. DO NOT INVENT FEATURES. DO NOT SKIP BUSINESS RULES.**
>
> When requirements are unclear or explicitly marked `UNDECIDED`, stop and ask for clarification when the decision materially affects implementation.

---

# 1. Project

**Samy's Bakery v2**

Samy's Bakery is an online artisanal micro-bakery based in Abuja, Nigeria.

The bakery:

- operates online only
- has no physical shop
- offers a changing weekly menu
- sells bakery products directly to customers online
- uses an external delivery partner
- accepts payment through Paystack
- does not collect delivery fees through the website

The product experience should feel:

- artisanal
- premium
- warm
- modern
- playful
- easy to use

---

# 2. Primary Development Rule

Build the **approved requirements**, not what you think the product should have.

If a feature is not specified:

1. Check the project specifications.
2. Check whether it is explicitly marked `UNDECIDED`.
3. If it is undecided and materially affects behaviour, architecture, security, data, payment, inventory, or UX, STOP and ask.
4. If it is merely an implementation detail, choose the simplest solution consistent with the architecture.
5. Never introduce unrelated functionality.

A useful feature is still an **unapproved feature**.

Do not implement it.

---

# 3. Specification Hierarchy

The project has the following specification documents.

Use them together.

# 3. Detailed Specifications

The detailed project specifications are stored in `/docs`.

Before implementing a feature, consult the relevant specification:

- Product requirements → `docs/Product _Requirements_Document.md`
- Technical architecture → `docs/Technical_Architecture_Specification.md`
- Database → `docs/Database.md`
- Security/transactions → `docs/Database_Security_&_Transaction _Specs.md`
- API/server contracts → `docs/Api & Server Action Contract.md`
- Project structure → `docs/Project Structure.md`
- Design System →  `docs/Design System.md`
- UI/UX → `docs/Visual Design Spec.md`
- Implementation → `docs/Implementation Spec.
md`


The detailed documents contain the corresponding specifications.

Do not modify these documents unless explicitly instructed to do so.

`AGENTS.md` contains the operational rules that apply to every coding session.

The detailed specifications contain the authoritative domain details.

If a requirement conflicts with another requirement, **do not silently choose one**. Stop and request clarification.

---

# 4. Product Scope

## Customer capabilities

Customers can:

- browse the current weekly menu
- view product details
- add products to cart
- modify cart quantities
- remove cart items
- authenticate
- register
- sign in with email/password
- sign in with Google
- verify email
- reset password
- manage their profile
- manage saved addresses
- select a delivery date
- checkout
- pay through Paystack
- receive an order confirmation email
- view order history
- view order details
- cancel eligible orders

## Admin capabilities

Admins can:

- manage the Product Library
- create weekly menus
- add products to weekly menus
- set weekly prices
- set weekly quantities
- set low-stock thresholds
- upload/select product images
- edit permitted weekly-menu information
- publish menus
- manage inventory
- view orders
- update order status
- cancel eligible orders
- initiate refunds
- view customers
- view revenue metrics
- view operational dashboard information
- view audit information

---

# 5. Explicitly Out of Scope

DO NOT implement:

- Flutterwave
- any payment gateway other than Paystack
- cash payment
- bank transfer
- pickup
- delivery fee collection
- delivery-partner management
- WhatsApp order management
- SMS order management
- automatic later order-status emails
- event quotation workflow
- product customization
- customer-selected delivery times
- multiple admin permission levels
- CRM
- loyalty programme
- discounts
- coupons
- subscriptions
- marketplace functionality
- AI features
- unnecessary analytics
- unrelated refactoring
- unrelated feature requests

If someone proposes one of these, do not implement it unless the project requirements are explicitly changed.

---

# 6. Technical Stack

Use the approved architecture:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui / Radix where appropriate
- Supabase PostgreSQL
- Supabase Auth
- Google OAuth through Supabase
- Supabase Storage
- Next.js Server Actions
- Next.js Route Handlers
- Paystack
- Resend
- Zod
- Vitest
- Playwright
- Vercel

## Deliberately not required

Do not introduce:

- ORM
- Redis
- microservices
- Kubernetes
- second database
- Redux/Zustand unless a concrete approved requirement requires it
- AI/LLM services

Prefer the simplest architecture that satisfies the requirements.

---

# 7. Architecture

The application is a **modular monolith**.

Primary domains:

```text
auth
products
weekly-menu
cart
inventory
checkout
orders
payments
customers
notifications
admin
```

Business logic belongs in the appropriate feature/domain layer.

Do not put significant business logic directly inside page components.

---

# 8. Project Structure

Follow the approved structure.

```text
app/
├── (storefront)/
├── (auth)/
├── account/
├── admin/
└── api/paystack/webhook/

components/
├── ui/
├── storefront/
├── cart/
├── checkout/
├── account/
└── admin/

features/
├── auth/
├── products/
├── weekly-menu/
├── cart/
├── inventory/
├── checkout/
├── orders/
├── payments/
├── customers/
├── notifications/
└── admin/

lib/
├── supabase/
├── paystack/
├── resend/
├── auth/
├── validation/
├── errors/
├── security/
└── utils/

actions/

schemas/

emails/

supabase/
├── migrations/
├── seed.sql/
└── config.toml

tests/
├── unit/
├── integration/
├── security/
└── e2e/

types/
├── database.ts
├── domain.ts
└── api.ts
```

Do not reorganize the repository unnecessarily.

---

# 9. Server vs Client

Use **Server Components by default**.

Use Client Components only when necessary for:

- user interaction
- browser APIs
- local interactive state
- payment UI
- other genuinely client-side behaviour

Do not turn entire pages into Client Components simply for convenience.

Never move sensitive business logic into the browser.

---

# 10. Security Rules

Security is not optional.

## Never:

- expose `SUPABASE_SERVICE_ROLE_KEY`
- expose Paystack secret keys
- expose Resend API keys
- trust client-provided prices
- trust client-provided inventory
- trust client-provided payment status
- trust browser payment success without verification
- disable RLS to fix application errors
- bypass authorization for convenience
- return private customer data to unauthorized users

---

# 11. Supabase

Use:

```text
Supabase browser client
Supabase server client
Supabase admin/service-role client
```

The service-role client is **server-only**.

Use RLS.

Use database transactions/functions for operations that require atomicity.

Do not solve application problems by disabling RLS.

---

# 12. Roles

There are only two application roles:

```text
CUSTOMER
ADMIN
```

There is no permission hierarchy within ADMIN.

All admins have the same administrative capabilities.

Admin routes must verify both:

1. authentication
2. admin authorization

---

# 13. Authentication

Support:

- email/password
- registration
- email verification
- password reset
- Google OAuth
- logout

Visitors may:

- browse
- view products
- add products to cart

Authentication is required before checkout.

After successful login from checkout:

```text
LOGIN → RETURN TO CHECKOUT
```

Do not redirect customers unnecessarily to the homepage.

---

# 14. Weekly Menu

The weekly menu is the centre of the business model.

Lifecycle:

```text
DRAFT → PUBLISHED → EXPIRED
```

Rules:

- active menu is Tuesday–Saturday
- exactly one published/current weekly menu
- customers cannot order products outside the current weekly menu
- new week starts empty
- existing Product Library products can be reused
- previous menus remain historically preserved
- previous menus disappear from normal customer-facing discovery
- new week cannot be created while current week is active
- system calculates Tuesday–Saturday dates
- system automatically expires the menu after Saturday

Do not create additional menu states without approval.

---

# 15. Product Library

Product Library products are permanent catalogue records.

A Product Library product may be:

- created
- edited
- deleted

Changes to the Product Library apply to future weekly menus.

Historical orders must never be corrupted by later product changes.

Historical order items use snapshots.

If deleting a historically referenced product:

- warn the admin
- require explicit confirmation
- preserve historical order information

---

# 16. Weekly Product Locking

Once a weekly-menu product has received an order:

### LOCKED

- product name
- weekly price
- weekly quantity

### STILL EDITABLE

- description
- ingredients
- photo

Do not allow the UI to imply that locked fields can be changed.

Enforce the rule server-side as well.

---

# 17. Inventory

Do not maintain a casually mutable `available_quantity` as the authoritative source.

Conceptually:

```text
effective capacity
=
weekly quantity
+
positive inventory adjustments
```

Then:

```text
available
=
effective capacity
-
active reservations
```

Inventory reservations have two important types:

```text
PAYMENT_TEMPORARY
ORDER_CONFIRMED
```

---

# 18. Inventory Rules

Cart does **not** reserve stock.

Before payment:

```text
validate inventory
→ create temporary reservation
→ initiate payment
```

Successful payment:

```text
temporary reservation
→ confirmed reservation
```

Failed/abandoned payment:

```text
temporary reservation
→ released
```

Cancellation:

```text
confirmed reservation
→ released
```

Cancellation does not automatically restore the original production quantity beyond releasing the reservation.

Inventory must be transactionally protected against concurrent purchases.

Never rely on frontend checks alone.

---

# 19. Inventory Adjustments

Admins may increase stock.

Inventory adjustments must record:

- quantity
- reason
- admin
- timestamp

Low-stock thresholds are configured per weekly-menu product.

Low-stock and sold-out warnings appear in the admin dashboard.

Do not invent customer-facing inventory-management functionality.

---

# 20. Delivery Rules

Delivery is external.

Samy's Bakery does not collect the delivery fee through the website.

Customers pay the bakery only for products.

The checkout must communicate that delivery fees are handled separately by the external delivery partner.

There is:

- no pickup
- no delivery-time selection
- no delivery-partner management

---

# 21. Delivery Date

Customers may select:

- today, if valid
- another eligible day in the current week

Allowed days:

```text
Tuesday
Wednesday
Thursday
Friday
Saturday
```

Unavailable:

```text
Sunday
Monday
```

One global admin-configured ordering cutoff applies.

After cutoff:

- that day's delivery option disappears
- next eligible day becomes earliest selectable date

Validate all of this server-side.

---

# 22. Cart

Cart supports:

- add
- update quantity
- remove
- clear
- subtotal

Same products combine quantities.

Cart does not reserve inventory.

Inventory must be rechecked before checkout/payment.

Abandoned carts do not persist as orders.

---

# 23. Checkout

Checkout flow:

```text
Customer
→ Delivery
→ Review
→ Payment
```

Server must calculate the authoritative subtotal.

Never trust:

```text
client price
client subtotal
client payment amount
```

Customer selects:

- saved/new address
- delivery date
- optional special notes

Special notes maximum:

```text
500 characters
```

---

# 24. Payment

Paystack is the **only** payment gateway.

Currency:

```text
NGN
```

Payment flow:

```text
prepare checkout
→ validate inventory
→ temporary reservation
→ initialize Paystack
→ customer payment
→ webhook
→ signature validation
→ server-side verification
→ idempotency
→ order confirmation
```

Use both:

- Paystack webhook
- server-side transaction verification

The webhook must validate the raw request signature.

Never trust the browser alone.

---

# 25. Payment Idempotency

Payment processing must tolerate:

- duplicate webhook
- customer refresh
- customer returning after webhook
- webhook retry
- repeated verification

A transaction must not create duplicate orders.

Never create an order merely because a payment reference exists.

---

# 26. Payment Failure

If payment fails or is abandoned:

- no completed order
- temporary reservation is released according to the reservation policy
- customer can retry

Do not create fake or placeholder paid orders.

Temporary reservation timeout is currently:

```text
UNDECIDED
```

Do not invent a timeout value without approval.

---

# 27. Orders

Order numbers follow:

```text
SAM-1001
SAM-1002
SAM-1003
...
```

Order number generation must be concurrency-safe.

Never use:

```text
MAX(order_number) + 1
```

---

# 28. Order Status

Normal lifecycle:

```text
PAID
↓
RECEIVED
↓
BAKING/PREPARING
↓
READY
↓
HANDED TO DELIVERY
↓
DELIVERED
```

Cancellation:

```text
CANCELLED
```

Cancellation is permitted only before `READY`.

Normal status progression is forward-only.

Admin backward correction is allowed where necessary, but the exact correction matrix is:

```text
UNDECIDED
```

Do not invent a correction matrix.

---

# 29. Cancellation

Cancellation and refund are separate operations.

Cancellation:

1. validate authorization
2. lock the order
3. validate order status
4. mark order `CANCELLED`
5. release confirmed reservation
6. create audit record

Do not automatically initiate a refund during cancellation.

---

# 30. Refunds

Refund must be explicitly initiated.

Flow:

```text
CANCELLED
→ Admin selects Refund
→ explicit confirmation
→ Paystack refund
```

Paystack refund processing may be asynchronous.

Never mark a refund as successfully completed merely because a refund request was submitted.

---

# 31. Historical Orders

Historical order data must survive:

- product deletion
- product edits
- weekly menu changes
- catalogue changes

Order items contain purchase-time snapshots.

Never rewrite historical purchase information because a Product Library record changed.

---

# 32. Email

Use Resend.

Send the initial order confirmation email.

Include:

- order number
- products
- quantities
- subtotal
- delivery address
- delivery date

Do not implement automatic later order-status emails.

Email failure must not invalidate an otherwise successfully created paid order.

---

# 33. API / Server Action Pattern

Use:

```text
Request
→ Authentication
→ Authorization
→ Validation
→ Business Rules
→ Transaction
→ Result
```

Standard success:

```json
{
  "success": true,
  "data": {}
}
```

Standard error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Use the approved error codes from the API specification.

---

# 34. Validation

Use Zod for external input.

Validate:

- types
- required fields
- string lengths
- quantities
- IDs
- addresses
- dates
- notes
- product data
- admin inputs

Validation does not replace business-rule checks.

Both are required.

---

# 35. Database Functions

Use transactional database functions/RPC where required.

Approved candidates include:

```text
reserve_inventory()
release_inventory_reservation()
confirm_payment_order()
cancel_order()
generate_order_number()
add_inventory()
```

Do not create unnecessary RPC functions.

Security-sensitive functions must use the appropriate security model and restricted permissions.

---

# 36. Audit Logging

Audit important administrative operations.

At minimum:

- menu publication
- menu expiration
- product deletion
- inventory adjustments
- order status changes
- cancellations
- refund operations
- significant administrative changes

Audit records contain:

- actor
- action
- entity type
- entity ID when applicable
- metadata
- timestamp

Customers must not be able to modify audit records.

---

# 37. UI Direction

The visual direction is:

**Modern Luxury Bakery + Playful & Artistic**

Use:

- cream/light neutral backgrounds
- deep brown
- restrained berry accent
- elegant serif headings
- clean sans-serif UI
- strong product photography
- generous whitespace
- subtle Nigerian influence

The MVP does not require pixel-perfect brand refinement.

Centralize design tokens.

Do not scatter arbitrary colours throughout the codebase.

---

# 38. UI Priorities

Prioritize:

1. clarity
2. product photography
3. availability
4. purchasing
5. checkout
6. mobile usability
7. accessibility

Do not prioritize elaborate animation over functionality.

---

# 39. Required UI States

Major interactions must support appropriate:

- loading
- empty
- error
- success
- disabled
- sold-out
- unavailable
- processing

Do not use fake data to hide loading or backend failures.

---

# 40. Accessibility

Implement:

- semantic HTML
- labels
- keyboard navigation
- visible focus states
- accessible errors
- meaningful alt text
- sufficient contrast
- non-colour-only state communication
- accessible dialogs/drawers
- suitable mobile touch targets
- reduced-motion support

---

# 41. Admin UI

Admin routes:

```text
/admin/login
/admin
/admin/orders
/admin/orders/[orderNumber]
/admin/menu
/admin/menu/new
/admin/products
/admin/customers
/admin/revenue
/admin/inventory
```

Admin dashboard should expose:

- today's orders
- upcoming orders
- preparation orders
- ready orders
- revenue
- products sold
- low-stock products
- sold-out products
- current weekly menu
- quick actions

Admin UI should prioritize operational efficiency over elaborate visual design.

---

# 42. Admin Navigation

Use:

### Operations

- Dashboard
- Orders
- Today's Orders
- Upcoming Orders
- Ready for Delivery

### Menu & Products

- Current Weekly Menu
- Create New Week
- Product Library

### Customers

- Customers

### Business

- Revenue
- Inventory

Do not add navigation items for unapproved features.

---

# 43. Revenue

Revenue functionality exists.

However, exact revenue metric definitions are:

```text
UNDECIDED
```

Do not invent:

- profit
- forecasting
- customer lifetime value
- financial projections
- advanced financial analytics

Implement only the approved metric contract.

---

# 44. Product Photography

Use responsive optimized images.

Maintain consistent presentation in product grids.

Product backgrounds may vary.

Do not force every product into the same visual treatment.

Do not commit temporary placeholder photography as if it were final content.

---

# 45. Performance

Prefer:

- Server Components
- server-rendered data
- optimized images
- minimal client JavaScript
- minimal dependencies
- simple state management

Do not prematurely optimize at the expense of correctness.

Do not introduce caching that can make inventory, payment, order, or account information stale or unsafe.

---

# 46. Testing Requirements

Four test categories are required.

## Unit

Test:

- calculations
- validation
- date rules
- cutoff logic
- inventory calculations
- business rules
- order number generation

## Integration

Test:

- database operations
- inventory transactions
- payment state
- order creation
- cancellation
- refund state

## Security

Test:

- RLS
- customer ownership
- admin authorization
- service-role isolation

## E2E

Test the major customer and admin journeys.

---

# 47. Mandatory E2E Customer Journey

The complete customer path must work:

```text
Homepage
→ Weekly Menu
→ Product
→ Add to Cart
→ Login/Register
→ Checkout
→ Address
→ Delivery Date
→ Review
→ Paystack
→ Verified Payment
→ Order Confirmation
→ Order History
```

---

# 48. Mandatory E2E Admin Journey

The complete admin path must work:

```text
Admin Login
→ Dashboard
→ Product Library
→ Create Product
→ Create Weekly Menu
→ Add Product
→ Set Price
→ Set Quantity
→ Publish
→ Customer Orders
→ View Order
→ Update Status
→ Inventory
```

---

# 49. Required Security Tests

Prove that:

```text
Customer A cannot read Customer B's order.

Customer A cannot modify Customer B's address.

Customer cannot modify inventory.

Customer cannot modify payment status.

Customer cannot modify refunds.

Customer cannot access admin data.

Public user cannot access private customer data.

Admin can perform approved admin operations.
```

---

# 50. Required Inventory Tests

Test:

```text
exact stock purchase
insufficient stock
sold-out transition
temporary reservation
reservation release
successful conversion to confirmed reservation
cancellation release
inventory increase
concurrent purchase
```

For example:

```text
Stock = 1

Customer A attempts quantity 1
Customer B attempts quantity 1
```

Only one reservation may succeed.

The database transaction, not frontend timing, must guarantee this.

---

# 51. Required Payment Tests

Test:

- successful payment
- failed payment
- abandoned payment
- duplicate webhook
- invalid webhook signature
- amount mismatch
- currency mismatch
- already processed payment
- verification failure
- webhook retry

Use Paystack's appropriate test environment.

Never fake production payment success.

---

# 52. Development Milestones

Implement in this exact general order:

```text
0. Repository Foundation

1. Supabase & Authentication

2. Database Schema

3. RLS & Security

4. Product Library

5. Weekly Menu

6. Storefront

7. Cart

8. Checkout Preparation

9. Inventory Transactions

10. Paystack

11. Orders

12. Confirmation & Email

13. Customer Account

14. Cancellation & Refund

15. Admin Dashboard

16. Admin Operations

17. Audit Logging

18. Security Hardening

19. Automated Testing

20. Deployment & Smoke Testing
```

Do not jump randomly between milestones.

Dependencies may require small supporting changes in another milestone, but the overall order must remain intact.

---

# 53. Milestone Completion Rule

A milestone is not complete because the page exists.

It is complete when applicable:

```text
UI
+
server operation
+
validation
+
authorization
+
business rules
+
database behaviour
+
error handling
+
tests
```

are implemented.

---

# 54. Agent Checkpoint

At the end of every milestone, report:

```text
MILESTONE:
<name>

IMPLEMENTED:
- ...

TESTS:
- ...

BUILD:
PASS / FAIL

LINT:
PASS / FAIL

SECURITY:
PASS / FAIL / N/A

KNOWN ISSUES:
- ...

UNDECIDED REQUIREMENTS:
- ...

READY FOR NEXT MILESTONE:
YES / NO
```

If build or critical tests fail:

```text
READY FOR NEXT MILESTONE: NO
```

Fix the problem before continuing.

---

# 55. Stop Conditions

STOP and ask the user when encountering:

- conflicting requirements
- missing business rules
- an unresolved payment decision
- an unresolved inventory decision
- an unresolved authorization decision
- an unresolved destructive-data decision
- an unresolved refund decision
- an unresolved order-state decision
- an architecture decision that materially changes the system
- an explicit `UNDECIDED` requirement that must be resolved to continue safely

Do not silently invent a solution.

---

# 56. Implementation-Level Decisions

The agent may make reasonable internal engineering decisions when they do not change product behaviour.

Examples:

- variable names
- helper names
- component composition
- internal utility functions
- test organization
- Tailwind class composition
- minor spacing adjustments
- internal file organization within approved boundaries

Choose the simplest maintainable implementation.

---

# 57. Refactoring Rule

Do not perform unrelated refactoring during feature work.

If existing code is genuinely blocking implementation:

1. identify the problem
2. make the smallest necessary change
3. preserve existing behaviour
4. test the affected area
5. report the change

Do not use a feature task as an excuse to rewrite the application.

---

# 58. Secrets

Never:

- print secrets
- commit secrets
- place secrets in source code
- place service credentials in client code
- expose credentials in logs
- paste credentials into documentation

Use environment variables.

If an existing `.env` file appears to contain real credentials:

- do not repeat the credentials
- do not commit them
- alert the user that rotation may be required

---

# 59. Git Rules

Use small logical commits.

Preferred examples:

```text
feat: establish application foundation
feat: implement authentication
feat: add database schema
feat: enforce database security
feat: implement product library
feat: implement weekly menu
feat: implement storefront
feat: implement cart
feat: implement checkout
feat: implement inventory reservations
feat: integrate Paystack
feat: implement orders
feat: implement confirmation email
feat: implement customer account
feat: implement cancellation and refunds
feat: implement admin dashboard
feat: add audit logging
test: add security and e2e coverage
chore: prepare production deployment
```

Do not create one giant commit containing the entire application.

---

# 60. Definition of MVP Complete

The MVP is complete only when:

### Customer

- [ ] Can browse current menu
- [ ] Can view product
- [ ] Can add/update/remove cart items
- [ ] Can register
- [ ] Can login
- [ ] Can use Google OAuth
- [ ] Can verify email
- [ ] Can reset password
- [ ] Can manage addresses
- [ ] Can select valid delivery date
- [ ] Can checkout
- [ ] Can pay through Paystack
- [ ] Receives confirmation
- [ ] Can view orders
- [ ] Can cancel eligible order

### Inventory

- [ ] Temporary reservations work
- [ ] Confirmed reservations work
- [ ] Failed payments release temporary reservations
- [ ] Cancellation releases confirmed reservations
- [ ] Concurrent purchasing is safe
- [ ] Low-stock state works
- [ ] Sold-out state works

### Orders

- [ ] Order numbers are unique
- [ ] Historical snapshots work
- [ ] Status lifecycle works
- [ ] Cancellation works
- [ ] Refund workflow works
- [ ] Audit records exist

### Admin

- [ ] Admin login works
- [ ] Dashboard works
- [ ] Product Library works
- [ ] Weekly Menu works
- [ ] Inventory works
- [ ] Orders work
- [ ] Customers work
- [ ] Revenue works according to approved definitions

### Security

- [ ] RLS enabled
- [ ] Ownership enforced
- [ ] Admin authorization enforced
- [ ] Secrets protected
- [ ] Paystack webhook verified
- [ ] Server-side payment verification implemented
- [ ] Client cannot manipulate authoritative price/inventory/payment state

### Engineering

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Security tests pass
- [ ] E2E tests pass
- [ ] Lint passes
- [ ] Production build passes
- [ ] No critical known errors
- [ ] No secrets committed

### Deployment

- [ ] Production environment configured
- [ ] Supabase production database migrated
- [ ] Google OAuth production callback configured
- [ ] Paystack webhook configured
- [ ] Resend configured
- [ ] Production smoke test passes

---

# 61. Post-MVP

Once the MVP passes all completion gates:

STOP feature development.

Do not immediately add new functionality.

Post-MVP work may include:

- visual refinement
- UX improvements
- accessibility audit
- performance optimization
- advanced analytics
- additional business features
- approved new requirements

All post-MVP features require explicit approval.

---

# 62. Final Rule

The project's priorities are:

```text
CORRECTNESS
    ↓
SECURITY
    ↓
BUSINESS RULES
    ↓
RELIABILITY
    ↓
USABILITY
    ↓
VISUAL POLISH
    ↓
EXTRA FEATURES
```

Do not sacrifice correctness for speed.

Do not sacrifice security for convenience.

Do not sacrifice requirements for assumptions.

Do not add features to make the application appear more complete.

**Build the approved Samy's Bakery MVP exactly, test it thoroughly, and ask when a decision is genuinely missing.**