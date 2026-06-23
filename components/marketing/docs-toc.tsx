"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type DocsTocItem = {
  id: string;
  title: string;
};

type DocsTocContextValue = {
  items: DocsTocItem[];
  register: (item: DocsTocItem) => void;
  unregister: (id: string) => void;
};

const DocsTocContext = createContext<DocsTocContextValue | null>(null);

export function DocsTocProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<DocsTocItem[]>([]);

  const register = useCallback((item: DocsTocItem) => {
    setItems((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing?.title === item.title) {
        return current;
      }

      const without = current.filter((entry) => entry.id !== item.id);
      return [...without, item];
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setItems((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const value = useMemo(
    () => ({ items, register, unregister }),
    [items, register, unregister],
  );

  return (
    <DocsTocContext.Provider value={value}>{children}</DocsTocContext.Provider>
  );
}

export function useDocsToc() {
  const context = useContext(DocsTocContext);
  if (!context) {
    throw new Error("useDocsToc must be used within DocsTocProvider");
  }
  return context;
}

export function DocsTocSidebar() {
  const { items } = useDocsToc();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aTop = document.getElementById(a.id)?.offsetTop ?? 0;
      const bTop = document.getElementById(b.id)?.offsetTop ?? 0;
      return aTop - bTop;
    });
  }, [items]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveId(null);
      return;
    }

    const headings = sortedItems
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node !== null);

    if (headings.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-96px 0px -70% 0px",
        threshold: [0, 1],
      },
    );

    for (const heading of headings) {
      observer.observe(heading);
    }

    return () => observer.disconnect();
  }, [items, sortedItems]);

  if (sortedItems.length === 0) {
    return null;
  }

  return (
    <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] self-start overflow-y-auto pb-10 xl:block">
      <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground">
        On this page
      </p>
      <nav className="space-y-1">
        {sortedItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={cn(
              "block py-1 text-sm transition-colors",
              activeId === item.id
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.title}
          </a>
        ))}
      </nav>
    </aside>
  );
}
