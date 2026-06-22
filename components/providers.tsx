"use client";

import { useEffect, useRef } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createIDBPersister } from "@/lib/idb-query-persister";
import { ThemeProvider } from "@/components/theme-provider";
import { ActionToastProvider } from "@/contexts/action-toast-context";
import { UserProvider } from "@/contexts/user-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyPointerCursors } from "@/lib/preferences";
import { User } from "@/types/user";

const persister = createIDBPersister("pagescms-query-cache");

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24, // 24h — survive browser restarts
        staleTime: 1000 * 30,          // 30s — fresh window before background refetch
        retry: 1,
      },
    },
  });
}

export function Providers({ children, user }: { children: React.ReactNode; user: User | null }) {
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) queryClientRef.current = makeQueryClient();

  useEffect(() => { applyPointerCursors(); }, []);

  return (
    <PersistQueryClientProvider
      client={queryClientRef.current}
      persistOptions={{ persister }}
    >
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
    </PersistQueryClientProvider>
  );
}
