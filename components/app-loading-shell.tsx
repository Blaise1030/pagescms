"use client";

import { useSyncExternalStore } from "react";
import { AppLogo } from "@/components/app-logo";
import {
  getSidebarWidthFromCookie,
  SIDEBAR_WIDTH_DEFAULT,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function useSidebarWidth() {
  return useSyncExternalStore(
    () => () => {},
    getSidebarWidthFromCookie,
    () => SIDEBAR_WIDTH_DEFAULT,
  );
}

export function AppLoadingShell() {
  const sidebarWidth = useSidebarWidth();

  return (
    <div className="flex h-svh w-full overflow-hidden bg-sidebar dark:bg-background">
      <div
        aria-hidden
        className="hidden shrink-0 md:block"
        style={{ width: sidebarWidth }}
      />
      <main
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border bg-background dark:bg-accent/30",
          "md:m-2 md:ml-0 md:rounded-xl md:shadow-sm",
        )}
      >
        <div className="flex min-h-svh flex-1 items-center justify-center">
          <div className="rounded-md bg-muted p-0.5 animate-pulse">
            <AppLogo className="size-8" />
          </div>
        </div>
      </main>
    </div>
  );
}
