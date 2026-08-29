# Hosting Delight Banking on Vercel

The GitHub repo is already connected, so use the Vercel dashboard:

1. Import or open the `Delight-Banking` project in Vercel.
2. Framework Preset: `Vite`.
3. Build Command: `npm run build`.
4. Output Directory: `docs`.
5. Install Command: `npm install`.
6. Node.js Version: `20.x` or newer.

## Environment Variables

The app uses Vercel serverless functions for secure Cashfree payments. Add these variables in Vercel Project Settings -> Environment Variables:

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

## Firebase

In Firebase Console:

1. Enable Authentication providers you use, including Google.
2. Add `delightbanking.vercel.app` in Authentication -> Settings -> Authorized domains.
3. Create Firestore Database.
4. Publish `firestore.rules` from this repo if you want the same client-side admin/resource rules.
5. Create a Firebase Admin service account and put its email/private key into Vercel env vars.

## Cashfree Sandbox

Use sandbox mode first. Configure webhook URL:

```text
https://delightbanking.vercel.app/api/payments/webhook
```

The server verifies webhook signatures with `CASHFREE_CLIENT_SECRET` and also checks final order status with Cashfree before activating access.

## Deploy

Push to `main`. Vercel will rebuild automatically. GitHub Pages is still supported for the static frontend build, but secure payment APIs require Vercel.
