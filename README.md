# Delight Banking

React + Vite frontend with Vercel serverless APIs for Firebase-authenticated Cashfree payments.

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
APP_BASE_URL=https://delightbanking.vercel.app
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
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
cashfreeWebhookEvents
resources
students
```

## Cashfree Setup

Use sandbox mode first. In Cashfree, configure the webhook URL:

```text
https://delightbanking.vercel.app/api/payments/webhook
```

The checkout return URL is created by the server as:

```text
https://delightbanking.vercel.app/payment/status?order_id={order_id}
```

After a student returns from checkout, the app asks the server to verify the order status with Cashfree before activating subscription access.
