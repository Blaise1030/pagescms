"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { getPointerCursors, setPointerCursors } from "@/lib/preferences";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

function SettingCard({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function Preferences() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [pointerCursors, setPointerCursorsState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPointerCursorsState(getPointerCursors());
    setMounted(true);
  }, []);

  const handlePointerCursorsChange = (enabled: boolean) => {
    setPointerCursorsState(enabled);
    setPointerCursors(enabled);
  };

  const activeTheme = themeOptions.find((option) => option.value === theme);
  const themeLabel = activeTheme?.label ?? "System";
  const previewColor =
    resolvedTheme === "dark" ? "bg-zinc-100" : "bg-blue-500";

  if (!mounted) {
    return (
      <div className="space-y-3">
        <SettingCard
          title="Use pointer cursors"
          description="Change the cursor to a pointer when hovering over any interactive elements"
          control={<Switch disabled />}
        />
        <SettingCard
          title="Interface theme"
          description="Select or customize your interface color scheme"
          control={
            <Select disabled>
              <SelectTrigger size="sm" className="min-w-[140px]">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
            </Select>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SettingCard
        title="Use pointer cursors"
        description="Change the cursor to a pointer when hovering over any interactive elements"
        control={
          <Switch
            checked={pointerCursors}
            onCheckedChange={handlePointerCursorsChange}
            aria-label="Use pointer cursors"
          />
        }
      />

      <SettingCard
        title="Interface theme"
        description="Select or customize your interface color scheme"
        control={
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger size="sm" className="min-w-[140px]">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${previewColor}`} />
                  <span className="text-xs font-semibold tracking-tight">Aa</span>
                  <span>{themeLabel}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {themeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
