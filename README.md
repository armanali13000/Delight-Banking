# Delight Banking

React + Vite frontend with Vercel serverless APIs for Firebase-authenticated Razorpay payments.

## Run Locally

```bash
npm install
npm run dev
```

## Secure Payment Flow

Plans are stored centrally in `data/plans.json`. The frontend displays plan data, but the Vercel backend is the trusted source for amount, currency, validity, order creation, payment verification, webhook recovery, and subscription activation.

API endpoints:

```text
POST /api/payments/create-order
POST /api/payments/verify
POST /api/payments/webhook
GET /api/payments/order/:orderId
GET /api/users/me/payments
```

Firestore collections used:

```text
plans
planVariants
orders
payments
subscriptions
razorpayWebhookEvents
students
resources
```

Seed public plan collections after Firebase Admin env vars are set:

```bash
npm run seed:plans
```

## Required Vercel Environment Variables

Copy `.env.example` into Vercel Project Settings -> Environment Variables. Keep non-`VITE_` values server-only.

## Razorpay Test Mode

Use test keys first. Configure webhook URL:

```text
https://delightbanking.vercel.app/api/payments/webhook
```

Subscribe to `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, and `refund.processed`.

## Deploy

```bash
npm run build
```

Vercel uses `vercel.json` and outputs `dist`.

GitHub Pages can still be deployed with:

```bash
npm run deploy
```

Secure Razorpay APIs require Vercel.
