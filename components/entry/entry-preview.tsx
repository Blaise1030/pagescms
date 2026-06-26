"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { AlertCircle, ArrowUpRight, LoaderCircle } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { buildSiteUrl, collectPreviewBindings } from "@/lib/site";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Field } from "@/types/field";

const PREVIEW_HELLO_EVENT = "pagescms:preview:hello";
const PREVIEW_READY_EVENT = "pagescms:preview:ready";
const PREVIEW_DEBUG_EVENT = "pagescms:preview:debug";
const PREVIEW_UPDATE_EVENT = "pagescms:preview:update";

export function EntryPreview({
  fields,
  path,
  schema,
  values,
}: {
  fields: Field[];
  path?: string | null;
  schema?: Record<string, any> | null;
  values: Record<string, unknown>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { config } = useConfig();
  const [debouncedValues] = useDebounce(values, 250);
  const [isFrameLoaded, setIsFrameLoaded] = useState(false);
  const [isBridgeReady, setIsBridgeReady] = useState(false);
  const [showBridgeWarning, setShowBridgeWarning] = useState(false);
  const [bridgeDebugMessage, setBridgeDebugMessage] = useState("");
  const [bridgeDebugLevel, setBridgeDebugLevel] = useState<"info" | "warn">("info");

  const previewUrl = useMemo(
    () => buildSiteUrl(config?.object, schema, debouncedValues as Record<string, any>, path),
    [config?.object, debouncedValues, path, schema],
  );

  const previewOrigin = useMemo(() => {
    if (!previewUrl) return null;
    try {
      return new URL(previewUrl).origin;
    } catch {
      return null;
    }
  }, [previewUrl]);

  const bindings = useMemo(
    () => collectPreviewBindings(fields, debouncedValues as Record<string, any>),
    [debouncedValues, fields],
  );

  useEffect(() => {
    setIsFrameLoaded(false);
    setIsBridgeReady(false);
    setShowBridgeWarning(false);
    setBridgeDebugMessage("");
    setBridgeDebugLevel("info");
  }, [previewUrl]);

  useEffect(() => {
    if (!previewOrigin) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== previewOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (event.data?.type === PREVIEW_READY_EVENT) {
        setIsBridgeReady(true);
        setShowBridgeWarning(false);
        return;
      }

      if (event.data?.type === PREVIEW_DEBUG_EVENT) {
        setBridgeDebugMessage(String(event.data?.message || ""));
        setBridgeDebugLevel(event.data?.level === "warn" ? "warn" : "info");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [previewOrigin]);

  useEffect(() => {
    if (!previewOrigin || !isFrameLoaded || isBridgeReady) return;

    const sendHello = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: PREVIEW_HELLO_EVENT },
        previewOrigin,
      );
    };

    sendHello();
    const interval = setInterval(sendHello, 500);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setShowBridgeWarning(true);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isFrameLoaded, isBridgeReady, previewOrigin]);

  useEffect(() => {
    if (!previewOrigin || !isBridgeReady) return;

    iframeRef.current?.contentWindow?.postMessage(
      { type: PREVIEW_UPDATE_EVENT, bindings },
      previewOrigin,
    );
  }, [bindings, isBridgeReady, previewOrigin]);

  if (!previewUrl) {
    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Configure <code>settings.site.url</code> and{" "}
            <code>content[].site.path</code> to enable iframe preview.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b shrink-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>Preview</CardTitle>
            <CardDescription className="truncate">{previewUrl}</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              Open
              <ArrowUpRight className="ml-1 size-3.5" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative flex-1 p-0">
        {showBridgeWarning && (
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>
              Live bindings were not detected. Install{" "}
              <code>pagescms-site.js</code> on the public site and make sure the
              site allows iframe embedding.
            </p>
          </div>
        )}
        {bridgeDebugMessage && (
          <div
            className={
              bridgeDebugLevel === "warn"
                ? "flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                : "flex items-start gap-2 border-b border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950"
            }
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{bridgeDebugMessage}</p>
          </div>
        )}
        <div className="relative h-full">
          {!isFrameLoaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Loading preview…
              </div>
            </div>
          )}
          <iframe
            key={previewUrl}
            ref={iframeRef}
            src={previewUrl}
            title="Preview"
            onLoad={() => setIsFrameLoaded(true)}
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}
