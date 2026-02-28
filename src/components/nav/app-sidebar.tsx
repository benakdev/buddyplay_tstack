'use client';

import * as React from 'react';

import { Bell, Home, Inbox, Search, User } from 'lucide-react';

import { BrandHeader } from '@/components/nav/brand-header';
import { NavLinks } from '@/components/nav/nav-links';
import { NavUser } from '@/components/nav/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@/components/ui/sidebar';

// Using the MVP screens from PRODUCT.md
const navItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: Home
  },
  {
    title: 'Finder',
    url: '/finder',
    icon: Search
  },
  {
    title: 'Inbox',
    url: '/inbox',
    icon: Inbox
  },
  {
    title: 'Alerts',
    url: '/alerts',
    icon: Bell
  },
  {
    title: 'Profile',
    url: '/profile',
    icon: User
  }
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <BrandHeader />
      </SidebarHeader>
      <SidebarContent>
        <NavLinks items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
