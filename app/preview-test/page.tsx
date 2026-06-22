"use client";

import { useEffect, useState } from "react";

export default function PreviewTestPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    function handler(event: MessageEvent) {
      if (event.data?.type !== "cms:preview") return;
      setData(event.data.data);
      setLastUpdated(new Date().toLocaleTimeString());
    }
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "cms:preview:ready" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div style={{ fontFamily: "monospace", padding: "1.5rem", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.25rem" }}>
        CMS Preview Test Page
      </h1>
      <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "1.5rem" }}>
        Listening for <code>cms:preview</code> postMessage events…
        {lastUpdated && <> — last update: <strong>{lastUpdated}</strong></>}
      </p>
      {data === null ? (
        <p style={{ color: "#999", fontSize: "0.875rem" }}>No data received yet. Open the CMS editor with this page loaded in the preview panel.</p>
      ) : (
        <pre style={{
          background: "#f5f5f5",
          border: "1px solid #ddd",
          borderRadius: 6,
          padding: "1rem",
          overflow: "auto",
          fontSize: "0.8rem",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
