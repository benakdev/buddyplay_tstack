# Auth Flow in This App (`buddyplay_tstack`)

This document explains exactly how authentication currently works in this app, why it works on Android native, and how the web and native paths differ.

---

## 1) High-level architecture

This app uses:

- **Clerk** for authentication/session management
- **TanStack Start + TanStack Router** for app/runtime routing
- **Capacitor (Android)** to wrap the web app as a native app
- **Convex (optional at runtime)** for backend data, authenticated via Clerk token when `VITE_CONVEX_URL` is set

There are two auth execution paths:

1. **Web path**: `authenticateWithRedirect` + route callback at `/sso-callback`
2. **Android native path**: `signIn.create` + external browser + HTTPS deep link callback + `setActive`

---

## 2) Why this native flow is necessary

Google OAuth blocks embedded webviews (`disallowed_useragent`).

So Android native must:

- Start OAuth using Clerk API (`signIn.create`)
- Open provider auth in secure browser context (`@capacitor/browser`)
- Return to app via HTTPS app-link callback
- Poll Clerk for completion and activate session (`setActive`)

This is implemented in `src/lib/native-auth.ts` and wired from landing/root routes.

---

## 3) End-to-end web flow

### Trigger

- File: `src/routes/index.tsx`
- On “Continue with Google” button click (non-native path), app calls:

```ts
await signIn.authenticateWithRedirect({
  strategy: 'oauth_google',
  redirectUrl: '/sso-callback',
  redirectUrlComplete: '/',
});
```

### Callback route

- File: `src/routes/sso-callback.tsx`
- Route renders `AuthenticateWithRedirectCallback`.
- Clerk finalizes the sign-in and session from redirect params.

### Protected app access

- File: `src/routes/_app.tsx`
- Uses `useAuth()`:
  - if not loaded (or Clerk handshake active), waits
  - if not signed in, redirects to `/`
  - if signed in, renders app shell

---

## 4) End-to-end Android native flow

### Step A: start OAuth attempt

- File: `src/routes/index.tsx`
- If `Capacitor.isNativePlatform()` and platform is `android`, app calls:

```ts
await handleNativeGoogleSignIn(signIn, setActive)
```

- File: `src/lib/native-auth.ts`
- `handleNativeGoogleSignIn` runs:

```ts
const result = await signIn.create({
  strategy: 'oauth_google',
  redirectUrl: 'https://flowing-cub-56.clerk.accounts.dev/mobile-callback',
})
```

### Step B: open secure browser

- Same file (`native-auth.ts`)
- Takes Clerk URL from `result.firstFactorVerification.externalVerificationRedirectURL`
- Opens with Capacitor Browser:

```ts
await Browser.open({ url: verificationUrl.toString() })
```

### Step C: deep link back to app

- File: `src/routes/__root.tsx`
- App listens for:
  - `App.addListener('appUrlOpen', ...)`
  - `App.getLaunchUrl()` for cold starts
- Each incoming URL is passed to:

```ts
resolveDeepLink(url)
```

- File: `src/lib/native-auth.ts`
- `resolveDeepLink` accepts only URLs that match:
  - `https://flowing-cub-56.clerk.accounts.dev/mobile-callback...`

### Step D: poll completion + activate session

- In `handleNativeGoogleSignIn`:
  - `waitForDeepLink()` resolves when callback is captured
  - `pollSignInCompletion()` loops `signIn.reload()` until:

```ts
signIn.status === 'complete' && signIn.createdSessionId
```

  - then:

```ts
await setActive({ session: createdSessionId })
```

### Step E: close browser

- `Browser.close()` is called in `finally`

---

## 5) Capacitor + Android config that makes it work

### Capacitor server config

- File: `capacitor.config.ts`
- Uses:
  - `androidScheme: 'https'`
  - `hostname: 'localhost'`
  - auth domain allowlist in `allowNavigation`

### Android app-link intent filter

- File: `android/app/src/main/AndroidManifest.xml`
- Main activity is `singleTask`
- Includes `android:autoVerify="true"` intent filter for:
  - scheme: `https`
  - host: `flowing-cub-56.clerk.accounts.dev`
  - `pathPrefix`: `/mobile-callback`

This allows Android to open this app directly when Clerk redirects to `/mobile-callback`.

---

## 6) Clerk provider/runtime wiring

### Root provider

- File: `src/routes/__root.tsx`
- `ClerkProvider` is configured with:
  - `publishableKey`
  - `afterSignOutUrl`
  - `signInFallbackRedirectUrl="/"`
  - `signUpFallbackRedirectUrl="/"`

### Server middleware

- File: `src/start.ts`
- Uses `clerkMiddleware()` so server-side requests have Clerk context.

---

## 7) Convex integration behavior

- File: `src/components/ConvexClientProvider.tsx`
- If `VITE_CONVEX_URL` is present:
  - creates `ConvexReactClient`
  - wraps app with `ConvexProviderWithClerk` using Clerk `useAuth`
- If `VITE_CONVEX_URL` is missing:
  - provider is skipped, app still authenticates with Clerk only

So auth works with or without Convex enabled.

---

## 8) Environment variables used

Minimum Clerk variables:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_JWT_ISSUER_DOMAIN=https://flowing-cub-56.clerk.accounts.dev
VITE_CLERK_AFTER_SIGN_OUT_URL=/
```

Optional Convex variable:

```bash
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

---

## 9) Sanity checklist

- `pnpm build` succeeds
- `pnpm run cap:sync` succeeds
- Android sign-in opens external browser (not embedded)
- OAuth returns into app via `/mobile-callback`
- User is signed in without redirect loop
- Protected routes under `/_app` are accessible after auth

---

## 10) Common failures and meaning

- **`disallowed_useragent`**
  - OAuth started in embedded webview path; ensure native path uses `Browser.open`
- **No sign-in after return**
  - callback URL not captured or polling timed out
- **Deep link not opening app**
  - manifest intent filter mismatch or app-link verification/dashboard mismatch
- **Convex auth errors**
  - invalid/missing `VITE_CONVEX_URL` or Clerk/Convex JWT mismatch
