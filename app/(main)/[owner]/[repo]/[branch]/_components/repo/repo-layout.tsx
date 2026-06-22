"use client";

import { useSearchParams } from "next/navigation";
import { RepoSidebar } from "@/app/(main)/[owner]/[repo]/[branch]/_components/repo/repo-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  RepoHeaderProvider,
  useRepoHeaderState,
} from "@/app/(main)/[owner]/[repo]/[branch]/_components/repo/repo-header-context";

function RepoHeader({ hideSidebar }: { hideSidebar: boolean }) {
  const { header } = useRepoHeaderState();
  const hasHeaderContent =
    header !== null &&
    header !== undefined &&
    header !== false &&
    header !== "";

  if (!hasHeaderContent) return null;

  return (
    <header className="sticky top-0 z-10 flex py-1 shrink-0 items-center gap-2 border-b rounded-t-xl bg-background dark:bg-accent/30 px-2">
      {!hideSidebar && <SidebarTrigger />}
      <div className="min-w-0 flex-1">{header}</div>
    </header>
  );
}

export function RepoLayout({ children, defaultSidebarWidth }: { children: React.ReactNode; defaultSidebarWidth?: number }) {
  const searchParams = useSearchParams();
  const hideSidebar = searchParams.get("hideSidebar") === "true";

  return (
    <SidebarProvider className="overflow-hidden" defaultWidth={defaultSidebarWidth}>
      <RepoHeaderProvider>
        {!hideSidebar && <RepoSidebar />}
        <SidebarInset className="overflow-hidden">
          <RepoHeader hideSidebar={hideSidebar} />
          <main className="scrollbar relative min-w-0 min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </RepoHeaderProvider>
    </SidebarProvider>
  );
}
