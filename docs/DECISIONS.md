# Decisions

Product and business-rule decisions (order states, stock handling, OTP rules, secret storage, and so on) are set in Part 1 of [kirana-claude-code-prompt.md](../kirana-claude-code-prompt.md) and are binding. This file records the implementation decisions made while building, newest phase last.

## Phase 0: Scaffold

| # | Decision | Reason |
|---|---|---|
| D1 | The workspace folder is the monorepo root (no extra `kirana/` folder). | The folder was created for this project; one less level of nesting. |
| D2 | Spring Boot **3.5.16**, `pom.xml` written by hand. | The BRD pins 3.5.x; start.spring.io now only offers 4.x. |
| D3 | Flyway pinned to **11.20.3** (Boot manages 11.7.2). | 11.7.2 warns that MySQL 8.4 is untested; 11.20.x supports it. Same major version. |
| D4 | MySQL **8.4 LTS** from `container-registry.oracle.com/mysql/community-server:8.4`, overridable with `MYSQL_IMAGE`. Used by docker compose and Testcontainers. | Docker Hub's CDN kept dropping large layers on the dev machine; Oracle's registry is the official MySQL image source. Set `MYSQL_IMAGE=mysql:8.4` to use Docker Hub. |
| D5 | Docker MySQL is published on host port **3307**. | A local MySQL already listens on 3306. Change with `MYSQL_PORT` + `DB_URL`. |
| D6 | One root `.env` for every app: the backend imports `../.env` via `spring.config.import`, Vite uses `envDir: '..'`, Expo's `app.config.ts` calls `process.loadEnvFile('../.env')`. | A single place to configure local dev. `.env` is parsed as `.properties` by Spring, so comments go on their own lines. |
| D7 | Lombok for JPA entities; DTOs are Java records. | Entities have many fields; records keep DTOs immutable as the prompt requires. |
| D8 | admin-web uses **TypeScript 6.0** (template shipped 7.0). | `typescript-eslint` 8.x supports TypeScript < 6.1. |
| D9 | admin-web: Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui `radix-nova` preset, `@/` path alias, Vitest + Testing Library on jsdom. | Current stable stack; shadcn generates into `src/components/ui` (fast-refresh lint rule relaxed there). |
| D10 | customer-app: Expo SDK 58 (React Native 0.88), **React Navigation** rather than Expo Router (the template's default). | The build prompt specifies React Navigation. |
| D11 | NativeWind **4.2.7** with Tailwind CSS **3.4**. | Latest stable NativeWind; v5 is still a release candidate. NativeWind 4 requires Tailwind 3. |
| D12 | Cleartext HTTP is enabled on Android through `expo-build-properties`. | Dev builds call the local backend over `http://10.0.2.2:8080`. Production must use HTTPS (Phase 7). |
| D13 | customer-app tests use `jest-expo` without `@testing-library/react-native`. | RNTL's peer range conflicts with React 19.3; the required tests (cart math, messages, button rules) are plain logic tests. |
| D14 | Backend security in Phase 0 is a placeholder: stateless, health and Swagger public, everything else denied. | Replaced by JWT + roles in Phase 2. |

## Phases 1-7: Backend, admin web, customer app

| # | Decision | Reason |
|---|---|---|
| D15 | Order numbers come from a per-day counter table `order_sequences` (atomic `INSERT ... ON DUPLICATE KEY UPDATE LAST_INSERT_ID(...)`), India-time day. | Gap-free, human readable `KS-yyyyMMdd-0001` without a race between concurrent orders. |
| D16 | `order_items.variant_id` is nullable with `ON DELETE SET NULL`. Removing a variant from a product deletes it; past orders keep their snapshot. Cancel skips stock restore for deleted variants. | Snapshots make the FK optional; admins can tidy variants without breaking history. |
| D17 | Business violations return 422 (`OUT_OF_RADIUS`, `BELOW_MIN_ORDER`, `STORE_CLOSED`, `PAYMENT_METHOD_DISABLED`, `VARIANT_INACTIVE`); conflicts return 409 (`OUT_OF_STOCK`, `PRICE_CHANGED`, `INVALID_STATUS_TRANSITION`); `OTP_RATE_LIMITED` is 429. The first violation is the error code; `details.violations` and `details.quote` carry all of them. | One code per response, all information available to the client. |
| D18 | Extra error codes: `PAYMENT_VERIFICATION_FAILED` (400), `PAYMENT_GATEWAY_ERROR` (502), `INTERNAL_ERROR` (500). | The spec list had no code for gateway failures. |
| D19 | Admin may cancel `OUT_FOR_DELIVERY` orders (e.g. customer refused delivery). | Analysis item 23 and "admin may cancel any non-terminal order" take precedence over the narrower status diagram. |
| D20 | Admin cancel requires a reason; customer cancel reason is optional ("Cancelled by customer"). | The spec asks for a reason from the store; customers should be able to cancel in one tap. |
| D21 | Payment status on cancel: `PAID` becomes `REFUND_PENDING`, online `PENDING` becomes `FAILED`, COD keeps `COD_PENDING`. A payment captured after an order expired marks it `REFUND_PENDING` instead of reviving it. | Stock was already released; the money must go back. |
| D22 | Idempotency: the key row is inserted first in the order transaction; a concurrent duplicate blocks on the unique index, fails, and the request returns the original order (200). A rejected attempt (e.g. `PRICE_CHANGED`) rolls the key back so the app can retry with the same key. | Exactly one order per checkout attempt, even with double taps or retries. |
| D23 | Refresh tokens are opaque, stored as SHA-256, rotated on every use; reusing a rotated token revokes all of that subject's sessions. | Standard theft detection for long-lived tokens. |
| D24 | OTP codes are stored as HMAC-SHA256(JWT secret, phone:code); test numbers skip SMS and rate limits only when listed in `app.otp.test-numbers` (set in `application-dev.yml`, empty by default). | No plaintext codes at rest; test shortcuts cannot leak into production by default. |
| D25 | No admin-user management API yet; the first ADMIN comes from env, extra STAFF users are inserted manually. | Not listed in the API section; a later addition. |
| D26 | admin-web uses TanStack Table **v8** (8.21) instead of the v9 that npm installed. | v9 has a new, still-moving API (`createTableHook`); v8 is the stable documented one. |
| D27 | The admin new-order alert polls PLACED orders every 10 s from the layout (works on every page) and plays a Web Audio chime; browsers may block sound until the page has been clicked once. | No audio asset to ship; same polling as the orders page. |
| D28 | The 7-day dashboard shows orders and delivered revenue as two single-series bar charts. | Two measures with different scales never share one chart (no dual axis). |
| D29 | Customer app: Cart and Checkout are one screen ("Cart & checkout"): items, min-order progress, bill, address, payment, Place Order. | Fewer taps; the spec's cart section already lists address and payment. |
| D30 | Customer app: the address pin is set from GPS (or typed latitude/longitude when location is off) and fine-tuned with N/S/E/W nudges plus a "Check on map" link, instead of an in-app map. | An in-app map needs a Google Maps API key and billing; add `react-native-maps` later. |
| D31 | Customer app requires login before browsing (Login → OTP → Home), as in the spec's screen flow. | Keeps every API call authenticated except config, catalog and location check. |
| D32 | Razorpay is loaded lazily (`require` inside `openRazorpay`) and typed by a local declaration. | The module builds a native event emitter at import time, which crashes Jest and Expo Go. |
| D33 | `prod` profile: ECS JSON logs, Swagger off, forwarded headers, graceful shutdown. | Phase 7 hardening; dev keeps readable logs and Swagger. |
| D34 | Product PUT sends `stockQtyLoaded` per existing variant; the server applies `stockQty - stockQtyLoaded` to the current stock instead of overwriting it. | Found in QA: saving the edit form after orders arrived put sold stock back (overselling). |
| D35 | The per-item limit (50) applies to the merged quantity when a cart repeats a variant; distances are rounded **up** for display. | QA findings: duplicate lines bypassed the limit; a refused point at 5.004 km showed "5.00 km away, limit 5.00 km". |
| D36 | Cancelled COD orders show "Not charged" (payment status stays `COD_PENDING` in data). | Avoids "Collect cash" on cancelled orders without adding a status. |
| D37 | Windows native builds: build from a short, space-free path (e.g. `C:\k`) with the SDK reachable without spaces (`C:\andsdk` junction) and `externalNativeBuild.cmake.buildStagingDirectory` set short in `android/app/build.gradle`. | ninja 1.10 (bundled with CMake 3.22) cannot create paths over ~248 chars, and an SDK path with a space makes CMake call `CLANG_~1.EXE`, which then does not link libc++. |
| D38 | The customer app also runs in a browser (Expo web, `react-native-web`) for quick testing: `.web.ts` files swap the keystore for localStorage and Razorpay for a "use the Android app" message, `showAlert` falls back to browser dialogs, `10.0.2.2` becomes `localhost`, and screens render in a 430 px phone-width column. | Lets the owner and testers try the app without an emulator or phone. Not a production web shop. |

## Production UI/UX and hardening pass

| # | Decision | Reason |
|---|---|---|
| D39 | Customer app icons: `lucide-react-native` on `react-native-svg` (same icon family as the admin web). Adds one native module, so the Android dev build was rebuilt. | SDK 58 no longer ships the font module `@expo/vector-icons` needs; SVG icons render identically on Android and web. |
| D40 | Responsive customer app driven by one pure function, `computeLayout(width)`: 2 to 6 product columns, 4 to 8 category columns, two-pane cart and order detail from 900 px, content capped at 1200 px. Replaces the fixed 430 px phone frame in the browser. | One tested source of breakpoints for phones, tablets and the desktop browser. |
| D41 | Category placeholders: an illustration and tint chosen from the category name/slug (`categoryVisual`) until the store uploads photos. | Seed data has no images; letters on tiles looked unfinished. |
| D42 | Non-blocking feedback uses toasts; decisions (cancel order, log out, price changed) keep dialogs. A React error boundary wraps the app. | Fewer interruptions; a render crash no longer leaves a blank screen. |
| D43 | Navigation params are plain ids (e.g. `AddressForm { addressId }`), with web URLs (`/cart`, `/orders/12`, `/category/3`) and `kirana://` deep links. | Browser refresh/back and deep links need serialisable params. |
| D44 | Release builds: `APP_ENV` per EAS profile; cleartext HTTP only in development, and preview/production builds fail fast unless `EXPO_PUBLIC_API_BASE_URL` is `https://`. | Prevents shipping an app that talks to the API over plain HTTP. |
| D45 | Admin web: responsive shell (sidebar from `lg`, slide-out menu below), card lists instead of tables below `md`, light/dark/system theme with a pre-paint script, per-page document titles. Own small theme provider instead of `next-themes`. | `next-themes` renders an inline script React 19 warns about in a client-only app. |
| D46 | Admin login lockout: 5 failures per email + client address in a sliding 15-minute window (`TOO_MANY_ATTEMPTS`, 429). OTP sends limited to 20 per hour per client address (`app.otp.max-sends-per-ip-per-hour`, 0 disables). In memory, per instance. | Brute-force and SMS-pumping protection without new infrastructure; move to Redis or the gateway when scaling out. |

## Catalog photos, deployment and release APK

| # | Decision | Reason |
|---|---|---|
| D47 | Starter photos for all 8 categories and 32 products come from Wikimedia Commons (CC0 / public domain / CC BY / CC BY-SA only, generic items, no brand packaging), resized to about 500 px, bundled in the backend jar (`seed-images/`) and copied to `MEDIA_DIR` at startup by `CatalogImageSeeder`. Migration `V3` sets image URLs only where none is set. Credits in `docs/IMAGE_CREDITS.md`. | Images work in every environment without a manual upload step, never overwrite the store's own photos, and respect the licences. |
| D48 | Production runs as one Docker Compose stack (`deploy/`): MySQL, backend, and Caddy serving the admin web and the customer web app, terminating HTTPS for three hostnames (`admin.`, `shop.`, `api.`). Only 80/443 are published. Images are built on the server (ARM-native on Oracle Ampere). | Smallest moving parts for a single store; automatic Let's Encrypt certificates; no separate CI needed. |
| D49 | Without a domain, hostnames use sslip.io (`api.<ip-with-dashes>.sslip.io`). | Real HTTPS on day one for free; switching to a real domain only changes three env values. |
| D50 | Base images are configurable (`BASE_REGISTRY`, default Docker Hub; `mirror.gcr.io/library` as fallback) and the prod Compose project is named `kirana-prod`. | Docker Hub's CDN is unreachable from some networks; a distinct project name can never collide with the local development database. |
| D51 | `OTP_TEST_NUMBERS` env var (empty by default) enables demo logins in any profile. | Lets a fresh deployment be tested before an SMS provider is set up; documented to be emptied before launch. |
| D52 | Standalone APKs: release builds embed the JS bundle and use `APP_ENV` + `EXPO_PUBLIC_API_BASE_URL` at build time. Local release builds are signed with the debug key; Play Store builds go through EAS, which manages the signing key. | Installable APKs today; a stable upload key for store releases without keeping keystores in the repo. |
| D53 | Hindi is the default language in both apps, English optional; the choice is remembered per device/browser. Strings live in typed per-feature dictionaries (a missing Hindi key fails type-checking and a unit test). Catalog content gets optional `name_hi` columns (seeded for the demo catalog) instead of a generic translations table. Server error messages stay English; the apps translate by error code. | One owner, one city: two languages cover the users. Typed dictionaries keep translations complete without a library; owners can add Hindi names gradually. |
| D54 | Every order is accepted by the store before packing: new `ACCEPTED` status between `PLACED` and `PACKED`. Customers can cancel until the store packs. "Out for delivery" is shown as **Dispatch** in the admin. | Matches how the shop already works (confirm, pack, send) and tells the customer the store has seen the order. |
| D55 | Order requests: a photo of a handwritten list and/or a voice note plus a delivery address. The store builds the order (catalog items at today's prices, plus free-text items it prices by hand) and accepts it, creating an `ACCEPTED` cash-on-delivery order; or declines with a reason. No minimum order for these. Voice notes are recordings, not speech-to-text. | Kirana customers already send parchis and voice notes on WhatsApp. Recordings work for any language or accent and let the shopkeeper hear exactly what was asked; free-text lines cover items not in the catalog. |
| D56 | Request photos and voice notes are private: stored outside the public `/media/images` mapping and served only through HMAC-signed links (key derived from `JWT_SECRET`) that expire after 6 hours. The app shrinks photos to 1600 px JPEG before upload; Caddy allows 12 MB request bodies. | Handwritten lists and voices are personal data; signed links work in `<img>`/`<audio>` and in the native app without auth headers. |
| D57 | The store location is set on an OpenStreetMap map in Store settings (Leaflet, no API key): place search through Nominatim only when the owner presses Find (its policy: at most one request a second, no search-as-you-type), plus pasted coordinates or Google Maps links read in the browser. The pin can be dragged and the delivery circle is drawn live. Search requests go straight from the browser with no app token. | Typing latitude/longitude is error-prone and desktop browser geolocation is often kilometres off, which matters with a 5 km radius. OSM tiles and Nominatim need no account or billing; the admin page's traffic is tiny. |

Known limitations (not fixed): two admin browser tabs refreshing the same token at the same instant can trip refresh-reuse detection and log both out; there is no UI to add STAFF users or to clear a stored gateway secret; the dashboard's low-stock *list* shows the first 20 (the count is exact); push notifications for accepted requests are not sent yet (the app polls while a request is waiting).
