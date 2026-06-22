import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { accountTable } from "@/db/schema";
import { SettingsLayout } from "@/app/(main)/settings/_components/settings-layout";
import { Installations } from "@/app/(main)/settings/_components/installations";
import { Identities } from "@/app/(main)/settings/_components/identities";
import { Profile } from "@/app/(main)/settings/_components/profile";
import { DocumentTitle } from "@/components/document-title";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const user = session?.user;
  if (!user) throw new Error("User not found");
  const githubAccount = await db.query.accountTable.findFirst({
    where: and(
      eq(accountTable.userId, user.id),
      eq(accountTable.providerId, "github"),
    ),
  });
  const githubConnected = Boolean(githubAccount);
  const githubManageUrl = process.env.GITHUB_APP_CLIENT_ID
    ? `https://github.com/settings/connections/applications/${process.env.GITHUB_APP_CLIENT_ID}`
    : null;

  return (
    <SettingsLayout>
      <DocumentTitle title="Settings" />
      <div className="max-w-screen-sm mx-auto space-y-8">
        <section id="profile" className="space-y-4">
          <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
          <Profile
            name={user.name}
            email={user.email}
            githubUsername={user.githubUsername}
          />
        </section>

        <section id="authentication" className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Authentication</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your sign-in methods and linked identity providers.
            </p>
          </div>
          <Identities
            email={user.email}
            githubConnected={githubConnected}
            githubUsername={user.githubUsername}
            githubManageUrl={githubManageUrl}
          />
        </section>

        {githubConnected && (
          <section id="installations" className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Installations</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage the accounts the Github application is installed on.
              </p>
            </div>
            <Installations />
          </section>
        )}

      </div>
    </SettingsLayout>
  );
}
