# Delight Banking Hosting Guide

## Local setup

```bash
npm install
npm run dev
```

## Vercel

The app uses Vercel serverless functions for secure Razorpay payments. Add these variables in Vercel Project Settings -> Environment Variables:

```text
VITE_RAZORPAY_KEY_ID
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
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
APP_BASE_URL
```

Only `VITE_` variables are exposed to the browser. Never commit live Razorpay secrets or Firebase Admin private keys.

Build settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

## Razorpay Test Mode

Use Razorpay Test Mode first. Configure the webhook URL:

```text
https://delightbanking.vercel.app/api/payments/webhook
```

Subscribe to `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, and `refund.processed`.

## Firebase

Deploy `firestore.rules` before enabling production payments. Students can read only their own orders, payments, and subscriptions. Serverless backend code is the only writer for paid access.

## GitHub Pages

GitHub Pages is still supported for the static frontend build, but secure Razorpay server APIs require Vercel.

```bash
npm run deploy
```
