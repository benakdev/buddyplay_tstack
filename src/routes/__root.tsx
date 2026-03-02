import { useEffect } from 'react';

import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ClerkProvider } from '@clerk/tanstack-react-start';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

import ConvexClientProvider from '@/components/ConvexClientProvider';
import { ThemeProvider, themeScript } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { resolveDeepLink } from '@/lib/native-auth';
import appCss from '@/styles.css?url';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8'
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover'
      },
      {
        title: 'JumpIn | Find Your Match'
      },
      {
        name: 'description',
        content: 'Sports matchmaking app connecting players based on skill level, club, and availability.'
      }
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss
      },
      {
        rel: 'icon',
        href: '/convex.svg'
      }
    ]
  }),
  shellComponent: RootDocument
});

function RootDocument() {
  useEffect(() => {
    if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
      return;
    }

    let removeListener: (() => Promise<void>) | null = null;
    const platform = Capacitor.getPlatform();

    document.documentElement.classList.add('native-app');
    document.body.classList.add('native-app');
    if (platform === 'ios') {
      document.documentElement.classList.add('native-app-ios');
      document.body.classList.add('native-app-ios');
    }
    if (platform === 'android') {
      document.documentElement.classList.add('native-app-android');
      document.body.classList.add('native-app-android');
    }

    const setupStatusBar = async () => {
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: prefersDarkMode ? Style.Light : Style.Dark });
    };

    void setupStatusBar().catch(() => {});

    const setupListener = async () => {
      const listener = await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        // Attempt to close the in-app browser securely
        void Browser.close().catch(() => {});

        // Prevent processing the same link infinitely during handshakes
        const processed = sessionStorage.getItem('clerk_launch_url');
        if (processed === event.url) return;
        sessionStorage.setItem('clerk_launch_url', event.url);

        resolveDeepLink(event.url);
      });

      removeListener = () => listener.remove();
    };

    void setupListener();

    // Handle Cold Starts
    void App.getLaunchUrl().then(launch => {
      if (launch?.url) {
        // Prevent processing the same link infinitely during handshakes
        const processed = sessionStorage.getItem('clerk_launch_url');
        if (processed === launch.url) return;
        sessionStorage.setItem('clerk_launch_url', launch.url);

        resolveDeepLink(launch.url);
      }
    });

    return () => {
      document.documentElement.classList.remove('native-app');
      document.body.classList.remove('native-app');
      document.documentElement.classList.remove('native-app-ios');
      document.body.classList.remove('native-app-ios');
      document.documentElement.classList.remove('native-app-android');
      document.body.classList.remove('native-app-android');

      if (removeListener) {
        void removeListener();
      }
    };
  }, []);

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            afterSignOutUrl={import.meta.env.VITE_CLERK_AFTER_SIGN_OUT_URL ?? '/'}
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
          >
            <ConvexClientProvider>
              <Outlet />
              <Toaster />
            </ConvexClientProvider>
          </ClerkProvider>
        </ThemeProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right'
          }}
          plugins={[
            {
              name: 'TanStack Router',
              render: <TanStackRouterDevtoolsPanel />
            }
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
