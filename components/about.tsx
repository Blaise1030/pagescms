"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import packageJson from "../package.json";
import {
  APP_NAME,
  APP_SHORT_DESCRIPTION,
  FORK_REPOSITORY,
  FORK_TAGLINE,
  FORK_URL,
  UPSTREAM_APP_NAME,
  UPSTREAM_AUTHOR,
  UPSTREAM_AUTHOR_GITHUB,
  UPSTREAM_DOCS_URL,
  UPSTREAM_REPOSITORY,
  UPSTREAM_URL,
  UPSTREAM_WEBSITE,
} from "@/lib/brand";

const UPDATE_DOCS_URL = UPSTREAM_DOCS_URL;

export function About() {
  const releaseRef = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
  const inferredTagVersion =
    releaseRef && /^v\d+\.\d+\.\d+/.test(releaseRef) ? releaseRef : undefined;
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION ??
    inferredTagVersion ??
    packageJson.version;

  const [open, setOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadLatestVersion = async () => {
      try {
        const response = await fetch("/api/app/version");
        if (!response.ok) return;

        const data = (await response.json()) as { latest?: string | null };
        if (!cancelled) {
          setLatestVersion(
            typeof data.latest === "string" ? data.latest : null,
          );
        }
      } catch {
        if (!cancelled) setLatestVersion(null);
      }
    };

    loadLatestVersion();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const updateAvailable = useMemo(() => {
    if (!latestVersion) return false;
    return compareSemver(version, latestVersion) < 0;
  }, [latestVersion]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <span className="bg-primary text-primary-foreground rounded-md size-6 flex items-center justify-center">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M0 4.8C0 2.14903 2.14903 0 4.8 0H12.0118C13.2848 0 14.5057 0.505713 15.4059 1.40589L22.5941 8.59411C23.4943 9.49429 24 10.7152 24 11.9882V19.2C24 21.851 21.851 24 19.2 24H4.8C2.14903 24 0 21.851 0 19.2V4.8Z"></path>
                  </svg>
                </span>
                <span className="sr-only">About {APP_NAME}</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>About {APP_NAME}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="w-[20rem] max-w-[calc(100vw-2rem)]">
        <DialogHeader className="items-center gap-3 text-center">
          <div className="flex size-15 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <svg
              className="size-10"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M0 4.8C0 2.14903 2.14903 0 4.8 0H12.0118C13.2848 0 14.5057 0.505713 15.4059 1.40589L22.5941 8.59411C23.4943 9.49429 24 10.7152 24 11.9882V19.2C24 21.851 21.851 24 19.2 24H4.8C2.14903 24 0 21.851 0 19.2V4.8Z" />
            </svg>
          </div>
          <DialogTitle className="text-base font-semibold">
            {APP_NAME}
          </DialogTitle>
          <DialogDescription>
            {APP_SHORT_DESCRIPTION}
            <span className="mt-2 block text-xs text-muted-foreground">
              {FORK_TAGLINE}. Based on {UPSTREAM_APP_NAME} by {UPSTREAM_AUTHOR}.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border">
          <Row
            label="Version"
            value={
              <div className="flex items-center gap-2">
                <span className="text-sm">{version}</span>
                {updateAvailable ? (
                  <a
                    href={UPDATE_DOCS_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex"
                  >
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 font-medium text-primary"
                    >
                      Update to {latestVersion}
                      <ArrowUpRight className="ml-1 size-3" />
                    </Badge>
                  </a>
                ) : null}
              </div>
            }
          />
          <Row
            label="Fork"
            value={
              <ExternalLink href={FORK_URL}>
                {FORK_REPOSITORY}
              </ExternalLink>
            }
          />
          <Row
            label="Upstream docs"
            value={
              <ExternalLink href={UPSTREAM_DOCS_URL}>
                {UPSTREAM_DOCS_URL.replace("https://", "")}
              </ExternalLink>
            }
          />
          <Row
            label="Upstream"
            value={
              <ExternalLink href={UPSTREAM_URL}>
                {UPSTREAM_REPOSITORY}
              </ExternalLink>
            }
          />
          <Row
            label="Originally by"
            value={
              <ExternalLink href={`https://github.com/${UPSTREAM_AUTHOR_GITHUB}`}>
                {UPSTREAM_AUTHOR}
              </ExternalLink>
            }
          />
          <Row
            label="Upstream site"
            value={
              <ExternalLink href={UPSTREAM_WEBSITE}>
                {UPSTREAM_WEBSITE.replace("https://", "")}
              </ExternalLink>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function compareSemver(a: string, b: string): number {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  if (!av || !bv) return 0;

  for (let i = 0; i < 3; i++) {
    if (av[i] > bv[i]) return 1;
    if (av[i] < bv[i]) return -1;
  }
  return 0;
}

function parseSemver(versionString: string): [number, number, number] | null {
  const normalized = versionString.trim().replace(/^v/i, "");
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  );
}
