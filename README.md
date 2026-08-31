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


## Admin Panel Phase 1

Phase 1 adds the secure admin foundation without changing public website, student dashboard or Cashfree checkout behavior.

Implemented roles:

```text
super_admin
admin
support
content_manager
```

Primary authorization uses Firebase custom claims plus the Firestore `adminUsers/{firebaseUid}` record. The required custom claims are:

```json
{ "admin": true, "adminRole": "super_admin" }
```

Admin Firestore collections:

```text
adminUsers
adminActivityLogs
```

Admin API routes:

```text
GET /api/admin/me
PATCH /api/admin/profile
GET /api/admin/activity-logs
```

First super-admin bootstrap:

```bash
BOOTSTRAP_ADMIN_UID=the_firebase_uid CONFIRM_BOOTSTRAP_SUPER_ADMIN=yes npm run admin:bootstrap
```

The bootstrap script is local/admin-only. It does not create public credentials, does not accept arbitrary roles, and never prints secrets. After running it, sign out and sign in again so Firebase issues a fresh ID token with the new custom claims.

Admin login:

```text
/admin/login
```

Protected Phase 1 admin routes:

```text
/admin
/admin/profile
/admin/activity-logs
/admin/access-denied
```

Firestore rules block browser reads/writes to `adminUsers` and `adminActivityLogs`; trusted changes go through Firebase Admin server APIs. Phase 2 will add real analytics, user management, subscriptions, payments, plans, reports and operational workflows.

Cashfree regression note: payment routes and environment variable names were not changed in this admin phase. Re-test sandbox checkout and webhook after Vercel deploy.

## Administrator Management Phase 1.5

Administrator management is available only to an active `super_admin` through protected server APIs. There is no public admin signup and no default administrator password flow. A future administrator must first create a normal Delight Banking Firebase account and verify their email.

Supported roles:

```text
super_admin
admin
support
content_manager
```

Only the bootstrapped `super_admin` can manage administrator access. The admin panel does not allow assigning another `super_admin` in Phase 1.5.

Permission summary:

```text
super_admin: all admin permissions, including admins.manage, admin.activity_logs.view, security.settings.manage
admin: users, subscriptions, payments, plans, resources, support and reports foundations
support: limited user, subscription, payment and support foundations
content_manager: plans, resources, targets and classes foundations
```

Promoting an existing user:

1. The target user creates a normal Delight Banking account.
2. The target user verifies their email.
3. The super-admin opens `/admin/administrators`.
4. The super-admin searches the exact email address.
5. The server uses Firebase Admin to find the user and checks verified email, disabled status and existing admin status.
6. The super-admin chooses `admin`, `support`, or `content_manager`.
7. The super-admin types `ADD ADMIN`.
8. The server applies Firebase custom claims, writes `adminUsers/{firebaseUid}`, revokes refresh tokens and creates an activity log.
9. The promoted user signs out and signs in again to receive fresh claims.

Sensitive actions require recent super-admin authentication. If the session is too old, sign out and sign in again before retrying the action. This protects promotion, role changes, suspension, reactivation and revocation.

Suspension temporarily removes administrative access and keeps the normal student account intact. Revocation removes administrative access permanently for audit purposes while preserving the Firebase user and student/payment/subscription history. Revoked `adminUsers` records are retained and are not deleted.

Custom-claim behavior:

```json
{ "admin": true, "adminRole": "admin" }
{ "admin": true, "adminRole": "support" }
{ "admin": true, "adminRole": "content_manager" }
```

Server code preserves unrelated legitimate custom claims and never accepts arbitrary claim names from the browser. Suspension and revocation remove only the admin-related claims and revoke refresh tokens.

Activity logs are append-only from trusted server APIs and include safe fields such as acting admin, action, target admin, previous/new role, previous/new status and reason. Logs never include passwords, tokens, private keys, Cashfree secrets or complete auth objects.

Administrator management APIs:

```text
GET    /api/admin/administrators
GET    /api/admin/administrators/[uid]
GET    /api/admin/users/search?email=exact@example.com
POST   /api/admin/administrators/promote
PATCH  /api/admin/administrators/[uid]
POST   /api/admin/administrators/[uid]/suspend
POST   /api/admin/administrators/[uid]/reactivate
POST   /api/admin/administrators/[uid]/revoke
```

Troubleshooting:

```text
Login required: sign in with Firebase first.
This account does not have administrative access: custom claims or adminUsers record are missing/inactive.
Please sign in again: recent-authentication window expired.
Only verified email accounts can be promoted: ask the target user to verify email first.
This user is already an active administrator: use role change, suspension or revocation instead.
```

Testing checklist:

```bash
npm install
npm run build
```

Also verify that normal admins, support users, content managers, students and logged-out visitors cannot call the administrator-management APIs, and that Cashfree checkout/webhook and student subscription activation remain unchanged.
