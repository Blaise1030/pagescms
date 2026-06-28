"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CmsTokenRecord = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: { read: boolean; write: boolean };
  createdAt: string;
  lastUsedAt?: string | null;
};

export function CmsTokensPanel({ initialTokens }: { initialTokens: CmsTokenRecord[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/settings/cms-tokens");
    const result = await response.json();
    if (result.data) setTokens(result.data);
  }, []);

  const createToken = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/settings/cms-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create token");
      setCreatedToken(result.data.token);
      setName("");
      await refresh();
      toast.success("API token created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create token");
    } finally {
      setLoading(false);
    }
  };

  const revokeToken = async (id: string) => {
    const response = await fetch(`/api/settings/cms-tokens/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Failed to revoke token");
      return;
    }
    setTokens((current) => current.filter((token) => token.id !== id));
    toast.success("Token revoked");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="token-name">Token name</Label>
        <div className="flex gap-2">
          <Input
            id="token-name"
            placeholder="Cursor MCP"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button onClick={createToken} disabled={loading || !name.trim()}>
            Create
          </Button>
        </div>
      </div>

      {createdToken && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Copy your token now — it will not be shown again.</p>
          <code className="mt-2 block break-all text-xs">{createdToken}</code>
        </div>
      )}

      <div className="space-y-2">
        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API tokens yet.</p>
        ) : (
          tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{token.name}</p>
                <p className="text-xs text-muted-foreground">
                  …{token.tokenPrefix} · read={String(token.scopes.read)} · write=
                  {String(token.scopes.write)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => revokeToken(token.id)}>
                Revoke
              </Button>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Connect MCP clients to <code>/api/mcp</code> with{" "}
        <code>Authorization: Bearer cms_pat_…</code>
      </p>
    </div>
  );
}
