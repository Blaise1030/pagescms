"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, KeyRound, Palette, User } from "lucide-react";
import { DASHBOARD_PATH } from "@/lib/routes";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const settingsNav = [
  {
    label: "Personal",
    items: [
      { key: "profile", label: "Profile", href: "/settings", icon: <User className="size-4" /> },
      { key: "preferences", label: "Preferences", href: "/settings/preferences", icon: <Palette className="size-4" /> },
      { key: "api-tokens", label: "API tokens", href: "/settings/api-tokens", icon: <KeyRound className="size-4" /> },
    ],
  },
];

export function SettingsSidebar({ backHref = DASHBOARD_PATH }: { backHref?: string }) {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href={backHref}>
                <ArrowLeft className="size-4" />
                <span>Back to app</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-0 px-1">
        {settingsNav.map((group) => (
          <SidebarGroup key={group.label} className="py-0 px-1">
            <SidebarGroupLabel className="min-h-5 px-2 text-xs font-medium text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/settings"
                      ? pathname === "/settings"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild size="sm" isActive={isActive} tooltip={item.label}>
                        <Link href={item.href}>
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
