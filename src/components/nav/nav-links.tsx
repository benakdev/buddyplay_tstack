"use client";

import { Link, useLocation } from "@tanstack/react-router";

import { type LucideIcon } from "lucide-react";

import {
	SidebarGroup,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavLinks({
	items,
}: {
	items: {
		title: string;
		url: string;
		icon: LucideIcon;
	}[];
}) {
	const pathname = useLocation({ select: (state) => state.pathname });

	return (
		<SidebarGroup className="flex-1 justify-center">
			<SidebarMenu className="gap-6">
				{items.map((item) => (
					<SidebarMenuItem key={item.title}>
						<SidebarMenuButton
							asChild
							size="xl"
							isActive={
								pathname === item.url || pathname?.startsWith(item.url + "/")
							}
							tooltip={item.title}
							className="transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
						>
							<Link to={item.url}>
								<item.icon className="size-8!" />
								<span className="text-base font-medium">{item.title}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
