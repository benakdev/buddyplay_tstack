import { Browser } from '@capacitor/browser';

export const OAUTH_REDIRECT_URL = 'https://flowing-cub-56.clerk.accounts.dev/mobile-callback';

const NATIVE_CALLBACK_PATH_PREFIX = '/mobile-callback';
const NATIVE_CALLBACK_HOST = 'flowing-cub-56.clerk.accounts.dev';

let pendingDeepLinkUrl: string | null = null;
let deepLinkResolver: ((url: string) => void) | null = null;
let deepLinkRejecter: ((error: Error) => void) | null = null;
let deepLinkTimeoutId: ReturnType<typeof setTimeout> | null = null;

interface NativeSignInResource {
  create(params: { strategy: 'oauth_google'; redirectUrl: string }): Promise<{
    firstFactorVerification?: {
      externalVerificationRedirectURL?: string | URL | null;
    } | null;
  }>;
  reload(): Promise<unknown>;
  status?: string | null;
  createdSessionId?: string | null;
}

interface SetActiveParams {
  session: string | null;
}

type SetActiveFn = (params: SetActiveParams) => Promise<unknown>;

function clearDeepLinkWaitState() {
  if (deepLinkTimeoutId) {
    clearTimeout(deepLinkTimeoutId);
  }

  deepLinkTimeoutId = null;
  deepLinkResolver = null;
  deepLinkRejecter = null;
}

function isNativeOAuthCallbackUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    return (
      url.protocol === 'https:' &&
      url.host === NATIVE_CALLBACK_HOST &&
      url.pathname.startsWith(NATIVE_CALLBACK_PATH_PREFIX)
    );
  } catch {
    return false;
  }
}

function waitForDeepLink(timeoutMs = 5 * 60 * 1000): Promise<string> {
  if (pendingDeepLinkUrl) {
    const deepLinkUrl = pendingDeepLinkUrl;
    pendingDeepLinkUrl = null;
    return Promise.resolve(deepLinkUrl);
  }

  return new Promise((resolve, reject) => {
    deepLinkResolver = (url: string) => {
      clearDeepLinkWaitState();
      resolve(url);
    };

    deepLinkRejecter = (error: Error) => {
      clearDeepLinkWaitState();
      reject(error);
    };

    deepLinkTimeoutId = setTimeout(() => {
      deepLinkRejecter?.(new Error('Native OAuth callback timed out'));
    }, timeoutMs);
  });
}

async function pollSignInCompletion(signIn: NativeSignInResource): Promise<string> {
  const maxAttempts = 200;
  const pollIntervalMs = 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await signIn.reload();

    if (signIn.status === 'complete' && signIn.createdSessionId) {
      return signIn.createdSessionId;
    }

    await new Promise(resolve => {
      setTimeout(resolve, pollIntervalMs);
    });
  }

  throw new Error('Native OAuth did not complete in time');
}

export function resolveDeepLink(urlString: string) {
  if (!isNativeOAuthCallbackUrl(urlString)) {
    return;
  }

  if (deepLinkResolver) {
    deepLinkResolver(urlString);
    return;
  }

  pendingDeepLinkUrl = urlString;
}

export async function handleNativeGoogleSignIn(signIn: NativeSignInResource, setActive: SetActiveFn): Promise<void> {
  const result = await signIn.create({
    strategy: 'oauth_google',
    redirectUrl: OAUTH_REDIRECT_URL
  });

  const verificationUrl = result.firstFactorVerification?.externalVerificationRedirectURL;

  if (!verificationUrl) {
    throw new Error('No external verification redirect URL returned by Clerk');
  }

  await Browser.open({
    url: verificationUrl.toString()
  });

  try {
    await waitForDeepLink();
    const createdSessionId = await pollSignInCompletion(signIn);

    await setActive({
      session: createdSessionId
    });
  } finally {
    await Browser.close().catch(() => {});
  }
}
