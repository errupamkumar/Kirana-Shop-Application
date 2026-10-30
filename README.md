# Kirana Shop Automation System

A Blinkit-inspired grocery ordering system for **one** local kirana store: customers order from an Android app, the owner runs the store from a web admin. Business rules (delivery radius, minimum order, delivery fee and free-delivery threshold, payment methods, store open/closed) live in one `store_settings` row, are enforced by the server, and reach both clients through `/app/config` without an app update. There are no delivery countdown timers.

| App | Stack | Folder |
|---|---|---|
| REST API | Java 21, Spring Boot 3.5, Spring Security + JWT, JPA, MySQL 8.4, Flyway | [backend/](backend/) |
| Admin web | React 19 + TypeScript, Vite, Tailwind v4, shadcn/ui, TanStack Query/Table, React Hook Form + Zod, Recharts | [admin-web/](admin-web/) |
| Customer app | Expo SDK 58 (React Native 0.88) + TypeScript, NativeWind, React Navigation, TanStack Query, Zustand, Razorpay | [customer-app/](customer-app/) |

Docs: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (from zero to live on Oracle Cloud)**, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (code flow and diagrams), [docs/API.md](docs/API.md) (every endpoint and error code), [docs/DECISIONS.md](docs/DECISIONS.md), [docs/BUILD_PROMPT.md](docs/BUILD_PROMPT.md) (spec and phase plan).

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Scaffold | ✅ |
| 1 | Database, settings, catalog | ✅ |
| 2 | Auth (OTP, JWT, admin login) | ✅ |
| 3 | Checkout and orders | ✅ |
| 4 | Admin web | ✅ |
| 5 | Customer app (COD) | ✅ |
| 6 | Online payments (Razorpay, behind the toggle) | ✅ (live Razorpay test payment needs your test keys) |
| 7 | Hardening and docs | ✅ |

## Prerequisites

- **Java 21** (no Maven install needed; use `./mvnw`)
- **Node.js 22.13+ or 24 LTS** (Expo SDK 58 requires `^22.13.0 || ^24.3.0`; 22.12 works with warnings)
- **Docker Desktop** (MySQL for development, Testcontainers for backend tests)
- **Android Studio** with SDK, NDK and an emulator (or a device with USB debugging) for the customer app

## Run locally

```bash
# 1. Configuration and database
cp .env.example .env              # fill JWT_SECRET, APP_ENCRYPTION_KEY, passwords (see below)
docker compose up -d mysql        # MySQL 8.4 on localhost:3307, schema + seed data via Flyway on first backend start

# 2. Backend: http://localhost:8080, Swagger at http://localhost:8080/swagger-ui
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
./mvnw verify                     # unit + Testcontainers integration tests (Docker must be running)

# 3. Admin web: http://localhost:5173
cd admin-web
npm install
npm run dev
npm run lint && npm run test && npm run build

# 4. Customer app (Android emulator or device)
cd customer-app
npm install
npx expo prebuild && npx expo run:android   # dev build (needed for Razorpay and other native modules)
npm run lint && npx tsc --noEmit && npm test
# Emulator reaches the backend at http://10.0.2.2:8080
```

On Windows use `mvnw.cmd` in cmd/PowerShell, or `./mvnw` in Git Bash. **In PowerShell, quote `-D` arguments**, otherwise PowerShell splits them at the first dot (`Unknown lifecycle phase ".run.profiles=dev"`):

```powershell
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

**Windows: build the native app from a short path without spaces.** Two Windows limits break React Native's C++ build when the repo lives in `D:\SRM Products\Kirana Shope Module`: ninja cannot create directories over ~248 characters (`ninja: error: mkdir(...): No such file or directory`), and an Android SDK path with a space (`C:\Users\<First Last>\...`) makes CMake call clang by its 8.3 short name, which then fails to link libc++ (`undefined symbol: std::__ndk1::...`). A `subst` drive does not help, because autolinking resolves the real path. What works:

```powershell
# 1. SDK through a junction without spaces (once)
New-Item -ItemType Junction -Path C:\andsdk -Target "$env:LOCALAPPDATA\Android\Sdk"
# 2. Copy the app to a short folder (or clone the whole repo to C:\k)
robocopy "D:\SRM Products\Kirana Shope Module\customer-app" C:\k /E /XD .cxx
# 3. Point Gradle at the junction and use a short CMake staging dir
Set-Content C:\k\android\local.properties "sdk.dir=C:/andsdk"
#    in C:\k\android\app\build.gradle, inside android { }:
#    externalNativeBuild { cmake { buildStagingDirectory "C:/kb" } }
cd C:\k\android; $env:ANDROID_HOME = 'C:\andsdk'
.\gradlew app:assembleDebug -PreactNativeArchitectures=x86_64
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

The installed dev client then loads JavaScript from Metro started in the repo (`npx expo start --dev-client`, plus `adb reverse tcp:8081 tcp:8081`), so day-to-day edits in the repo hot-reload without rebuilding. Rebuild the APK only when native dependencies change. Cloning the repo itself to a short path (for example `C:\kirana`) with the SDK junction avoids the copy step.

### Customer app in a web browser (quick testing, no phone or emulator)

```powershell
cd customer-app
npx expo start --web          # then open http://localhost:8081 (or press w)
```

The app adapts to the window: phone layout on narrow windows, more columns on tablets, and a two-pane cart and order screen on desktop. It talks to the backend at `http://localhost:8080`, and every screen has its own URL, so refresh and the back button work. Everything works except online payment (Razorpay needs the Android app); tokens are kept in the browser's localStorage, dialogs use the browser's confirm/alert, and "Allow location" uses the browser's location prompt. Use this for quick testing; the Android build is still the real app.

### Logging in during development

| Who | How |
|---|---|
| Store admin | http://localhost:5173 with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (created on first backend start when no admin exists) |
| Customer | Phone `9999999999`, `9999999998` or `9999999997` with OTP `123456` (dev profile test numbers, no SMS). Any other number gets a real code printed in the backend log: `[DEV OTP] code for +91… is …` |

The seed store is at MG Road, Bengaluru (12.971599, 77.594566) with a 5 km radius, ₹500 minimum order, ₹30 delivery, free above ₹1000, COD on and online payment off. 32 products in 8 categories, each with a starter photo (freely licensed, credited in [docs/IMAGE_CREDITS.md](docs/IMAGE_CREDITS.md)); replace them from the admin at any time.

To test "out of radius" on the emulator, set a mock location in the emulator's Extended controls → Location (for example 13.10, 77.59).

### Configuration

Every app reads the root `.env` ([.env.example](.env.example) lists all variables):

- The backend imports it with `spring.config.import`; real environment variables override it.
- admin-web reads `VITE_*` from it (`envDir: '..'`).
- customer-app's `app.config.ts` reads `EXPO_PUBLIC_API_BASE_URL` and exposes it as `extra.apiBaseUrl`. On a real device use your computer's LAN IP, e.g. `http://192.168.1.20:8080`.

Generate secrets with `openssl rand -base64 48` (`JWT_SECRET`) and `openssl rand -base64 32` (`APP_ENCRYPTION_KEY`, encrypts the Razorpay secret in the database; keep it safe, changing it makes the stored secret unreadable).

### Online payments (Razorpay test mode)

1. In Razorpay Dashboard (test mode) create API keys and a webhook to `https://<your-host>/api/v1/webhooks/razorpay` for `payment.captured` and `order.paid`; put its secret in `RAZORPAY_WEBHOOK_SECRET`.
2. Admin → Settings → turn on Online payment, enter the key id and key secret (the secret is write-only; leave blank later to keep it).
3. In the dev build, choose "Pay online" at checkout. The order waits in `PENDING_PAYMENT`, becomes `PLACED` / `PAID` once the signature is verified (or the webhook arrives), and is cancelled with stock released if unpaid after 15 minutes.

### Docker notes

- MySQL is published on host port **3307** so it does not clash with a local MySQL on 3306. Change `MYSQL_PORT` and `DB_URL` together.
- The MySQL image comes from Oracle's registry (`container-registry.oracle.com/mysql/community-server:8.4`). Set `MYSQL_IMAGE=mysql:8.4` to use Docker Hub instead (for both compose and tests).
- `docker compose --profile full up -d --build` also runs the backend in a container ([backend/Dockerfile](backend/Dockerfile)).

## Production notes

The complete, step-by-step server setup (Oracle Cloud Always Free VM, Docker, automatic HTTPS, Android APK for your server) is in **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. Production files live in [deploy/](deploy/): `docker-compose.prod.yml` (MySQL, backend, Caddy with the admin and customer web apps), `Caddyfile`, `web.Dockerfile`, `.env.prod.example` and scripts for server setup, deploys and backups.


- **Profile**: run the backend with `SPRING_PROFILES_ACTIVE=prod` (JSON logs, Swagger off, graceful shutdown, forwarded headers). Do not enable the `dev` profile: it turns on the OTP test numbers.
- **Env vars**: `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `APP_ENCRYPTION_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ALLOWED_ORIGINS` (the admin's https origin), `OTP_PROVIDER=msg91` with `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` (a DLT-approved template with an `##OTP##` variable), `RAZORPAY_WEBHOOK_SECRET`, `MEDIA_DIR` (a persistent volume).
- **HTTPS**: terminate TLS at a reverse proxy (nginx, a cloud load balancer) in front of the API and the admin's static files (`admin-web/dist`, built with `VITE_API_BASE_URL=https://api.example.com`). Build the app with `EXPO_PUBLIC_API_BASE_URL=https://…` and remove `usesCleartextTraffic` from `app.config.ts` for release.
- **Backups**: schedule `mysqldump --single-transaction kirana` (or managed-database snapshots) and back up `MEDIA_DIR`. Flyway migrations run automatically on start; take a backup before deploying a new version.
- **Health**: `GET /actuator/health` (liveness/readiness under `/actuator/health/liveness` and `/readiness` in prod).
- **Android release**: set your real API address in [customer-app/eas.json](customer-app/eas.json) (`EXPO_PUBLIC_API_BASE_URL`, must be `https://`), then `npx eas-cli@latest build -p android --profile production` for a Play Store AAB, or `--profile preview` for an installable APK. Release builds refuse plain HTTP.
- **Rate limits** (admin login lockout, OTP per address) are in memory per backend instance; with several instances, add a shared limit (Redis or the API gateway).
- **Later**: FCM push for status changes, S3 image storage, scheduled store hours, GST invoices, admin-user management, an in-app map for address pins.

## Repository layout

```
backend/        Spring Boot API, package by feature under com.kirana (auth, catalog, checkout, order, payment, ...)
  src/main/resources/db/migration/   Flyway V1__init.sql (schema), V2__seed.sql (dev data)
admin-web/      Vite + React admin (src/pages, src/components, src/lib)
customer-app/   Expo Android app (src/screens, src/components, src/hooks, src/store, src/lib)
docs/           API.md, DECISIONS.md, BUILD_PROMPT.md
.claude/agents/ qa-bug-resolver.md (QA agent used to test the system)
docker-compose.yml
.env.example
```
