# Deployment guide: from zero to live

This guide takes Kirana from your PC to a public server on **Oracle Cloud's Always Free tier**, with HTTPS, and ends with an Android APK that talks to it. No paid services are required to go live for testing. Real SMS (MSG91) and online payments (Razorpay) are optional add-ons at the end.

What you will have at the end:

| URL | What |
|---|---|
| `https://admin.<your-host>` | Admin web for the store owner |
| `https://shop.<your-host>` | Customer app in the browser |
| `https://api.<your-host>` | Backend API (the Android app talks to this) |
| `kirana.apk` | Android app for customers |

```
Internet ── 443 ──> Caddy (automatic HTTPS) ─┬─ admin.<host> → admin web (static files)
                                             ├─ shop.<host>  → customer web app (static files)
                                             └─ api.<host>   → backend (Spring Boot) ──> MySQL
                         (one Oracle Cloud VM, everything in Docker; only ports 80/443 are open)
```

Time needed: about 1 hour, most of it waiting for the account and the first build.

---

## 1. Before you start

You need:

- A **card** for Oracle's identity check (Always Free resources are not charged; Oracle may place a small temporary hold).
- A **mobile number and email** for the Oracle account.
- This project on your PC (the folder with `backend/`, `admin-web/`, `customer-app/`, `deploy/`).
- On Windows: **PowerShell** (built in) for SSH, and **Git** (optional, recommended).
- For the Android APK: a free **Expo account** (https://expo.dev/signup) if you build with EAS (recommended), or the local Android toolchain described in the README.

> **No domain yet?** That's fine. The free [sslip.io](https://sslip.io) service turns your server's IP into hostnames such as `api.152-67-10-20.sslip.io`, and Let's Encrypt issues real certificates for them. You can switch to your own domain later in 5 minutes (section 11).

---

## 2. Create the Oracle Cloud account

1. Go to **https://signup.cloud.oracle.com** and choose **Start for free**.
2. Enter your country, name and email; verify the email.
3. Choose a **cloud account name** (lowercase, it becomes part of your login URL) and a password.
4. **Home region: choose carefully, it cannot be changed later.** Pick one close to your customers, e.g. *India West (Mumbai)* or *India South (Hyderabad)*. If Ampere capacity is often exhausted there, a less busy region in the same continent works too.
5. Verify your mobile number and add the card. Choose the **Always Free / Free Tier** account.
6. Wait for the "account is ready" email (usually minutes, sometimes a few hours), then sign in at **https://cloud.oracle.com** with your cloud account name.

> Always Free includes Ampere (ARM) compute up to **4 OCPUs and 24 GB RAM** in total, **200 GB** of block storage and generous outbound traffic. That is plenty for one store.
>
> Oracle can reclaim Always Free VMs that stay almost idle for a long time. Upgrading the account to **Pay As You Go** (Billing → Upgrade) keeps the same free allowances, removes that risk and still costs nothing while you stay within the free limits. Set a **budget alert** (Billing → Budgets) at a small amount for peace of mind.

---

## 3. Create the virtual machine

In the Oracle Cloud console:

1. **☰ menu → Compute → Instances → Create instance.**
2. **Name:** `kirana`.
3. **Image and shape → Edit:**
   - Image: **Canonical Ubuntu 24.04** (22.04 also works).
   - Shape: **Ampere → VM.Standard.A1.Flex**, **2 OCPUs and 12 GB RAM** (or up to 4 / 24 GB). Look for the "Always Free-eligible" label.
4. **Networking:** keep *Create new virtual cloud network* and *Create new public subnet*, and make sure **Assign a public IPv4 address** is selected.
5. **Add SSH keys:** choose **Generate a key pair for me** and click **Save private key** (and the public key). Keep the private key file safe; it is the only way into the server.
6. **Boot volume:** default (about 47 GB) is enough; up to 200 GB is free.
7. Click **Create**. When the state is **Running**, copy the **Public IP address** (e.g. `152.67.10.20`).

> **"Out of capacity for shape VM.Standard.A1.Flex"** is common in busy regions. Try another *Availability domain* on the same page, try fewer OCPUs (1-2), or retry later; capacity frees up through the day.

**Recommended: keep the IP fixed.** Instance → *Attached VNICs* → the VNIC → *IPv4 addresses* → edit the public IP → **Reserved public IP**. Otherwise the IP can change if the VM is stopped, and your hostnames would change with it.

---

## 4. Open ports 80 and 443 in the cloud firewall

1. Instance page → **Primary VNIC → Subnet** link → **Security Lists** → the *Default Security List*.
2. **Add Ingress Rules** (two rules, or one with "80,443"):

| Source CIDR | IP Protocol | Destination port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(Port 22 for SSH is already open by default.) The server's own firewall is opened by the setup script in step 7.

---

## 5. Connect to the server from Windows

Open **PowerShell** on your PC:

```powershell
# Move the downloaded key somewhere stable and restrict it to your user (SSH refuses keys others can read)
mkdir $HOME\.ssh -Force
Move-Item $HOME\Downloads\ssh-key-*.key $HOME\.ssh\kirana-oracle.key
icacls $HOME\.ssh\kirana-oracle.key /inheritance:r /grant:r "$($env:USERNAME):(R)"

# Connect (replace with your public IP)
ssh -i $HOME\.ssh\kirana-oracle.key ubuntu@152.67.10.20
```

Type `yes` the first time. You are now on the server (`ubuntu@kirana:~$`). Type `exit` to leave.

---

## 6. Copy the project to the server

**Option A: Git (recommended for updates).** Push the project to GitHub from your PC (`git push`), then on the server:

```bash
git clone https://github.com/errupamkumar/Kirana-Shop-Application.git ~/kirana
# For a private repo, GitHub asks for a username and a personal access token (Settings → Developer settings → Tokens)
```

Secrets never go to GitHub: `.env` and `deploy/.env.prod` are git-ignored, and `.env.prod` is created on the server in section 8. Later updates are `git push` on your PC and `bash deploy/scripts/deploy.sh` on the server (it pulls first).

**Option B: copy a zip from your PC** (no Git account needed). In PowerShell on your PC, from the project folder:

```powershell
cd "D:\SRM Products\Kirana Shope Module"
tar --exclude=node_modules --exclude=android --exclude=target --exclude=.env --exclude=dist -czf $HOME\kirana.tgz backend admin-web customer-app deploy docs docker-compose.yml .env.example .dockerignore README.md
scp -i $HOME\.ssh\kirana-oracle.key $HOME\kirana.tgz ubuntu@152.67.10.20:~
ssh -i $HOME\.ssh\kirana-oracle.key ubuntu@152.67.10.20 "mkdir -p ~/kirana && tar -xzf ~/kirana.tgz -C ~/kirana"
```

---

## 7. Prepare the server (once)

On the server:

```bash
cd ~/kirana
bash deploy/scripts/setup-server.sh
exit          # log out so the new "docker" group applies
```

The script installs Docker and Docker Compose from Docker's official repository, opens ports 80/443 in Ubuntu's firewall (Oracle images block them by default), adds a 4 GB swap file and turns on automatic security updates.

Reconnect with `ssh` and check: `docker run --rm hello-world` should print "Hello from Docker!".

---

## 8. Configure

```bash
cd ~/kirana/deploy
cp .env.prod.example .env.prod
nano .env.prod
```

Fill it in (Ctrl+O to save, Ctrl+X to exit):

1. **Hostnames.** With the IP `152.67.10.20`:
   ```
   ADMIN_HOST=admin.152-67-10-20.sslip.io
   SHOP_HOST=shop.152-67-10-20.sslip.io
   API_HOST=api.152-67-10-20.sslip.io
   ACME_EMAIL=you@example.com
   ```
2. **Secrets.** Generate each value on the server and paste it in:
   ```bash
   openssl rand -hex 16       # MYSQL_ROOT_PASSWORD, then again for DB_PASSWORD
   openssl rand -base64 48    # JWT_SECRET
   openssl rand -base64 32    # APP_ENCRYPTION_KEY  (also save a copy in your password manager)
   ```
3. **Owner login.** `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (12+ characters). This account is created on first start.
4. **Customer login for testing.** Keep `OTP_PROVIDER=logging` and `OTP_TEST_NUMBERS=+919999999999` for now: the number `9999999999` logs in with code `123456`, and any other number's code appears in the backend log (section 12). Before real customers arrive, switch to MSG91 and empty `OTP_TEST_NUMBERS` (section 11).

Protect the file: `chmod 600 .env.prod`.

---

## 9. Deploy

```bash
cd ~/kirana
bash deploy/scripts/deploy.sh
```

The first build compiles the backend and both web apps on the server and takes **10-20 minutes**; later updates are faster. The script waits for the API and then prints your URLs:

```
Live:
  Admin     https://admin.152-67-10-20.sslip.io
  Shop      https://shop.152-67-10-20.sslip.io
  API       https://api.152-67-10-20.sslip.io  (health: /actuator/health)
```

Check:

1. `https://api.<host>/actuator/health` shows `{"status":"UP"}` with a valid padlock.
2. **Admin:** open `https://admin.<host>`, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
3. **Settings:** set the store name, phone, address and **location** (use "Use my current location" while at the shop, or paste coordinates from Google Maps), the delivery radius, minimum order and delivery fee. Save.
4. **Catalog:** the store starts with 32 sample products with photos. Edit prices and stock, add your own products and photos, and switch off what you don't sell (Products → Visible).
5. **Shop:** open `https://shop.<host>` on a phone, log in with `9999999999` / `123456`, add a delivery address inside your radius and place a cash order. It appears in the admin Orders page with a sound.

---

## 10. Build the Android app for your server

The app needs your API address built in, and release builds only accept `https://` addresses.

### Option A: EAS Build in the cloud (recommended, works from any PC)

1. Edit `customer-app/eas.json` and set `EXPO_PUBLIC_API_BASE_URL` in the **preview** and **production** profiles to `https://api.<host>`.
2. On your PC:
   ```powershell
   cd "D:\SRM Products\Kirana Shope Module\customer-app"
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile preview
   ```
   The first time, accept creating a project and let EAS **generate the signing keystore** (it stores it securely; use the same project for all future builds so updates install over the old app). After about 15 minutes you get a link to download the **APK**: share it or install it directly on phones (allow "install unknown apps").
3. For the Play Store, build an app bundle with `--profile production` and upload it in the Play Console.

### Option B: local build on this PC

See the README section *Windows: build the native app from a short path without spaces*, then:

```powershell
cd C:\k\android
$env:ANDROID_HOME = 'C:\andsdk'
$env:APP_ENV = 'preview'
$env:EXPO_PUBLIC_API_BASE_URL = 'https://api.152-67-10-20.sslip.io'
.\gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a
# APK: C:\k\android\app\build\outputs\apk\release\app-release.apk
```

Local release builds are signed with the debug key: fine for installing directly, not accepted by the Play Store (use EAS for that).

---

## 11. Going live checklist

| Step | How |
|---|---|
| **Own domain** (optional) | At your domain registrar add three **A records** (`admin`, `shop`, `api`) pointing to the server IP. Change the three hosts in `.env.prod`, run `deploy.sh` again (Caddy gets new certificates), rebuild the APK with the new API URL. |
| **Real SMS for login** | Create an MSG91 account, get the auth key and a DLT-approved OTP template with `##OTP##`. Set `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, and **empty** `OTP_TEST_NUMBERS`. Run `deploy.sh`. |
| **Online payments** | In Razorpay (start in test mode): create API keys and a webhook to `https://api.<host>/api/v1/webhooks/razorpay` for `payment.captured` and `order.paid`; put the webhook secret in `RAZORPAY_WEBHOOK_SECRET` and run `deploy.sh`. Then in Admin → Settings switch on online payment and enter the key id and secret. |
| **Backups** | `(crontab -l 2>/dev/null; echo "30 2 * * * $HOME/kirana/deploy/scripts/backup-db.sh >> $HOME/kirana-backups/backup.log 2>&1") \| crontab -` then copy `~/kirana-backups` off the server regularly (e.g. `scp` to your PC, or Oracle Object Storage). |
| **Uptime alerts** | A free monitor (e.g. UptimeRobot) on `https://api.<host>/actuator/health`. |
| **Admin password** | Use a long unique password; only share admin access with people who need it. |
| **Product photos** | Replace the starter photos with your own (they are credited in `docs/IMAGE_CREDITS.md`). |

---

## 12. Day-to-day operations

All commands on the server, from `~/kirana/deploy`:

```bash
alias kc='docker compose --env-file .env.prod -f docker-compose.prod.yml'

kc ps                          # what is running
kc logs -f backend             # backend log (Ctrl+C to stop following)
kc logs backend | grep "DEV OTP"   # OTP codes while OTP_PROVIDER=logging
kc logs -f web                 # HTTPS / web server log
kc restart backend             # restart one service
bash scripts/deploy.sh         # update: pull new code, rebuild, restart (data is kept)
bash scripts/backup-db.sh      # backup now
df -h; docker system df        # disk usage
```

**Restore a backup** (overwrites the current data):

```bash
gunzip -c ~/kirana-backups/kirana-YYYYMMDD-HHMMSS.sql.gz | kc exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" kirana'
docker run --rm -v kirana-prod_media:/media -v ~/kirana-backups:/backup alpine tar xzf /backup/media-YYYYMMDD-HHMMSS.tar.gz -C /media
```

**Reset the owner's admin password.** There is no "forgot password" screen. `ADMIN_EMAIL` / `ADMIN_PASSWORD` are used only to create the first admin, so changing them later has no effect on their own. To reset, put the new password (12+ characters) in `.env.prod`, then remove the old admin; the backend recreates it on start:

```bash
nano .env.prod                                   # set ADMIN_PASSWORD (and ADMIN_EMAIL if it changes)
kc exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" kirana -e "DELETE FROM admin_users"'
kc up -d --force-recreate backend                # not "restart": restart does not read the new .env.prod
kc logs backend | grep "Created first admin"     # confirms the new login
```

Orders, products and settings are not affected.

Data lives in Docker volumes (`kirana-prod_mysql-data`, `kirana-prod_media`, `kirana-prod_caddy-data`). Never run `docker compose down -v` or `docker volume prune` on the server: that deletes them.

---

## 13. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Browser can't reach any URL / times out | Ports not open. Check the **security list** ingress rules (section 4) and that `setup-server.sh` ran (`sudo iptables -L INPUT -n \| grep -E "80\|443"`). |
| Certificate error or `ERR_SSL_PROTOCOL_ERROR` | Caddy could not get a certificate: port 80 must be reachable from the internet, and the hostnames must point to this server. See `kc logs web`. |
| `502 Bad Gateway` on the API | The backend is still starting (about 30 s) or crashed: `kc logs backend`. A wrong `DB_PASSWORD` after the first start is a common cause (the database keeps the first password). |
| Admin login shows "Cannot reach the server" | `API_HOST` in `.env.prod` differs from the one the web apps were built with, or CORS: run `deploy.sh` again after changing hosts. |
| Build stops with "Killed" | Out of memory on a small VM: the setup script adds swap; use at least 2 OCPU / 12 GB on Ampere. |
| `failed to copy ... production.cloudfront.docker.com` | Docker Hub downloads failing: set `BASE_REGISTRY=mirror.gcr.io/library` and `MYSQL_IMAGE=container-registry.oracle.com/mysql/community-server:8.4` in `.env.prod`. |
| Customers can't log in | With `OTP_PROVIDER=logging` codes are only in the log; switch to MSG91 (section 11). |
| App says "No connection to the store" | The APK was built with a different API URL, or the server is down. Rebuild the APK with `https://api.<host>`. |
| Oracle "Out of capacity" | See section 3: another availability domain, fewer OCPUs, or retry later. |

---

## 14. Costs

Everything above runs inside Oracle's Always Free allowances (Ampere up to 4 OCPU / 24 GB, 200 GB storage). sslip.io and Let's Encrypt are free. Optional paid items: a domain name (about ₹800-1,000 a year), MSG91 SMS credits, Razorpay transaction fees, and a Google Play developer account (one-time $25) if you publish on the Play Store.
