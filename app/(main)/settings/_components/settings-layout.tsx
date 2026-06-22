"use client";

import { SettingsSidebar } from "@/app/(main)/settings/_components/settings-sidebar";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

export function SettingsLayout({
  children,
  backHref,
}: {
  children: React.ReactNode;
  backHref?: string;
}) {
  return (
    <SidebarProvider className="overflow-hidden">
      <SettingsSidebar backHref={backHref} />
      <SidebarInset className="overflow-hidden">
        <main className="scrollbar relative min-w-0 min-h-0 flex-1 overflow-y-auto px-6 pt-10 pb-8 md:pt-12">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
