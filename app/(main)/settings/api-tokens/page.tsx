import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listCmsTokens } from "@/lib/cms-token";
import { SettingsLayout } from "@/app/(main)/settings/_components/settings-layout";
import { CmsTokensPanel } from "@/app/(main)/settings/_components/cms-tokens";
import { DocumentTitle } from "@/components/document-title";

export default async function ApiTokensPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("User not found");

  const tokens = await listCmsTokens(session.user.id);

  return (
    <SettingsLayout>
      <DocumentTitle title="API tokens" />
      <div className="max-w-screen-sm mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">API tokens</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create tokens for MCP clients (Cursor, Claude, etc.) to access your repositories.
          </p>
        </div>
        <CmsTokensPanel
          initialTokens={tokens.map((token) => ({
            ...token,
            createdAt: token.createdAt.toISOString(),
            lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </SettingsLayout>
  );
}
