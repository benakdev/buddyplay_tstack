'use client';

import * as React from 'react';

import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveFormContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  drawerContentProps?: React.ComponentProps<typeof DrawerContent>;
  sheetContentProps?: React.ComponentProps<typeof SheetContent>;
  children: React.ReactNode;
}

export function ResponsiveFormContainer({
  open,
  onOpenChange,
  trigger,
  drawerContentProps,
  sheetContentProps,
  children
}: ResponsiveFormContainerProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent {...drawerContentProps}>{children}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent {...sheetContentProps}>{children}</SheetContent>
    </Sheet>
  );
}
