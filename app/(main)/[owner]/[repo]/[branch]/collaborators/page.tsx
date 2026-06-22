"use client";

import { Collaborators } from "@/app/(main)/[owner]/[repo]/[branch]/_components/collaborators";
import { DocumentTitle, formatRepoBranchTitle } from "@/components/document-title";
import { useConfig } from "@/app/(main)/[owner]/[repo]/[branch]/_contexts/config-context";
import { useUser } from "@/contexts/user-context";
import { hasGithubIdentity } from "@/lib/authz-shared";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export default function Page() {
  const { config } = useConfig();
  const { user } = useUser();
  if (!config) throw new Error(`Configuration not found.`);
  if (!hasGithubIdentity(user)) {
    return (
      <Empty className="absolute inset-0 border-0 rounded-none">
        <EmptyHeader>
          <EmptyTitle>Access denied</EmptyTitle>
          <EmptyDescription>Only GitHub users can manage collaborators.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="max-w-screen-sm mx-auto flex-1 flex flex-col h-full px-2 py-3">
      <DocumentTitle
        title={formatRepoBranchTitle("Collaborators", config.owner, config.repo, config.branch)}
      />
      <div className="flex flex-col relative flex-1">
        <Collaborators owner={config.owner} repo={config.repo} branch={config?.branch}/>
      </div>
    </div>
  );
}
