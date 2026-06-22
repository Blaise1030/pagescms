"use client";

import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import {
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

type RepoItem = {
  owner: string;
  repo: string;
  branch: string;
};

export function RepoCombobox({
  email,
  currentOwner,
  currentRepo,
  currentBranch,
  repos,
  onSelect,
}: {
  email?: string;
  currentOwner: string;
  currentRepo: string;
  currentBranch: string;
  repos: RepoItem[];
  onSelect?: () => void;
}) {
  const router = useRouter();

  return (
    <>
      {email && (
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {email}
        </DropdownMenuLabel>
      )}
      <Command>
        <CommandInput placeholder="Search projects…" autoFocus onKeyDown={(e) => e.stopPropagation()} />
        <CommandList>
          <CommandEmpty>No projects found</CommandEmpty>
          <CommandItem
            value={currentRepo}
            onSelect={() => {
              router.push(`/${currentOwner}/${currentRepo}/${encodeURIComponent(currentBranch)}`);
              onSelect?.();
            }}
          >
            <img
              src={`https://github.com/${currentOwner}.png`}
              alt={currentOwner}
              className="size-5 rounded"
            />
            <span className="truncate">{currentRepo}</span>
            <Check className="size-3 ml-auto" />
          </CommandItem>
          {repos.map((visit) => (
            <CommandItem
              key={`${visit.owner}/${visit.repo}/${visit.branch}`}
              value={visit.repo}
              onSelect={() => {
                router.push(`/${visit.owner}/${visit.repo}/${encodeURIComponent(visit.branch)}`);
                onSelect?.();
              }}
            >
              <img
                src={`https://github.com/${visit.owner}.png`}
                alt={visit.owner}
                className="size-5 rounded"
              />
              <span className="truncate">{visit.repo}</span>
            </CommandItem>
          ))}
        </CommandList>
      </Command>
      <DropdownMenuSeparator />
      <Link
        href="/api/github-app/install"
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
      >
        <Plus className="size-4" />
        Add project
      </Link>
    </>
  );
}
