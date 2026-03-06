import { useAuth } from '@clerk/tanstack-react-start';
import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router';

import { AppSidebar } from '@/components/nav/app-sidebar';
import { DynamicBreadcrumb } from '@/components/nav/dynamic-breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useStoreUserEffect } from '@/useStoreUserEffect';

export const Route = createFileRoute('/_app')({
  component: ProtectedLayout
});

function ProtectedLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  // Need to check if there is an active Clerk handshake in the URL so we
  // don't aggressively redirect to "/" before Clerk sets the session cookies
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isHandshakeInProgress = urlParams.has('__clerk_handshake');

  if (!isLoaded || isHandshakeInProgress) {
    return <div className="min-h-screen" />;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return <AuthenticatedLayout />;
}

function AuthenticatedLayout() {
  const { isLoading } = useStoreUserEffect();

  if (isLoading) {
    return <div className="min-h-screen" />;
  }

  return (
    <SidebarProvider className="native-safe-area-shell">
      <AppSidebar />
      <SidebarInset className="h-dvh min-h-0 overflow-hidden">
        <header className="app-shell-panel sticky top-0 z-20 flex h-14 shrink-0 items-center rounded-none border-x-0 border-t-0 bg-background/55 supports-backdrop-filter:bg-background/15 shadow-none backdrop-blur-xl md:h-16">
          <div className="flex w-full items-center gap-2 px-2 md:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <DynamicBreadcrumb />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain p-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
