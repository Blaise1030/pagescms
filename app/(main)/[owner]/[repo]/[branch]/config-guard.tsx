"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useConfigPromise } from "@/app/(main)/[owner]/[repo]/[branch]/_contexts/config-context";
import { useRepo } from "@/app/(main)/[owner]/[repo]/[branch]/_contexts/repo-context";
import { trackVisit } from "@/lib/tracker";

export function ConfigGuard({
  branch,
  children,
}: {
  branch: string;
  children: React.ReactNode;
}) {
  const configPromise = useConfigPromise();
  const { config, error } = use(configPromise);
  const { owner, repo } = useRepo();

  useEffect(() => {
    if (config?.owner && config?.repo && config?.branch) {
      trackVisit(config.owner, config.repo, config.branch);
    }
  }, [config]);

  if (error === "branch_not_found") {
    return (
      <Empty className="absolute inset-0 border-0 rounded-none">
        <EmptyHeader>
          <EmptyTitle>Branch not found</EmptyTitle>
          <EmptyDescription>{`The branch "${branch}" could not be found. It may have been removed or renamed.`}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link className={buttonVariants({ variant: "default" })} href={`/${owner}/${repo}`}>
            Open default branch
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  if (error === "forbidden") {
    return (
      <Empty className="absolute inset-0 border-0 rounded-none">
        <EmptyHeader>
          <EmptyTitle>Access denied</EmptyTitle>
          <EmptyDescription>You do not have permission to access this repository.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link className={buttonVariants({ variant: "default" })} href="/">
            Choose another repository
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  return <>{children}</>;
}
