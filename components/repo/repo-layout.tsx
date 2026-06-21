"use client";

import { RepoSidebar } from "@/components/repo/repo-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  RepoHeaderProvider,
  useRepoHeaderState,
} from "@/components/repo/repo-header-context";

function RepoHeader() {
  const { header } = useRepoHeaderState();
  const hasHeaderContent =
    header !== null &&
    header !== undefined &&
    header !== false &&
    header !== "";

  if (!hasHeaderContent) return null;

  return (
    <header className="sticky top-0 z-10 flex py-1 shrink-0 items-center gap-2 border-b rounded-t-xl bg-background dark:bg-accent/30 px-2">
      <SidebarTrigger />
      <div className="min-w-0 flex-1">{header}</div>
    </header>
  );
}

export function RepoLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="overflow-hidden">
      <RepoHeaderProvider>
        <RepoSidebar />
        <SidebarInset className="overflow-hidden">
          <RepoHeader />
          <main className="scrollbar relative min-w-0 min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </RepoHeaderProvider>
    </SidebarProvider>
  );
}
