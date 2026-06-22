"use client";

import type { RefObject } from "react";
import { RefreshCw, ExternalLink, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type PreviewPanelProps = {
  previewUrl: string;
  formValues: Record<string, unknown>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onLoad?: () => void;
  showEditor?: boolean;
  onToggleEditor?: () => void;
};

export function PreviewPanel({ previewUrl, iframeRef, onLoad, showEditor, onToggleEditor }: PreviewPanelProps) {
  function refresh() {
    if (iframeRef.current) {
      iframeRef.current.src = previewUrl;
    }
  }

  return (
    <div className="relative h-full w-full">
      <iframe
        ref={iframeRef}
        src={previewUrl}
        title="preview"
        onLoad={onLoad}
        className="absolute inset-0 h-full w-full border-0"
      />
      <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
        {onToggleEditor && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onToggleEditor}
            aria-label={showEditor ? "Collapse form" : "Expand form"}
            className="size-7 shadow-sm opacity-60 hover:opacity-100 transition-opacity"
          >
            <PanelLeft className="size-3.5" />
          </Button>
        )}
        <Button type="button" variant="secondary" size="icon" onClick={refresh} className="size-7 shadow-sm opacity-60 hover:opacity-100 transition-opacity">
          <RefreshCw className="size-3.5" />
        </Button>
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center size-7 rounded-md bg-secondary text-secondary-foreground shadow-sm opacity-60 hover:opacity-100 transition-opacity"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
