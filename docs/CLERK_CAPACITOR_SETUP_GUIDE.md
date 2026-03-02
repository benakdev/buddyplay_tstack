# Clerk + Capacitor Native Auth Setup Guide

This guide explains how to set up Clerk auth so it works reliably in native apps (Android), and how to integrate it:

1. **Without Convex** (Clerk-only)
2. **With Convex** (Clerk + Convex token auth)

It is framework-agnostic, with examples aligned to TanStack Start style.

---

## 1) Core concept

For native Android OAuth, do **not** rely on embedded webview redirect flows.

Use this pattern:

1. `signIn.create({ strategy: 'oauth_google', redirectUrl: <https callback> })`
2. Open Clerk verification URL in external browser (`@capacitor/browser`)
3. Receive app callback through Android HTTPS app-link (`/mobile-callback`)
4. Poll `signIn.reload()` until complete
5. `setActive({ session: createdSessionId })`

Keep web flow separate (`authenticateWithRedirect` + web callback route).

---

## 2) Prerequisites

- Clerk app and keys
- Capacitor Android project (`@capacitor/core`, `@capacitor/android`)
- Browser plugin (`@capacitor/browser`)
- Optional app URL events (`@capacitor/app`)
- Google OAuth enabled in Clerk

Install (if missing):

```bash
pnpm add @clerk/tanstack-react-start @capacitor/core @capacitor/android @capacitor/browser @capacitor/app
```

---

## 3) Clerk dashboard setup

In Clerk dashboard:

1. Enable Google OAuth connection
2. Create Android native application entry
   - package id must match app (example: `com.buddyplay.app`)
   - set SHA-256 cert fingerprint(s)
3. Allow your native callback URL(s)

Recommended native callback:

```text
https://<your-clerk-domain>.clerk.accounts.dev/mobile-callback
```

---

## 4) Capacitor + Android configuration

### `capacitor.config.ts`

Use secure localhost origin and allow auth domains:

```ts
server: {
  androidScheme: 'https',
  hostname: 'localhost',
  allowNavigation: [
    '*.clerk.accounts.dev',
    '*.clerk.com',
    '*.accounts.dev',
    '*.google.com',
    '*.googleapis.com',
    'accounts.google.com',
  ],
}
```

### `AndroidManifest.xml`

In your `MainActivity`:

- set `android:launchMode="singleTask"`
- add app-link intent filter:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data
    android:scheme="https"
    android:host="<your-clerk-domain>.clerk.accounts.dev"
    android:pathPrefix="/mobile-callback" />
</intent-filter>
```

---

## 5) Web callback route

Create a normal web callback route:

```tsx
import { AuthenticateWithRedirectCallback } from '@clerk/tanstack-react-start'

export default function SsoCallback() {
  return <AuthenticateWithRedirectCallback />
}
```

Use this route only for web redirect completion.

---

## 6) Native helper implementation

Create helper (example `src/lib/native-auth.ts`) that:

- starts `signIn.create`
- opens `Browser.open`
- waits for callback URL signal
- polls `signIn.reload`
- calls `setActive`

Skeleton:

```ts
const OAUTH_REDIRECT_URL = 'https://<your-clerk-domain>.clerk.accounts.dev/mobile-callback'

export async function handleNativeGoogleSignIn(signIn, setActive) {
  const result = await signIn.create({
    strategy: 'oauth_google',
    redirectUrl: OAUTH_REDIRECT_URL,
  })

  const verificationUrl = result.firstFactorVerification?.externalVerificationRedirectURL
  if (!verificationUrl) throw new Error('No verification URL')

  await Browser.open({ url: verificationUrl.toString() })

  try {
    await waitForDeepLink()
    const sessionId = await pollUntilComplete(signIn)
    await setActive({ session: sessionId })
  } finally {
    await Browser.close().catch(() => {})
  }
}
```

---

## 7) Deep-link listener wiring

In root/bootstrap code:

- listen for `App.addListener('appUrlOpen', ...)`
- check `App.getLaunchUrl()` for cold start
- pass incoming URL to native helper resolver

This decouples URL capture from sign-in button UI and supports resume-from-background.

---

## 8) Sign-in button logic (split web/native)

In sign-in UI:

```ts
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
  await handleNativeGoogleSignIn(signIn, setActive)
} else {
  await signIn.authenticateWithRedirect({
    strategy: 'oauth_google',
    redirectUrl: '/sso-callback',
    redirectUrlComplete: '/',
  })
}
```

---

## 9) Environment variables

### Clerk-only

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_JWT_ISSUER_DOMAIN=https://<your-clerk-domain>.clerk.accounts.dev
VITE_CLERK_AFTER_SIGN_OUT_URL=/
```

### Clerk + Convex (add)

```bash
VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
```

---

## 10) Setup variant A: Clerk without Convex

Use only `ClerkProvider` + app auth hooks.

- No `ConvexProviderWithClerk`
- Session/auth state comes from Clerk directly
- Protect routes/components with Clerk `useAuth`

This is simplest if your backend is not Convex.

---

## 11) Setup variant B: Clerk with Convex

Wrap your app in `ConvexProviderWithClerk`:

```tsx
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useAuth } from '@clerk/tanstack-react-start'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
  {children}
</ConvexProviderWithClerk>
```

Also add Clerk server middleware in app startup for server request context.

---

## 12) Verification commands

```bash
pnpm build
pnpm run cap:sync
pnpm run cap:run:android
```

Manual verification:

1. Tap sign-in in native app
2. Browser opens externally
3. Complete Google login
4. App opens from app-link callback
5. Session active in app (protected routes accessible)

---

## 13) Troubleshooting

### `disallowed_useragent`

Cause: OAuth executed in embedded webview path.

Fix: ensure Android native path always uses external browser (`Browser.open`) and not embedded flow.

### `invalid_url_scheme`

Cause: invalid `redirectUrl` to `signIn.create`.

Fix: use an HTTPS callback URL for native create flow.

### Deep-link opens browser page, not app

Cause: manifest app-link mismatch, verification mismatch, or dashboard package/SHA mismatch.

Fix:

- verify `host` + `pathPrefix` in manifest
- verify package name and SHA-256 in Clerk dashboard
- verify Android “Open supported links” for app

### Browser closes but user remains signed out

Cause: no callback capture or no completed session from poll.

Fix:

- verify deep-link listener runs on `appUrlOpen` and cold start
- verify `signIn.reload()` loop and timeout settings
- verify `setActive({ session })` receives non-null session id
