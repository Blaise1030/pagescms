"use client";

import { AppLogo } from "@/components/app-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

export function AppLoadingShell() {
  return (
    <SidebarProvider className="overflow-hidden">
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarContent />
      </Sidebar>
      <SidebarInset className="overflow-hidden">
        <div className="flex min-h-svh flex-1 items-center justify-center">
          <div className="p-1 rounded-md bg-foreground animate-pulse">
            <AppLogo className="size-8" />
          </div>          
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
