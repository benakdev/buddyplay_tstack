"use client";

import { SignOutButton, useClerk, useUser } from "@clerk/tanstack-react-start";
import { ChevronsUpDown, LogOut, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

export function NavUser() {
	const { isMobile } = useSidebar();
	const { user, isLoaded } = useUser();
	const clerk = useClerk();

	const handleOpenManageAccount = () => {
		if (clerk) {
			clerk.openUserProfile();
		}
	};

	if (!isLoaded || !user) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<div className="bg-muted h-12 animate-pulse rounded-md" />
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded">
								<AvatarImage src={user.imageUrl} alt={user.fullName || ""} />
								<AvatarFallback className="rounded">
									{user.firstName?.charAt(0)}
									{user.lastName?.charAt(0)}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.fullName}</span>
								<span className="truncate text-xs">
									{user.primaryEmailAddress?.emailAddress}
								</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage src={user.imageUrl} alt={user.fullName || ""} />
									<AvatarFallback className="rounded-lg">
										{user.firstName?.charAt(0)}
										{user.lastName?.charAt(0)}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{user.fullName}</span>
									<span className="truncate text-xs">
										{user.primaryEmailAddress?.emailAddress}
									</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleOpenManageAccount}>
							<User className="mr-2 size-4" />
							Profile
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<SignOutButton redirectUrl="/">
							<DropdownMenuItem>
								<LogOut className="mr-2 size-4" />
								Log out
							</DropdownMenuItem>
						</SignOutButton>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
