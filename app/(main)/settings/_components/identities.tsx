"use client";

import { getAbsoluteAuthCallbackURL } from "@/lib/auth-callback-url";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { signIn } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  EllipsisVertical,
  Github,
  Loader,
  Mail,
} from "lucide-react";

type IdentitiesProps = {
  email: string;
  githubConnected: boolean;
  githubUsername?: string | null;
  githubManageUrl?: string | null;
};

export function Identities({
  email,
  githubConnected,
  githubUsername,
  githubManageUrl,
}: IdentitiesProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"connect" | null>(null);

  const handleConnectGithub = async () => {
    setPendingAction("connect");
    try {
      const result = await signIn.social({
        provider: "github",
        callbackURL: getAbsoluteAuthCallbackURL("/settings"),
        errorCallbackURL: getAbsoluteAuthCallbackURL("/settings"),
      });
      if (result.error?.message) toast.error(result.error.message);
    } finally {
      setPendingAction(null);
    }
  };

  const unlinkMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const response = await fetch("/api/auth/unlink-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.status) {
        const message =
          payload?.message || "Failed to disconnect GitHub account.";
        throw new Error(message);
      }

      return payload;
    },
    onSuccess: () => {
      toast.success("GitHub account disconnected.");
      router.refresh();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to disconnect GitHub account.";
      toast.error(message);
    },
  });

  const handleDisconnectGithub = async () => {
    unlinkMutation.mutate("github");
  };

  return (
    <div className="rounded-md border divide-y">
      <div className="flex items-center gap-x-3 px-3 py-2.5 text-sm">
        <div className="flex items-center gap-x-2 min-w-[100px]">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-xs">Email</span>
        </div>
        <span className="truncate text-xs text-muted-foreground">{email}</span>
      </div>
      <div className="flex items-center gap-x-3 px-3 py-2.5 text-sm">
        <div className={cn("flex items-center gap-x-2 min-w-[100px]", !githubConnected && "text-muted-foreground")}>
          <Github className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-xs">GitHub</span>
        </div>
        {githubConnected && (
          <span className="truncate text-xs text-muted-foreground">
            {githubUsername ? `@${githubUsername}` : "Connected"}
          </span>
        )}
        <div className="ml-auto">
          {!githubConnected ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleConnectGithub}
              disabled={pendingAction !== null}
            >
              Connect
              {pendingAction === "connect" && (
                <Loader className="h-3 w-3 animate-spin" />
              )}
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={unlinkMutation.isPending}
                >
                  {unlinkMutation.isPending ? (
                    <Loader className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <EllipsisVertical className="h-3.5 w-3.5" />
                  )}
                  <span className="sr-only">GitHub actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {githubManageUrl && (
                  <>
                    <DropdownMenuItem asChild>
                      <a href={githubManageUrl} target="_blank" rel="noreferrer">
                        Manage on GitHub
                        <ArrowUpRight className="size-3 text-muted-foreground ml-auto" />
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleDisconnectGithub}
                  disabled={unlinkMutation.isPending}
                >
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
