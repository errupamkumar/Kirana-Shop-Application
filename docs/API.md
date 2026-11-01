# API

Base path `/api/v1`. Interactive docs in dev: http://localhost:8080/swagger-ui (OpenAPI JSON at `/v3/api-docs`; both are off in the `prod` profile).

- Auth: `Authorization: Bearer <accessToken>`. Access tokens last 15 minutes; refresh tokens 30 days and rotate on every refresh.
- Money is a JSON number with two decimals, INR. Timestamps are ISO-8601 UTC. Pages are `{content, page, size, totalElements, totalPages}` with `page` from 0 and `size` ≤ 100 (default 20).
- Errors always look like `{ "code": "OUT_OF_RADIUS", "message": "...", "details": {...} }`.

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Bad body or params; `details` maps field → message |
| `OTP_INVALID` | 400 | Wrong, used or expired OTP (`details.attemptsLeft`) |
| `PAYMENT_VERIFICATION_FAILED` | 400 | Razorpay signature mismatch |
| `UNAUTHORIZED` | 401 | Missing/expired token, bad login, refresh rejected |
| `FORBIDDEN` | 403 | Wrong role |
| `NOT_FOUND` | 404 | Unknown id, or not yours |
| `OUT_OF_STOCK`, `PRICE_CHANGED`, `INVALID_STATUS_TRANSITION` | 409 | See below |
| `OUT_OF_RADIUS`, `BELOW_MIN_ORDER`, `STORE_CLOSED`, `PAYMENT_METHOD_DISABLED`, `VARIANT_INACTIVE` | 422 | Store rules |
| `OTP_RATE_LIMITED` | 429 | Resend within 30 s, > 5 sends/hour, or 5 wrong attempts (`details.retryAfterSeconds`) |
| `PAYMENT_GATEWAY_ERROR` | 502 | Razorpay unreachable |
| `INTERNAL_ERROR` | 500 | Unexpected |

## Auth

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/app/auth/otp/send` | public | `{phone}` (10 digits or +91…) → `{phone, expiresInSeconds, resendAfterSeconds}` |
| POST | `/app/auth/otp/verify` | public | `{phone, otp}` → `{accessToken, refreshToken, expiresIn, tokenType, user:{id,phone,name}, newUser}` |
| POST | `/admin/auth/login` | public | `{email, password}` → `{accessToken, refreshToken, expiresIn, tokenType, admin:{id,email,name,role}}` |
| POST | `/auth/refresh` | public | `{refreshToken}` → `{accessToken, refreshToken, expiresIn, tokenType}` |
| POST | `/auth/logout` | public | `{refreshToken}` → 204 |

## Customer app (`/app/**`, role CUSTOMER unless public)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/app/config` | public | Store rules for display: radius, lat/lng, min order, fee, free-delivery threshold, `allowedPaymentMethods`, `gatewayKeyId` (only when online is usable), store open + message. Never a secret. |
| POST | `/app/location/check` | public | `{lat, lng}` → `{serviceable, distanceKm, radiusKm}` |
| GET | `/app/catalog` | public | Active categories + up to 8 products per category |
| GET | `/app/products?categoryId&q&page&size` | public | Active products with active variants; `inStock` flag, never stock numbers |
| GET | `/app/products/{id}` | public | One listed product |
| GET / PUT | `/app/me` | customer | `{id, phone, name}`; PUT `{name}` |
| GET / POST | `/app/addresses` | customer | Body `{label, line1, line2?, landmark?, pincode, lat, lng, isDefault?}`; max 10; first is default |
| PUT / DELETE | `/app/addresses/{id}` | customer | Only your own |
| POST | `/app/cart/validate` | customer | `{items:[{variantId, qty}], addressId? \| lat,lng, paymentMethod?}` → `CartQuote` (below). Never errors for business rules. |
| POST | `/app/orders` | customer | Header `Idempotency-Key` (1-100 chars). `{items, addressId, paymentMethod, expectedTotal, note?}` → 201 `OrderDetail`; 200 with the same order when the key was used before. |
| GET | `/app/orders/my?page&size` | customer | Newest first |
| GET | `/app/orders/{id}` | customer | `OrderDetail` with `history` and `canCancel` |
| POST | `/app/orders/{id}/cancel` | customer | `{reason?}`; while `PLACED` or `ACCEPTED` (until the store packs it) |
| POST | `/app/order-requests` | customer | Multipart: `addressId`, `image?` (JPG/PNG/WebP ≤ 5 MB), `audio?` (M4A/WebM/Ogg/MP3/WAV/AAC ≤ 5 MB), `audioSeconds?`, `note?` (≤ 500). At least a photo or a voice note; the address must be inside the delivery area and the store open; at most 3 waiting requests per customer (429 `TOO_MANY_ATTEMPTS`). → 201 `RequestDto` |
| GET | `/app/order-requests/my?page&size` | customer | Newest first |
| GET | `/app/order-requests/{id}` | customer | `RequestDto`: `status` (`PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`), signed `imageUrl` / `audioUrl`, `address`, `orderId`, `orderNumber`, `orderStatus`, `orderTotal`, `rejectReason` |
| POST | `/app/order-requests/{id}/cancel` | customer | Only while `PENDING` |
| POST | `/app/payments/razorpay/verify` | customer | `{orderId, razorpayOrderId, razorpayPaymentId, signature}` → `OrderDetail` (`PLACED` / `PAID`) |
| POST | `/webhooks/razorpay` | signature | Header `X-Razorpay-Signature` = HMAC-SHA256(body, `RAZORPAY_WEBHOOK_SECRET`). Handles `payment.captured` and `order.paid`; idempotent. |

**CartQuote**: `lines[{variantId, productId, productName, variantLabel, imageUrl, mrp, sellingPrice, qty, lineTotal, issue: null|OUT_OF_STOCK|VARIANT_INACTIVE}]`, `itemSubtotal`, `deliveryFee`, `total`, `minOrderAmount`, `amountToMinOrder`, `freeDeliveryAbove`, `amountToFreeDelivery`, `serviceable` (null without a location), `distanceKm`, `radiusKm`, `allowedPaymentMethods`, `paymentMethod`, `storeOpen`, `storeClosedMessage`, `violations[{code, message, variantIds}]`, `canPlaceOrder`.

**Placing an order** recomputes the quote on the server. The first violation becomes the error (`details.violations`, `details.quote`). If `expectedTotal` differs from the server total: 409 `PRICE_CHANGED` with `details.quote`. Stock is decremented with conditional updates; a miss returns 409 `OUT_OF_STOCK` with `details.variantIds` and nothing is changed. COD orders start `PLACED` (`COD_PENDING`) and the store accepts them before packing; online orders start `PENDING_PAYMENT` with `payment:{gateway, gatewayOrderId, keyId, amountPaise, currency, status}` for Razorpay checkout and expire after 15 minutes.

**OrderDetail**: `id, orderNumber, status, paymentMethod, paymentStatus, itemSubtotal, deliveryFee, total, distanceKm, customerNote, cancelReason, placedAt, deliveredAt, address{label,name,phone,line1,line2,landmark,pincode,lat,lng}, items[...], history[{fromStatus,toStatus,changedByType,note,createdAt}], canCancel, allowedNextStatuses, payment`.

## Admin (`/admin/**`, role ADMIN or STAFF; settings ADMIN only)

| Method | Path | Notes |
|---|---|---|
| GET / PUT | `/admin/settings` | ADMIN only. GET returns `gatewaySecretSet`, never the secret. PUT takes every field plus write-only `gatewaySecret` (blank keeps the stored one). Rules: radius 0.5-20, at least one payment method, online needs key id + secret. |
| GET / POST | `/admin/categories` | `{name, nameHi?, slug?, imageUrl?, sortOrder, active}`; list includes `productCount` |
| PUT / DELETE | `/admin/categories/{id}` | DELETE → `{deleted, deactivated}`: soft-deactivates when it has products |
| GET | `/admin/products?q&categoryId&active&page&size` | Products with nested variants (incl. `stockQty`) |
| GET / PUT | `/admin/products/{id}` | PUT `{categoryId, name, nameHi?, description?, brand?, imageUrl?, active, variants:[{id?, label, sku, mrp, sellingPrice, stockQty, active, sortOrder?}]}`: variants with `id` are updated, without are created, missing ones are removed |
| POST | `/admin/products` | Same body; 201 |
| PATCH | `/admin/products/{id}/active` | `{active}` |
| PATCH | `/admin/variants/{id}` | Any of `{stockQty, mrp, sellingPrice, active}` |
| POST | `/admin/uploads/image` | multipart `file` (jpg/png/webp by content, ≤ 2 MB) → 201 `{url: "/media/images/<uuid>.<ext>"}` served at `GET /media/**` |
| GET | `/admin/orders?status&from&to&q&page&size` | `from`/`to` are inclusive `yyyy-MM-dd` (India time); `q` matches order number or phone |
| GET | `/admin/orders/{id}` | `OrderDetail` with `allowedNextStatuses` |
| PATCH | `/admin/orders/{id}/status` | `{status, note?}`; `note` (reason) required for `CANCELLED` |
| GET | `/admin/orders/{id}/invoice` | `{store:{name,address,phone,gstin}, order, generatedAt}` |
| GET | `/admin/dashboard` | `todayOrders`, `todayRevenue` (delivered today), `countsByStatus`, `pendingOrders`, `lowStockThreshold`, `lowStock[]`, `last7Days[{date, orders, revenue}]`, `pendingRequests` |
| GET | `/admin/order-requests?status&page&size` | List photos / voice notes, newest first; `AdminRequestDto` adds `customerName`, `customerPhone`, `distanceKm` |
| GET | `/admin/order-requests/counts` | `{pending}` |
| GET | `/admin/order-requests/{id}` | One request |
| POST | `/admin/order-requests/{id}/accept` | `{items:[{variantId, qty}], customItems:[{name, label?, price, qty}], note?}`; at least one line. Creates the order (status `ACCEPTED`, cash on delivery, today's prices, stock taken for catalog lines, delivery fee by the store rules, no minimum order) and links it (`order.requestId`). 409 when the request is no longer `PENDING`; 409 `OUT_OF_STOCK` / 422 `VARIANT_INACTIVE` with `details.variantIds` |
| POST | `/admin/order-requests/{id}/reject` | `{reason}`; the customer sees it |

## Order status machine

```
PENDING_PAYMENT  -> PLACED (system: payment verified) | CANCELLED (system: expired/failed; admin)
PLACED           -> ACCEPTED (admin) | CANCELLED (customer or admin)
ACCEPTED         -> PACKED (admin) | CANCELLED (customer or admin)
PACKED           -> OUT_FOR_DELIVERY (admin: dispatch) | CANCELLED (admin)
OUT_FOR_DELIVERY -> DELIVERED (admin; COD becomes COD_COLLECTED) | CANCELLED (admin)
DELIVERED, CANCELLED: terminal
```

Orders built from a list request start at `ACCEPTED` (history: `PLACED` by the customer at request time, then `ACCEPTED` by the store). Every change writes `order_status_history`; cancelling restores stock. Anything else is 409 `INVALID_STATUS_TRANSITION` with `details.allowed`.

## Public, non-API

| Path | Notes |
|---|---|
| `GET /actuator/health` | `{"status":"UP"}`; liveness/readiness probes in `prod` |
| `GET /media/images/**` | Catalog images (public) |
| `GET /api/v1/media/private/{name}?exp&sig` | Request photos and voice notes, behind HMAC-signed links that expire after 6 hours (Range requests work for audio). Files live in `MEDIA_DIR/requests`, which `/media` does not serve |

Catalog responses carry an optional `nameHi` for categories and products (search matches it too); order lines carry `productNameHi`. The apps show it when the user picks Hindi.
