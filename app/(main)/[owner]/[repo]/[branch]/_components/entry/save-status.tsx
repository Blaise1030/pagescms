"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SaveStatusValue = "idle" | "saving" | "saved" | "error";

export function SaveStatus({ status }: { status: SaveStatusValue }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status !== "saved") return;
    const t = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(t);
  }, [status]);

  if (!visible) return null;

  return (
    <span
      className={cn(
        "shrink-0 text-sm",
        status !== "error" && "text-muted-foreground",
        status === "error" && "text-destructive"
      )}
    >
      {status === "saving" && "Saving…"}
      {status === "saved" && "Saved"}
      {status === "error" && "Save failed"}
    </span>
  );
}
