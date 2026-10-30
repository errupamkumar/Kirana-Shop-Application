# Kirana Shop Automation System: Analysis + Claude Code Build Prompt

This file has two parts:

1. **Analysis** of the BRD and the original prompt: what is missing, unclear, or conflicting, and how each point is resolved.
2. **The consolidated prompt** (everything under "PART 2") to paste into Claude Code, or save as `docs/BUILD_PROMPT.md` in an empty repo.

---

# PART 1: Analysis

## What works well in the original
- Clear single-store scope, a clean three-app split (Spring Boot API, React admin, React Native app), and a good idea to keep every business rule in one `store_settings` row that both clients read at runtime.
- The rules (radius, minimum order, delivery fee, payment toggles) are concrete, have defaults, and are enforced on the server as well as in the UI.

## Problems in the original prompt (as a prompt for Claude Code)
| # | Issue | Why it matters | Resolution |
|---|---|---|---|
| P1 | "Generate Part A + B, then type Continue" | Written for a chat model that dumps code. Claude Code writes files, runs builds and tests, and iterates. | Replaced by phases, each with acceptance criteria that must pass before the next. |
| P2 | Asks for "complete production-ready code" in one pass | One huge output gets truncated and is never compiled. | Build incrementally, compile and test after each phase. |
| P3 | Raw `schema.sql` | No versioning; schema changes later are painful. | Flyway migrations (`V1__init.sql`, `V2__seed.sql`). Hibernate `ddl-auto=validate`. |
| P4 | `.jsx` files with shadcn/ui | shadcn/ui is TypeScript-first, and types catch API contract drift between three apps. | TypeScript everywhere on the frontend (`.tsx`). |
| P5 | No repo layout, run instructions, or tests | Claude Code needs to know where things go and how "done" is checked. | Monorepo layout, docker-compose, test commands defined below. |

## Gaps, ambiguities and conflicts in the requirements
| # | Topic | Gap / conflict | Decision taken in the prompt |
|---|---|---|---|
| 1 | **Expo vs React Native CLI** | Both listed; also `expo-location` vs `react-native-geolocation-service`. `react-native-razorpay` is a native module that Expo Go cannot run. | **Expo (latest SDK) with `expo-dev-client` + prebuild/EAS build**, `expo-location`. Razorpay works in the dev build. Android only. |
| 2 | **OTP provider** | "OTP/Phone Login" with no SMS provider, expiry, retry or rate limit rules. | `OtpSender` interface. `dev` profile logs the OTP and accepts `123456` for allow-listed test numbers. `Msg91OtpSender` (or Twilio) adapter behind config. OTP hashed, 5 min expiry, max 5 attempts, 1 resend per 30 s, max 5 sends per hour per phone. |
| 3 | **`gateway_secret` storage** | Stored in a DB table that `GET /settings` returns, so the secret would leak to the admin browser (and risk leaking via `/app/config`). | Secret encrypted at rest (AES-GCM, key from env `APP_ENCRYPTION_KEY`), **write-only**: GET returns `gatewaySecretSet: true/false` only. `/app/config` exposes only `gatewayKeyId` and toggles. |
| 4 | **Order status enum** | Only the happy path (`Placed → Packed → Out for Delivery → Delivered`). No cancel, no online-payment pending state. | `PENDING_PAYMENT, PLACED, PACKED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED`. Enforced state machine (see prompt). Status history table for timestamps on the tracking screen. |
| 5 | **Stock: toggle vs quantity** | BRD says "Stock toggles", prompt says "Stock Quantity". | Both: `stock_qty` (int) and `is_active` (toggle). A variant is orderable when active and `stock_qty > 0`. Admin has a quick "mark out of stock" action (sets qty to 0). |
| 6 | **Stock decrement and concurrency** | Not defined when stock reduces, or what happens when two customers buy the last unit. | Decrement in the order transaction with a conditional update `UPDATE product_variants SET stock_qty = stock_qty - :q WHERE id = :id AND stock_qty >= :q`. 0 rows updated → rollback and return `409 OUT_OF_STOCK` listing the items. Restore stock on cancel. |
| 7 | **Price snapshotting** | Not mentioned; editing a product price would change old orders. | `order_items` copies product name, variant label, MRP and selling price. `orders` stores subtotal, delivery fee, total, address snapshot, lat/lng, distance and the min-order/fee values used. Client sends only `variantId + qty`; server prices everything. |
| 8 | **GPS spoofing / which location counts** | Radius checked on "user location", but delivery goes to an address. | Banner uses live GPS (`/location/check`). Order placement validates the **selected saved address's** lat/lng (captured from GPS or map pin when saving the address). |
| 9 | **Addresses** | `user_addresses` table exists but no APIs or screens. | Address CRUD APIs and an address picker on checkout. |
| 10 | **Settings changing mid-checkout** | Admin may change fee/min order while a cart is open. | Server recomputes at order time. If the client's `expectedTotal` differs, return `409 PRICE_CHANGED` with the fresh breakdown; app shows it and asks to confirm. |
| 11 | **Double submit** | Tapping "Place Order" twice creates two orders. | `Idempotency-Key` header on `POST /orders`, unique per user. |
| 12 | **"Live" tracking** | No mechanism specified. | Phase 1: polling (TanStack Query `refetchInterval` 15 s on app, 10 s on admin orders with a new-order sound). FCM push listed as an optional later phase. |
| 13 | **Free delivery threshold** | Is it optional? Is it on subtotal? | `free_delivery_above` nullable (null = never free), compared to item subtotal (selling price), before fees. Min order also uses item subtotal. |
| 14 | **Online payment depth** | "Pre-integrated" is vague. | Full Razorpay flow behind the toggle: server creates Razorpay order, app opens checkout, server verifies signature, webhook as backup. Order sits in `PENDING_PAYMENT` until verified; unpaid ones expire after 15 min and release stock. |
| 15 | **Product images** | Blinkit-style UI needs images, nothing specified. | `StorageService` interface with local disk implementation (served at `/media/**`), S3 later. Admin uploads one image per product. |
| 16 | **Store open/closed** | No way to pause orders (holiday, night). | Recommended addition: `is_store_open` toggle + `store_closed_message` in settings. |
| 17 | **Admin users and auth** | Customer and admin auth both "JWT", no roles, no seeding. | Separate `admin_users` table (email + BCrypt password), roles `ADMIN`/`STAFF`. First admin seeded from env. Customer JWT and admin JWT carry different roles; `/api/v1/admin/**` requires admin role. Access token 15 min + refresh token 30 days. |
| 18 | **Dashboard KPIs** | Not defined. | Today's orders, today's revenue (delivered), pending orders by status, low-stock variants (≤ configurable threshold), 7-day order chart. |
| 19 | **Invoice** | "Invoice print" with no GST or format. | Printable HTML invoice (browser print CSS). GST fields optional in settings (`gstin`, store name/address/phone shown on invoice). Flag for the owner if GST billing is needed. |
| 20 | **Catalog size** | Single `GET /catalog` could get large. | Keep `GET /catalog` for categories + featured, add paginated `GET /products?categoryId&q&page`. Search via MySQL LIKE (FULLTEXT later). |
| 21 | **Money and time** | Not specified. | `DECIMAL(10,2)` / `BigDecimal` everywhere, INR, HALF_UP rounding. Timestamps UTC in DB, shown in IST. |
| 22 | **Singleton settings** | Nothing stops a second row. | `CHECK (id = 1)` + service always loads id 1. Cached, evicted on update. |
| 23 | **Customer cancel** | Not mentioned. | Customer can cancel while `PLACED`; admin can cancel before `DELIVERED`. |
| 24 | **Spring Boot version** | "3.x" (Spring Boot 4 now exists). | Pin to latest **3.5.x** as the BRD says. |

## Open questions for the store owner (defaults chosen, change if needed)
1. SMS provider for OTP (MSG91 assumed for India).
2. Is GST invoicing required?
3. Store hours: is an open/closed toggle enough, or are scheduled hours needed?
4. Should customers be able to cancel after packing?

---

# PART 2: Consolidated prompt for Claude Code

> Copy everything below this line into Claude Code (or save it as `docs/BUILD_PROMPT.md` and say: *"Read docs/BUILD_PROMPT.md and implement Phase 0. Stop after each phase, run its checks, and summarize."*).

---

## Role and goal

You are a principal full-stack engineer. Build the **Kirana Shop Automation System**: a Blinkit-inspired grocery ordering system for **one** local kirana store (not a marketplace), with **no delivery countdown timers**.

Three apps in one monorepo:
- **backend**: Java 21, Spring Boot 3.5.x, Spring Data JPA, Spring Security + JWT, MySQL 8, Flyway.
- **admin-web**: React + TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query v5, TanStack Table, React Hook Form + Zod, axios, lucide-react, react-router.
- **customer-app**: Android app in React Native + TypeScript using Expo (latest SDK) with `expo-dev-client` (prebuild / EAS build, not Expo Go), NativeWind v4, React Navigation, TanStack Query v5, Zustand, axios, `expo-location`, `react-native-razorpay`.

Work phase by phase. After each phase: compile, run the tests, fix failures, update the README, and give a short summary of what was built and how to verify it. Do not move to the next phase while its acceptance criteria fail. Use the latest stable library versions compatible with each other; do not invent APIs. When a requirement is unclear, pick the simplest reasonable option, write it in `docs/DECISIONS.md`, and continue.

## Repository layout

```
kirana/
├── backend/                 # Spring Boot (Maven, Java 21)
│   └── src/main/java/com/kirana/
│       ├── config/          # security, CORS, Jackson, caching, OpenAPI
│       ├── common/          # errors, ApiError, money utils, pagination
│       ├── auth/            # OTP, JWT, refresh tokens, admin login
│       ├── settings/        # StoreSettings entity/service/controllers
│       ├── catalog/         # Category, Product, ProductVariant
│       ├── customer/        # User, UserAddress
│       ├── checkout/        # StoreValidationService, pricing, Haversine
│       ├── order/           # Order, OrderItem, status machine, history
│       ├── payment/         # Payment, PaymentGateway, Razorpay impl
│       ├── storage/         # StorageService (local disk)
│       └── dashboard/
│   └── src/main/resources/db/migration/   # Flyway V1__init.sql, V2__seed.sql …
├── admin-web/               # Vite + React + TS
├── customer-app/            # Expo + RN + TS
├── docs/                    # API.md, DECISIONS.md, BUILD_PROMPT.md
├── docker-compose.yml       # mysql:8 (+ backend optional)
├── .env.example
└── README.md
```

Package by feature, not by layer. DTOs are Java records; never return entities from controllers. Use MapStruct or hand-written mappers.

## Business rules (all stored in `store_settings`, id = 1, editable from admin)

| Field | Type | Default |
|---|---|---|
| `store_name`, `store_phone`, `store_address`, `gstin` (nullable) | varchar | seed values |
| `store_lat`, `store_lng` | DECIMAL(9,6) | seed values |
| `max_delivery_radius_km` | DECIMAL(5,2) | 5.00 (allowed 0.5–20) |
| `min_order_amount` | DECIMAL(10,2) | 500.00 |
| `delivery_charge` | DECIMAL(10,2) | 30.00 |
| `free_delivery_above` | DECIMAL(10,2) NULL | 1000.00 (null = never free) |
| `cod_enabled` | BOOLEAN | TRUE |
| `online_payment_enabled` | BOOLEAN | FALSE |
| `gateway_key_id` | varchar NULL | null |
| `gateway_secret_enc` | varbinary NULL | null (AES-GCM encrypted) |
| `is_store_open`, `store_closed_message` | BOOLEAN, varchar | TRUE, null |
| `low_stock_threshold` | INT | 5 |
| `updated_at`, `updated_by` | | |

Rules:
1. **Geofence**: distance from store to a point by Haversine (Earth radius 6371.0088 km). Serviceable when `distance <= max_delivery_radius_km`.
2. **Minimum order**: `itemSubtotal` (sum of selling price × qty) must be `>= min_order_amount`. App shows "Add ₹X more to enable order" and a progress bar.
3. **Delivery fee**: `0` if `free_delivery_above != null && itemSubtotal >= free_delivery_above`, else `delivery_charge`. `total = itemSubtotal + deliveryFee`.
4. **Payment methods**: `COD` allowed only if `cod_enabled`; `ONLINE` allowed only if `online_payment_enabled` and key id + secret are set. At least one method must stay enabled (validate on save).
5. **Store closed**: if `is_store_open = false`, checkout is blocked with `store_closed_message`.
6. The server is the source of truth for every rule above. Clients only display them. Settings are cached in memory and evicted on update; clients refetch `/app/config` on app focus.
7. `gateway_secret` is write-only: never returned by any API or logged. Admin GET returns `gatewaySecretSet: boolean`; PUT with a blank secret keeps the existing one.

## Data model (Flyway `V1__init.sql`)

Tables: `admin_users`, `users`, `otp_requests`, `refresh_tokens`, `user_addresses`, `store_settings`, `categories`, `products`, `product_variants`, `orders`, `order_items`, `order_status_history`, `payments`, `idempotency_keys`.

Key points:
- `store_settings`: `id TINYINT PRIMARY KEY CHECK (id = 1)`.
- `categories`: name, slug (unique), image_url, sort_order, is_active.
- `products`: category_id, name, description, brand (nullable), image_url, is_active, timestamps. Index on name for search.
- `product_variants`: product_id, label (e.g. "500 g", "1 kg", "1 L"), sku (unique), mrp, selling_price (CHECK `selling_price <= mrp`), stock_qty (CHECK `>= 0`), is_active, sort_order.
- `users`: phone (unique, E.164), name (nullable), timestamps.
- `user_addresses`: user_id, label, line1, line2, landmark, pincode, lat, lng, is_default.
- `orders`: order_number (human readable, unique, e.g. `KS-20261030-0001`), user_id, status, payment_method, payment_status (`PENDING, PAID, FAILED, REFUND_PENDING, COD_PENDING, COD_COLLECTED`), item_subtotal, delivery_fee, total, min_order_amount_applied, address snapshot columns (name, phone, line1, line2, landmark, pincode, lat, lng), distance_km, customer_note, cancel_reason, placed_at, timestamps. Index `(status, placed_at)` and `(user_id, placed_at)`.
- `order_items`: order_id, variant_id, product_name, variant_label, mrp, selling_price, qty, line_total (all snapshots).
- `order_status_history`: order_id, from_status, to_status, changed_by_type (`CUSTOMER/ADMIN/SYSTEM`), changed_by_id, note, created_at.
- `payments`: order_id, method, gateway, gateway_order_id, gateway_payment_id, amount, status, raw_response JSON, timestamps.
- `idempotency_keys`: user_id + key unique, order_id, created_at.

`V2__seed.sql`: the settings row with defaults, 6–8 categories, ~30 products with variants and realistic INR prices for local dev. The first admin is created at startup from env `ADMIN_EMAIL` / `ADMIN_PASSWORD` if no admin exists.

## Order status machine

```
PENDING_PAYMENT → PLACED | CANCELLED (payment failed / 15 min expiry)
PLACED          → PACKED | CANCELLED
PACKED          → OUT_FOR_DELIVERY | CANCELLED (admin only)
OUT_FOR_DELIVERY→ DELIVERED
DELIVERED, CANCELLED: terminal
```
- COD orders start at `PLACED`; online orders start at `PENDING_PAYMENT`.
- Customer may cancel only while `PLACED`. Admin may cancel any non-terminal order with a reason.
- Cancel restores stock. COD `DELIVERED` sets payment_status `COD_COLLECTED`.
- Every transition writes `order_status_history`. Invalid transitions return `409 INVALID_STATUS_TRANSITION`.
- A scheduled job expires `PENDING_PAYMENT` orders older than 15 min.

## Checkout and stock

`StoreValidationService` (with `HaversineCalculator` as a separate pure class):
- `distanceKm(lat1, lng1, lat2, lng2)`, `isWithinDeliveryRadius(lat, lng)`.
- `validateCart(items, addressOrLatLng, paymentMethod)` returns a `CartQuote`: lines with current prices and availability, itemSubtotal, deliveryFee, total, amountToMinOrder, serviceable, distanceKm, allowed payment methods, and a list of `violations` (codes below). Never throws for business violations; returns them so the app can render them.

`POST /orders` (transactional):
1. Require `Idempotency-Key`; if seen for this user, return the existing order.
2. Load settings, address (must belong to the user), and variants; recompute the quote.
3. Reject with the right error code if any violation exists, or if `expectedTotal` from the client differs (`409 PRICE_CHANGED` + fresh quote).
4. Decrement stock with conditional updates (`... WHERE id = ? AND stock_qty >= ?`). Any 0-row update rolls back and returns `409 OUT_OF_STOCK` listing the variants.
5. Insert order, items (snapshots), history, payment row. For ONLINE, create the Razorpay order and return its id + key id.

Error codes (consistent JSON `{code, message, details}`): `OUT_OF_RADIUS, BELOW_MIN_ORDER, STORE_CLOSED, PAYMENT_METHOD_DISABLED, OUT_OF_STOCK, VARIANT_INACTIVE, PRICE_CHANGED, INVALID_STATUS_TRANSITION, VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, OTP_INVALID, OTP_RATE_LIMITED`.

## API

Base path `/api/v1`. OpenAPI via springdoc at `/swagger-ui`. Document endpoints in `docs/API.md`.

**Auth**
- `POST /app/auth/otp/send` `{phone}`; `POST /app/auth/otp/verify` `{phone, otp}` → access + refresh tokens (creates user on first login).
- `POST /auth/refresh`, `POST /auth/logout`.
- `POST /admin/auth/login` `{email, password}`.

OTP: `OtpSender` interface. `LoggingOtpSender` in `dev` (prints the code; numbers in `app.otp.test-numbers` always accept `123456`). `Msg91OtpSender` enabled by config. Store OTP hashed, 5 min expiry, 5 attempts, resend after 30 s, max 5 sends/hour/phone.

**Customer (`/app/**`, public unless marked 🔒)**
- `GET /app/config`: radius, store lat/lng, min order, delivery charge, free-delivery threshold, cod/online flags, gateway key id, store open + message. No secrets.
- `POST /app/location/check` `{lat, lng}` → `{serviceable, distanceKm, radiusKm}`.
- `GET /app/catalog` → active categories + a few products per category for the home screen.
- `GET /app/products?categoryId=&q=&page=&size=` → paginated active products with active variants (`inStock` flag, no raw stock numbers).
- 🔒 `GET/POST/PUT/DELETE /app/addresses`.
- 🔒 `POST /app/cart/validate` `{items:[{variantId, qty}], addressId? | lat,lng, paymentMethod?}` → `CartQuote`.
- 🔒 `POST /app/orders` `{items, addressId, paymentMethod, expectedTotal, note?}` + `Idempotency-Key`.
- 🔒 `GET /app/orders/my?page=`, `GET /app/orders/{id}` (with status history), `POST /app/orders/{id}/cancel`.
- 🔒 `POST /app/payments/razorpay/verify` `{orderId, razorpayOrderId, razorpayPaymentId, signature}`.
- `POST /webhooks/razorpay` (signature verified, idempotent).
- 🔒 `GET/PUT /app/me`.

**Admin (`/admin/**`, role ADMIN or STAFF; settings and admin users ADMIN only)**
- `GET /admin/settings`, `PUT /admin/settings`.
- Categories: `GET/POST/PUT/DELETE /admin/categories` (delete = soft deactivate if products exist).
- Products: `GET /admin/products?q=&categoryId=&page=`, `GET/POST/PUT /admin/products/{id}` (product with nested variants), `PATCH /admin/products/{id}/active`, `PATCH /admin/variants/{id}` (stock qty, price, active).
- `POST /admin/uploads/image` → URL (jpg/png/webp, max 2 MB).
- Orders: `GET /admin/orders?status=&from=&to=&q=&page=`, `GET /admin/orders/{id}`, `PATCH /admin/orders/{id}/status` `{status, note?}`, `GET /admin/orders/{id}/invoice` (data for printing).
- `GET /admin/dashboard` → today's orders, today's delivered revenue, counts by status, low-stock variants, last 7 days orders/revenue.

Security: stateless JWT (HS256, secret from env), BCrypt for admin passwords, CORS limited to admin origin(s) from config, Bean Validation on all request DTOs, global `@RestControllerAdvice`, rate limit OTP endpoints, no secrets in logs.

## Admin web (admin-web)

- Login page → protected layout with sidebar (Dashboard, Orders, Products, Categories, Settings).
- Axios instance with JWT, auto refresh on 401, logout on refresh failure. API base URL from `VITE_API_BASE_URL`.
- Zod schemas mirror backend DTOs; types inferred from Zod.
- **Dashboard**: KPI cards, low-stock list, 7-day chart (recharts).
- **Orders**: TanStack Table, filter by status/date, search by order number/phone, poll every 10 s, play a sound and show a toast for new `PLACED` orders. Order drawer with items, address, map link (Google Maps URL from lat/lng), status history, and only the valid next-status buttons. Cancel with reason. Print invoice page with print CSS.
- **Products**: table with search and category filter; create/edit form with nested variants (useFieldArray) for label, sku, MRP, selling price, stock qty, active switch; image upload; inline stock edit and active switches with optimistic updates.
- **Categories**: CRUD with image and sort order.
- **Settings** (`StoreSettingsPage`): RHF + Zod form for store details, lat/lng (with "use my current location" button and a map preview link), radius, min order, delivery charge, free-delivery threshold (optional), COD and online switches, gateway key id, write-only secret field ("Secret is set; leave blank to keep"), store open toggle + message, low-stock threshold. Client validation mirrors server (at least one payment method; online requires key + secret).
- Loading, empty and error states everywhere; toasts for mutations.

## Customer app (customer-app)

- Screens: Login (phone) → OTP → Home; Home, Category/Product list, Search, Cart, Address list/add (with "use current location" and pin adjust), Checkout, Order success, My Orders, Order detail/tracking, Profile.
- API base URL from `app.config.ts` extra / env. Tokens in `expo-secure-store`. Axios with refresh handling.
- **Config**: `useStoreConfig()` query on `/app/config`, refetch on app foreground.
- **Location**: request permission with an explanation; on grant call `/app/location/check`; show a green "Delivering to you" or red "We don't deliver here yet (X km away, limit Y km)" banner. Handle permission denied with a "pick address" fallback.
- **Cart store** (`useCartStore`, Zustand + persist to AsyncStorage): items keyed by variantId with snapshot name/label/price/qty, `add`, `increment`, `decrement`, `remove`, `clear`, derived `itemCount`, `itemSubtotal`. Cart prices are display only; checkout uses the server quote.
- **Home (Blinkit-style)**: header with address, sticky search bar, serviceability banner, store-closed banner when closed, 4-column category grid, product rows with cards (image, name, variant selector, price with struck MRP and % off, green ADD button turning into a `− qty +` stepper), floating bottom cart bar (items, subtotal, "View cart"). No delivery timer anywhere.
- **Cart**: line items with steppers, min-order progress bar and "Add ₹X more to enable order", delivery fee line ("FREE" when threshold met, plus "Add ₹Y more for free delivery"), total, address picker, payment options from config (COD default; Online only when enabled). Uses `POST /app/cart/validate` (debounced) to show server violations. Place Order disabled when `itemSubtotal < minOrderAmount || !serviceable || storeClosed || !paymentMethod || validating`.
- **Place order**: generate an idempotency key per checkout attempt; handle `PRICE_CHANGED` (show updated totals and confirm), `OUT_OF_STOCK` (mark items, offer to remove), other errors as friendly messages. Online: open Razorpay checkout, then call verify; on failure show retry.
- **Tracking**: stepper Placed → Packed → Out for Delivery → Delivered with timestamps from history, cancelled state, poll every 15 s while not terminal, customer cancel while `PLACED`.
- Green Blinkit-like theme via NativeWind tokens; skeleton loaders; pull to refresh.

## Phased build plan and acceptance criteria

**Phase 0: Scaffold**
- Monorepo, `docker-compose.yml` with MySQL 8, `.env.example`, README skeleton, backend/admin/app projects created and building.
- ✅ `docker compose up -d mysql` works; `./mvnw verify` passes on an empty app; `npm run build` passes in admin-web; `npx expo start` launches customer-app.

**Phase 1: Database + settings + catalog (backend)**
- Flyway V1/V2, entities, repositories, settings service with cache and encrypted secret, catalog read APIs, admin catalog CRUD, image upload, error handling, OpenAPI.
- ✅ App starts against MySQL with `ddl-auto=validate`. `/app/config` never contains the secret. Testcontainers tests for settings update and catalog CRUD pass.

**Phase 2: Auth (backend)**
- OTP flow with dev sender, JWT + refresh, admin login, role-based security.
- ✅ Tests: OTP success, wrong OTP, expiry, attempt limit, rate limit; `/admin/**` rejects customer tokens; `/app/orders/my` rejects anonymous.

**Phase 3: Checkout + orders (backend)**
- Haversine, `StoreValidationService`, cart validate, addresses, order placement with idempotency and stock decrement, status machine, history, cancel with stock restore, dashboard endpoint.
- ✅ Unit tests: Haversine against known distances (e.g. ~1.11 km for 0.01° latitude), boundary at exactly the radius, min order boundary (499.99 vs 500.00), free delivery boundary, null threshold.
- ✅ Integration tests: each violation code; concurrent orders for the last unit (two threads, only one succeeds, stock never negative); duplicate idempotency key returns the same order; invalid transitions rejected; cancel restores stock; price snapshot unchanged after a product price edit.

**Phase 4: Admin web**
- All pages above wired to the real API.
- ✅ `npm run lint && npm run test && npm run build` pass. Vitest + Testing Library tests for the settings form validation and the order status button logic. Manual: change min order in Settings and see `/app/config` reflect it.

**Phase 5: Customer app (COD path)**
- All screens above with COD checkout and tracking.
- ✅ `npm run lint`, `npx tsc --noEmit` and Jest tests (cart store math, min-order message, button disabled logic) pass. Manual on an Android emulator: login with test OTP, out-of-radius banner (mock location), place a COD order, see it in admin, move it to Delivered, see the app update.

**Phase 6: Online payments (Razorpay, behind toggle)**
- `PaymentGateway` interface + `RazorpayGateway` (create order, verify signature, webhook), app integration in the dev build, `PENDING_PAYMENT` expiry job.
- ✅ Signature verification unit tests (valid / tampered); with the toggle off, ONLINE is rejected server-side and hidden in the app; with Razorpay test keys, a test payment moves the order to `PLACED` / `PAID`.

**Phase 7: Hardening and docs**
- Structured logging, actuator health, sensible DB indexes, README with full run instructions, `docs/API.md`, `docs/DECISIONS.md`, production notes (env vars, HTTPS, backups, EAS build for APK/AAB).
- Optional later: FCM push for status changes, S3 image storage, scheduled store hours, GST invoices.

## Testing and run instructions to produce

The README must explain:
```bash
# 1. Database
cp .env.example .env
docker compose up -d mysql

# 2. Backend (http://localhost:8080, Swagger at /swagger-ui)
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
./mvnw verify                       # unit + Testcontainers integration tests

# 3. Admin web (http://localhost:5173)
cd admin-web && npm install && npm run dev
npm run lint && npm run test && npm run build

# 4. Customer app (Android emulator or device)
cd customer-app && npm install
npx expo prebuild && npx expo run:android   # dev build (needed for Razorpay)
npm run lint && npx tsc --noEmit && npm test
# Emulator reaches the backend at http://10.0.2.2:8080
```

Env vars to document in `.env.example`: `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `APP_ENCRYPTION_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ALLOWED_ORIGINS`, `OTP_PROVIDER`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `RAZORPAY_WEBHOOK_SECRET`, `MEDIA_DIR`, `VITE_API_BASE_URL`, `EXPO_PUBLIC_API_BASE_URL`.

## Definition of done
- All phase acceptance criteria pass and all test suites are green.
- Every business rule is enforced on the server and reflected in both clients from `/app/config` without an app update.
- No secret is ever returned by an API, committed, or logged.
- A new developer can run the full system locally by following the README only.

Start with **Phase 0**.
