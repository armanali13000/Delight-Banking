# Hosting Delight Banking on Vercel

Use the existing GitHub-connected Vercel project.

1. Framework Preset: `Vite`.
2. Build Command: `npm run build`.
3. Output Directory: `dist` on Vercel. Local GitHub Pages builds still write `docs` because `vite.config.js` switches by the `VERCEL` environment flag.
4. Install Command: `npm install`.
5. Node.js Version: `20.x` or newer.

## Environment Variables

```text
CASHFREE_CLIENT_ID
CASHFREE_CLIENT_SECRET
CASHFREE_ENVIRONMENT=sandbox
CASHFREE_API_VERSION=2025-01-01
APP_BASE_URL=https://www.delightguidance.com
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY_BASE64
FIREBASE_PRIVATE_KEY (fallback)
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

Do not add Cashfree secrets as `VITE_` variables. Do not commit real credentials.

## Firebase

1. Enable Authentication providers, including Google.
2. Add `www.delightguidance.com` and any Vercel preview domain you use in Authentication -> Settings -> Authorized domains.
3. Create Firestore Database.
4. Publish `firestore.rules`.
5. Create a Firebase Admin service account and add its email/private key in Vercel.

## Cashfree

Start in sandbox mode. Configure webhook URL:

```text
https://www.delightguidance.com/api/payments/webhook
```

Expected return URL format:

```text
https://www.delightguidance.com/payment/status?order_id={order_id}
```

Enable payment success, failed and user-dropped webhook events. Refund and dispute events can be enabled for future admin handling.

## Deploy

Push to `main`. Vercel rebuilds automatically. Switch to production Cashfree credentials only after sandbox payment testing passes.


## Production Domain and Sitemap

Production payments must use these server-only Vercel values:

```text
CASHFREE_ENVIRONMENT=production
CASHFREE_API_VERSION=2025-01-01
APP_BASE_URL=https://www.delightguidance.com
```

The server rejects production payment-order creation unless `APP_BASE_URL` is exactly `https://www.delightguidance.com`. Return and webhook URLs are generated server-side from that value.

Submit this sitemap in Google Search Console after the Vercel production deployment is live:

```text
https://www.delightguidance.com/sitemap.xml
```

Do not place private routes, checkout routes, payment-status routes, admin routes or API routes in the sitemap.

## Phase 3 Admin Data and Indexes

Phase 3 admin operations use server-side Firebase Admin SDK reads and bounded pagination from these collections:

```text
students
subscriptions
orders
payments
adminActivityLogs
adminNotes
webhookEvents
```

Current Phase 3 list screens use bounded reads plus server-side filtering to avoid sending the full database to the browser. No new composite Firestore indexes are required for the current deployment path. If the data set grows beyond the bounded operational limits, replace the bounded reads with cursor queries and add composite indexes for these future query shapes:

```text
subscriptions: userId ASC, variantId ASC, status ASC
subscriptions: userId ASC, status ASC, accessEndAt DESC
orders: userId ASC, createdAt DESC
orders: paymentStatus ASC, createdAt DESC
payments: userId ASC, createdAt DESC
payments: status ASC, createdAt DESC
adminNotes: entityType ASC, entityId ASC, createdAt DESC
adminActivityLogs: entityType ASC, entityId ASC, createdAt DESC
```

Do not create indexes containing secrets, raw gateway payloads, Firebase tokens or credential fields.