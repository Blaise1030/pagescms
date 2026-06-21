"use client";

import { useUser } from "@/contexts/user-context";
import { Button } from "@/components/ui/button";
import { getGithubInstallationUrl } from "@/lib/github-app";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpRight, Ban, EllipsisVertical } from "lucide-react";

const Installations = () => {
  const { user } = useUser();

  if (!user || !user.accounts) {
    return (
      <div className="rounded-md border px-3 py-4 flex items-center gap-x-2 text-xs text-muted-foreground">
        <Ban className="h-3.5 w-3.5 shrink-0" />
        No account with the Github application installed.
      </div>
    );
  }

  return (
    <div className="rounded-md border divide-y">
      {user.accounts.map((account) => (
        <div
          className="flex items-center gap-x-3 px-3 py-2.5 text-sm"
          key={`${account.login}-${account.installationId}`}
        >
          <div className="flex gap-x-2 items-center">
            <img
              src={`https://github.com/${account.login}.png`}
              alt={`${account.login}'s avatar`}
              className="h-5 w-5 rounded"
            />
            <span className="text-xs font-medium truncate">{account.login}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" className="ml-auto">
                <EllipsisVertical className="h-3.5 w-3.5" />
                <span className="sr-only">Installation actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a
                  href={getGithubInstallationUrl(account)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Manage GitHub App
                  <ArrowUpRight className="size-3 text-muted-foreground ml-auto" />
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
};

export { Installations };
