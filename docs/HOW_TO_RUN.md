# How to run the Kirana apps (step by step)

This guide starts everything on one Windows PC: the **backend** (server and database), the **admin website**, and the **customer app**. The customer app can run four ways; pick one:

| Way | Good for | Needs | Online payment |
|---|---|---|---|
| [A. Web browser](#a-customer-app-in-a-web-browser-quickest) | Quick testing on the PC | Nothing extra | No |
| [B. Expo Go on your phone](#b-customer-app-in-expo-go-on-your-android-phone) | Trying it on a real phone without building | The **Expo Go** app, same Wi-Fi | No |
| [C. Development build on an emulator or phone](#c-development-build-on-the-android-emulator-or-a-phone) | Full app while developing | Android Studio | Yes (Razorpay test mode) |
| [D. Install an APK](#d-install-an-apk) | Testing the finished app | An APK file | Yes |

Commands are for **PowerShell**. Run each "terminal" in its own PowerShell window and leave it open.

**Contents**

1. [Install the tools (once)](#1-install-the-tools-once)
2. [Get the code and create `.env` (once)](#2-get-the-code-and-create-env-once)
3. [Start the database and backend](#3-start-the-database-and-backend)
4. [Start the admin website](#4-start-the-admin-website)
5. [Run the customer app](#5-run-the-customer-app)
6. [Logins and test numbers](#6-logins-and-test-numbers)
7. [First things to set in the admin](#7-first-things-to-set-in-the-admin)
8. [Stop everything](#8-stop-everything)
9. [Problems and fixes](#9-problems-and-fixes)

---

## 1. Install the tools (once)

| Tool | Version | Used for |
|---|---|---|
| [Git](https://git-scm.com/download/win) | any recent | Getting the code |
| [Node.js](https://nodejs.org/) | **22.13 or newer** (22 LTS or 24 LTS) | Admin website and customer app. Older 22.x versions show "Node.js is outdated" warnings |
| [Java JDK](https://adoptium.net/) | **21** | Backend |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | any recent | MySQL database |
| [Android Studio](https://developer.android.com/studio) | any recent | Only for ways C and D (emulator, Android SDK, `adb`) |
| **Expo Go** (Play Store, on your phone) | must support Expo **SDK 58** | Only for way B |

Check them:

```powershell
node -v; java -version; docker --version
```

---

## 2. Get the code and create `.env` (once)

```powershell
git clone https://github.com/errupamkumar/Kirana-Shop-Application.git
cd Kirana-Shop-Application
Copy-Item .env.example .env
```

Open `.env` in a text editor and fill in the empty values:

| Setting | What to put |
|---|---|
| `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD` | Any passwords you choose |
| `JWT_SECRET` | A random value of 48 bytes (command below) |
| `APP_ENCRYPTION_KEY` | A random value of exactly 32 bytes (command below) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The admin login you want (see [Logins](#6-logins-and-test-numbers)) |

Random values in PowerShell (run once for each, with 48 and with 32):

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

Leave the other lines as they are. Never commit `.env` (it is already in `.gitignore`).

Install the website and app packages:

```powershell
cd admin-web;    npm install;  cd ..
cd customer-app; npm install;  cd ..
```

---

## 3. Start the database and backend

**Terminal 1** (from the project folder). Start Docker Desktop first and wait until it says it is running.

```powershell
docker compose up -d mysql
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

- The first start downloads Maven and libraries and creates the database tables and demo data, so it takes a few minutes.
- It is ready when the window shows **`Started KiranaApplication`**.
- Check it: open http://localhost:8080/api/v1/app/config in a browser. You should see the store name and rules.
- API documentation: http://localhost:8080/swagger-ui

Keep this window open. The quotes around `-Dspring-boot.run.profiles=dev` are needed in PowerShell.

---

## 4. Start the admin website

**Terminal 2:**

```powershell
cd admin-web
npm run dev
```

Open **http://localhost:5173** and sign in with the admin login from [section 6](#6-logins-and-test-numbers). The admin opens in Hindi; click **English** at the bottom of the menu (or on the sign-in page) to switch.

---

## 5. Run the customer app

The backend (section 3) must be running for every way.

### A. Customer app in a web browser (quickest)

**Terminal 3:**

```powershell
cd customer-app
npx expo start --web
```

Open **http://localhost:8081**. For a phone-sized screen in Chrome or Edge, press **F12**, then **Ctrl+Shift+M** and pick a phone.

- The web version calls the backend at `http://localhost:8080` by itself.
- Allow **location** when the browser asks, so the app can check the delivery area.
- **Photo of list** opens a file picker; **Voice order** uses the PC's microphone (allow it when asked).
- Online payment is not available in the browser; use cash on delivery.

### B. Customer app in Expo Go on your Android phone

Expo Go runs the app on a real phone without building an APK. Everything works except **online payment** (Razorpay needs its own native code, which Expo Go doesn't include); use cash on delivery.

1. On the phone, install **Expo Go** from the Play Store (or update it). It must support **SDK 58**; if it says the project is incompatible, update Expo Go.
2. Connect the phone and the PC to the **same Wi-Fi**.
3. Find the PC's Wi-Fi address: run `ipconfig` and note the **IPv4 Address** of the Wi-Fi adapter, for example `192.168.1.20`.
4. Allow the phone to reach the PC. Open **PowerShell as Administrator** once and run:

   ```powershell
   New-NetFirewallRule -DisplayName "Kirana dev 8080-8081" -Direction Inbound -Protocol TCP -LocalPort 8080,8081 -Action Allow -Profile Private
   ```

   Your Wi-Fi must be set to a **Private** network in Windows settings.
5. **Terminal 3** (use your own address):

   ```powershell
   cd customer-app
   $env:EXPO_PUBLIC_API_BASE_URL = "http://192.168.1.20:8080"
   npx expo start --go
   ```

6. In Expo Go, tap **Scan QR code** and scan the QR code shown in the terminal. The first load takes a minute.
7. Check from the phone's browser that http://192.168.1.20:8080/api/v1/app/config opens. If it doesn't, the phone can't reach the PC (Wi-Fi or firewall; see [Problems](#9-problems-and-fixes)).

On the **Android emulator**, `npx expo start --go --android` installs Expo Go on the emulator and opens the app there (it calls the backend at `10.0.2.2:8080`, the emulator's name for your PC, so step 5's address line is not needed).

> The project uses Expo SDK 58, which the current Expo Go supports. Ways A, C and D were tested on the build PC; Expo Go could not be downloaded there (no access to GitHub), so check way B on your phone.

### C. Development build on the Android emulator or a phone

This is the full app, including Razorpay test payments, and it reloads as you edit the code.

1. In Android Studio, open **Device Manager** and start an emulator (or connect a phone by USB with **USB debugging** on).
2. **First time only**, build and install the development app:

   ```powershell
   cd customer-app
   npx expo run:android
   ```

   **Windows note:** if the project folder path contains spaces (for example `D:\SRM Products\...`), the native build fails. Build from a short copy instead; the exact steps are in the README, section [Run locally](../README.md#run-locally) ("Windows: build the native app from a short path without spaces").
3. **Every day after that**, start Metro and connect the device:

   ```powershell
   cd customer-app
   npx expo start --dev-client
   adb reverse tcp:8081 tcp:8081
   ```

   Open the **Kirana** app on the emulator; it loads from Metro. The emulator reaches the backend at `http://10.0.2.2:8080` by itself.
4. On a **USB phone**, also forward the backend port and point the app at it before starting Metro:

   ```powershell
   adb reverse tcp:8080 tcp:8080
   $env:EXPO_PUBLIC_API_BASE_URL = "http://localhost:8080"
   npx expo start --dev-client
   ```

### D. Install an APK

An APK is the finished app; it doesn't need Metro.

- **For your local backend:** a release APK built for `http://localhost:8080` (for example `apk/kirana-customer-local.apk`, if it was built on this PC; the `apk/` folder is not in git). Install it on the emulator and forward the backend port:

  ```powershell
  adb install -r apk\kirana-customer-local.apk
  adb reverse tcp:8080 tcp:8080
  ```

- **For a real phone:** use an APK built for your **server** (an `https://` address), because a phone can't reach `localhost` on your PC. See the Deployment guide, [section 10, "Build the Android app for your server"](DEPLOYMENT.md#10-build-the-android-app-for-your-server). Copy the APK to the phone, tap it and allow **Install unknown apps**.

`adb` is in `%LOCALAPPDATA%\Android\Sdk\platform-tools`; add that folder to `PATH` or run it with the full path.

---

## 6. Logins and test numbers

The real admin password is **not written here** because this repository is public. It is in your own `.env` file.

| Who | Where | Login |
|---|---|---|
| **Store admin** (local) | http://localhost:5173 | **Email:** the `ADMIN_EMAIL` in `.env` (`admin@kirana.local` unless you changed it). **Password:** the `ADMIN_PASSWORD` in `.env`. To see both: `Select-String '^ADMIN_' .env` |
| **Customer** (local) | Any way from section 5 | Mobile **`9999999999`**, **`9999999998`** or **`9999999997`**, OTP **`123456`**. These test numbers work only with the dev backend and never send an SMS |
| **Customer**, any other number (local) | Any way from section 5 | The OTP is printed in the backend window (terminal 1): `[DEV OTP] code for +91… is …` |
| **Store admin** (server) | Your admin address, for example `https://admin.yourstore.in` | `ADMIN_EMAIL` / `ADMIN_PASSWORD` from the `.env` **on the server** |
| **Customer** (server) | APK built for the server | Real SMS once MSG91 is set up ([Deployment guide, section 11](DEPLOYMENT.md#11-going-live-checklist)); until then the code is in the server log |

Good to know:

- The admin account is created on the **first** backend start, from `.env`. Changing `ADMIN_PASSWORD` in `.env` later does **not** change it; see [Deployment guide, section 12](DEPLOYMENT.md#12-day-to-day-operations) to reset it.
- After **5 wrong passwords** the admin login is blocked for 15 minutes.
- Each phone number can ask for at most **5 OTP codes an hour**.

---

## 7. First things to set in the admin

Sign in to the admin and open **Settings**:

1. **Location and delivery area**: search for your shop or drag the pin onto it, and set the delivery radius (for example 5 km). The demo store is in Bengaluru, so until you move it, addresses elsewhere show **"We don't deliver here yet"**.
2. **Store details**: your shop's name, phone and address.
3. **Order rules**: minimum order, delivery charge, free-delivery amount.
4. Click **Save settings**.

Then check **Products** and **Categories**. The admin guide explains every page: [ADMIN_GUIDE.md](ADMIN_GUIDE.md). The customer guide: [USER_GUIDE.md](USER_GUIDE.md).

---

## 8. Stop everything

- Press **Ctrl+C** in each terminal (backend, admin, customer app).
- Stop the database (your data is kept for next time):

  ```powershell
  docker compose stop mysql
  ```

Next time, start again from [section 3](#3-start-the-database-and-backend): `docker compose up -d mysql`, then the backend, admin and app.

---

## 9. Problems and fixes

| What you see | Why | Fix |
|---|---|---|
| App says **"दुकान से कनेक्शन नहीं हो पाया। अपना इंटरनेट जाँचें।"** ("Couldn't connect to the store") | The app gets no answer from the backend | Check that terminal 1 shows `Started KiranaApplication` and that http://localhost:8080/api/v1/app/config opens. On a phone (way B), use the PC's Wi-Fi address, the firewall rule and a Private network |
| **"We don't deliver here yet"** | The address is outside the store's delivery circle | Admin → **Settings** → put the pin on your shop and check the radius ([section 7](#7-first-things-to-set-in-the-admin)) |
| Backend stops with **"Communications link failure"** | The database isn't running | Start Docker Desktop, then `docker compose up -d mysql` |
| **"Port 8080 was already in use"** | Another backend or program uses the port | `netstat -ano \| findstr :8080` shows the process id; close that program |
| Admin page shows **"Login failed"** | Wrong email or password, or 5 wrong tries | Check `Select-String '^ADMIN_' .env`; wait 15 minutes after 5 wrong tries |
| Expo Go: **"Project is incompatible with this version of Expo Go"** | Expo Go is older or newer than SDK 58 | Update Expo Go from the Play Store. If the Play Store version has moved past SDK 58, use way C or D |
| Expo Go keeps loading or shows **"Could not connect to development server"** | The phone can't reach Metro on port 8081 | Same Wi-Fi, firewall rule from way B step 4, Wi-Fi set to Private |
| `npx expo run:android` fails with **`ninja: error: mkdir`** or **`undefined symbol: std::__ndk1`** | The project path is too long or has spaces | Build from a short folder ([README Windows note](../README.md#run-locally)) |
| **"Node.js is outdated"** warnings | Node older than 22.13 | Install the current Node 22 LTS or 24 LTS |
| App opens in Hindi | Hindi is the default | Tap **English** on the login screen, or **Account → Language** |
