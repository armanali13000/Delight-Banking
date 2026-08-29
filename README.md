# Delight Banking

React + Vite frontend with Vercel serverless APIs for Firebase-authenticated Cashfree Hosted Web Checkout payments.

## Local Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Production Build

```bash
npm run build
```

The build output is copied to `docs/` for GitHub Pages compatibility, but payment APIs require Vercel serverless functions.

## Vercel Environment Variables

Add these in Vercel Project Settings -> Environment Variables:

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

Only `VITE_` variables are exposed to the browser. Never commit live Cashfree secrets or Firebase Admin private keys.

## Firestore Collections

```text
orders
payments
subscriptions
webhookEvents
resources
students
```

Students can read only their own orders, payments and subscriptions. Payment writes and subscription activation are performed by Firebase Admin in Vercel functions.

## Cashfree Sandbox Testing

Keep `CASHFREE_ENVIRONMENT=sandbox` until sandbox success, failure, pending and user-dropped flows have been verified.

Configure webhook URL:

```text
https://www.delightguidance.com/api/payments/webhook
```

The server creates return URLs as:

```text
https://www.delightguidance.com/payment/status?order_id={order_id}
```

Required webhook events:

```text
PAYMENT_SUCCESS_WEBHOOK
PAYMENT_FAILED_WEBHOOK
PAYMENT_USER_DROPPED_WEBHOOK
refund events if enabled
dispute events if enabled
```

After a student returns from checkout, the app calls a secure backend verification route and polls pending orders for a limited time. The frontend never activates access by itself.

## Production Switch

After sandbox testing passes, set `CASHFREE_ENVIRONMENT=production`, replace the Cashfree client ID/secret with production credentials, keep `APP_BASE_URL=https://www.delightguidance.com`, and redeploy from Vercel.

