import { useState } from 'react';

import { Capacitor } from '@capacitor/core';
import { useAuth, useSignIn } from '@clerk/tanstack-react-start';
import { Navigate, createFileRoute } from '@tanstack/react-router';
import { Heart } from 'lucide-react';
import { motion } from 'motion/react';

import { handleNativeGoogleSignIn } from '@/lib/native-auth';

export const Route = createFileRoute('/')({
  component: LandingPage
});

function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn, setActive } = useSignIn();
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const isNativePlatform = Capacitor.isNativePlatform();

  if (isLoaded && isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleLogin = async () => {
    if (!signIn || !setActive || isAuthLoading) {
      return;
    }

    setIsAuthLoading(true);

    try {
      if (isNativePlatform && Capacitor.getPlatform() === 'android') {
        await handleNativeGoogleSignIn(signIn, setActive);
        return;
      }

      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/'
      });
    } catch {
      setIsAuthLoading(false);
    }
  };

  return (
    <main className="bg-background selection:bg-primary selection:text-primary-foreground relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="via-primary/20 absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-transparent to-transparent" />
        <div className="via-primary/20 absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-linear-to-b from-transparent to-transparent" />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, var(--primary) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="bg-primary/5 absolute -top-[20%] -right-[10%] h-[600px] w-[600px] rounded-full blur-[120px]" />
        <div className="bg-primary/5 absolute -bottom-[20%] -left-[10%] h-[600px] w-[600px] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10"
        >
          <span className="border-primary/20 bg-primary/5 text-primary inline-flex items-center gap-2.5 rounded-none border px-6 py-2.5 text-sm font-bold tracking-widest uppercase backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-sm opacity-75" />
              <span className="bg-primary relative inline-flex h-2.5 w-2.5 rounded-sm" />
            </span>
            Padel & Pickleball
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-foreground mb-6 max-w-5xl text-7xl leading-[0.9] font-black tracking-tighter sm:text-8xl md:text-9xl"
        >
          STOP <span className="text-primary italic">SEARCHING</span>.
          <br />
          START <span className="text-primary italic">PLAYING</span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-muted-foreground mb-12 max-w-2xl text-lg font-medium sm:text-2xl"
        >
          Match with players at your exact level.
          <br className="hidden sm:block" /> Anytime. Anywhere. Instantly.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex w-full flex-col items-center gap-5 sm:flex-row sm:justify-center"
        >
          <button
            type="button"
            onClick={() => {
              void handleGoogleLogin();
            }}
            disabled={isAuthLoading}
            className="group bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/70 relative inline-flex h-16 w-full min-w-[220px] items-center justify-center overflow-hidden px-8 text-xl font-bold tracking-wide uppercase transition-all hover:scale-[1.02] disabled:hover:scale-100 sm:w-auto"
          >
            <span className="relative z-10">{isAuthLoading ? 'Connecting...' : 'Continue with Google'}</span>
            <div className="absolute inset-0 -translate-x-full skew-x-12 transform bg-white/20 transition-transform duration-300 group-hover:translate-x-0" />
          </button>
        </motion.div>
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="absolute bottom-8 w-full text-center"
      >
        <a
          href="https://www.bluecatpadel.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="group text-muted-foreground hover:text-primary inline-flex items-center gap-2 text-sm font-medium transition-colors"
        >
          Made with
          <Heart className="fill-primary text-primary h-4 w-4 transition-transform group-hover:scale-125" />
          from Blue Cat Padel
        </a>
      </motion.footer>
    </main>
  );
}
