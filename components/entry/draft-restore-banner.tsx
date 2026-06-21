"use client";

import { Button } from "@/components/ui/button";

export function DraftRestoreBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/50 p-2 text-sm">
      <span className="text-muted-foreground">
        You have unsaved changes from a previous session.
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={onDiscard}>
          Discard
        </Button>
        <Button size="sm" onClick={onRestore}>
          Restore draft
        </Button>
      </div>
    </div>
  );
}
