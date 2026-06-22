"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { requireApiSuccess } from "@/lib/api-client";

export function AdminConfirmActionButton({
  onConfirm,
  label,
  title,
  description,
  confirmLabel,
  variant = "outline",
  size = "sm",
  icon,
  iconOnly = false,
}: {
  onConfirm: () => Promise<void>;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  icon?: React.ReactNode;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} aria-label={label}>
          {icon}
          {!iconOnly ? label : null}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminLogoutAllButton() {
  const router = useRouter();

  return (
    <AdminConfirmActionButton
      onConfirm={async () => {
        const response = await fetch("/api/admin/sessions", { method: "DELETE" });
        const data = await requireApiSuccess<{ redirectTo?: string }>(
          response,
          "Failed to log out all users",
        );
        if (data.redirectTo) {
          router.push(data.redirectTo);
          router.refresh();
        }
      }}
      label="Log out all users"
      title="Log out all users?"
      description="This will revoke every active session and redirect everyone to sign in again."
      confirmLabel="Log out all"
      variant="outline"
      size="sm"
    />
  );
}

export function AdminResetCacheButton({
  icon,
}: {
  icon?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <AdminConfirmActionButton
      onConfirm={async () => {
        const response = await fetch("/api/admin/cache", { method: "POST" });
        await requireApiSuccess(response, "Failed to reset cache");
        router.refresh();
      }}
      label="Reset cache"
      title="Reset cache?"
      description="This will clear cached files, cached config, cache metadata, and permission cache."
      confirmLabel="Reset"
      variant="outline"
      size="sm"
      icon={icon}
    />
  );
}
