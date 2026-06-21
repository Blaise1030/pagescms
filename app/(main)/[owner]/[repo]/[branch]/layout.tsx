import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getConfig } from "@/lib/config-store";
import { ConfigProvider } from "@/contexts/config-context";
import type { ConfigState } from "@/contexts/config-context";
import { RepoLayout } from "@/components/repo/repo-layout";
import { getServerSession } from "@/lib/session-server";
import { getToken } from "@/lib/token";
import { AppLoadingShell } from "@/components/app-loading-shell";
import { ConfigGuard } from "./config-guard";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string; branch: string; }>;
}) {
  const { owner, repo, branch } = await params;
  const requestHeaders = await headers();
  const session = await getServerSession();
  const user = session?.user;
  const returnTo = requestHeaders.get("x-return-to");
  const signInUrl =
    returnTo && returnTo !== "/sign-in"
      ? `/sign-in?redirect=${encodeURIComponent(returnTo)}`
      : "/sign-in";
  if (!user) return redirect(signInUrl);

  const decodedBranch = decodeURIComponent(branch);

  // Start the fetch immediately — don't await. The shell renders now;
  // config-dependent parts (sidebar nav, content) stream in when it resolves.
  const configPromise: Promise<ConfigState> = (async () => {
    try {
      const { token } = await getToken(user, owner, repo);
      const config = await getConfig(owner, repo, decodedBranch, {
        getToken: async () => token,
      });
      return { config, error: null };
    } catch (error: any) {
      if (error.status === 404) {
        // .pages.yml missing — downstream pages handle this case
        if (error.response?.data?.message === "Not Found") {
          return { config: null, error: null };
        }
        return { config: null, error: "branch_not_found" as const };
      }
      if (error.status === 403) {
        return { config: null, error: "forbidden" as const };
      }
      throw error;
    }
  })();

  return (
    <ConfigProvider configPromise={configPromise}>
      <Suspense
        fallback={<AppLoadingShell />}
      >
        <RepoLayout>
          <ConfigGuard branch={decodedBranch}>
            {children}
          </ConfigGuard>
        </RepoLayout>
      </Suspense>
    </ConfigProvider>
  );
}
