"use client";

import { useEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ActionToastProvider } from "@/contexts/action-toast-context";
import { UserProvider } from "@/contexts/user-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyPointerCursors } from "@/lib/preferences";
import { User } from "@/types/user";

export function Providers({ children, user }: { children: React.ReactNode, user: User | null }) {
  useEffect(() => { applyPointerCursors(); }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <UserProvider user={user}>
        <TooltipProvider>
          <ActionToastProvider>
            {children}
          </ActionToastProvider>
        </TooltipProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
