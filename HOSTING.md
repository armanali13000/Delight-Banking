# Delight Banking Hosting Guide

This is a React website built with Vite, so it can be hosted on Firebase
Hosting, Netlify, Vercel, Cloudflare Pages, or any static hosting provider.

## Before hosting

Edit `src/config.js`.

1. Add your Firebase web app config.
2. Enable Firebase Authentication providers:
   - Google
   - Email/password
3. Create Firestore Database in production mode.
4. Add your real admin email in `adminEmails`.
5. Add your payment key in `paymentConfig.key`.
6. Change plans, exam names, and prices in the `plans` array whenever needed.

Important: the included payment flow activates access in demo mode while keys
are placeholders. For a real launch, connect payment success to a trusted
backend or Firebase Cloud Function that verifies the transaction and then writes
the user's active exam access. Do not rely only on browser-side payment success
for production access control.

## Firebase Firestore rules starter

Use these rules for the current admin email. This allows public reading of
resources and admin-only writing when the user's email is in the allowed list.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        request.auth.token.email in ['darkdevil7325@gmail.com'];
    }

    match /resources/{resourceId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
  }
}
```

## Local setup

```bash
npm install
npm run dev
```

On Windows PowerShell, if `npm` is blocked by execution policy, use:

```bash
npm.cmd run dev -- --port 5173
```

Then open:

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/admin
```

Do not double-click the root `index.html` file. React/Vite apps need the dev
server while editing. For a file you can upload or serve in production, run
`npm.cmd run build` and use the generated `dist` folder.

## Firebase Hosting commands

```bash
npm run build
npm install -g firebase-tools
firebase login
firebase deploy
```

The included `firebase.json` deploys the `dist` folder and rewrites `/admin`
to the React app.

## GitHub Pages

For GitHub Pages, the simplest setup is:

```bash
npm.cmd run build
git add .
git commit -m "Build for GitHub Pages"
git push
```

Then set GitHub Pages to:

```text
Source: Deploy from a branch
Branch: main
Folder: /docs
```

The site URL will be:

```text
https://armanali13000.github.io/Delight-Banking/
```

Admin opens at:

```text
https://armanali13000.github.io/Delight-Banking/#admin
```

If the site still shows a white page, open GitHub Pages settings again and make
sure it is not set to `/root`. It must be `/docs`.

## Payment Setup

Add your Razorpay Key ID in `src/config.js`:

```js
export const paymentConfig = {
  key: "rzp_test_xxxxxxxxxx",
  businessName: "Delight Banking",
  description: "Exam access activation"
};
```

Use the Key ID only. Do not put the Key Secret in frontend code.

The current checkout can open the payment window and activate access after a
successful checkout callback. For production, add a small backend or Firebase
Cloud Function to verify the payment before granting access.
