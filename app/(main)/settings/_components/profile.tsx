"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getInitialsFromName } from "@/lib/utils/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "lucide-react";

type ProfileProps = {
  name?: string | null;
  email: string;
  githubUsername?: string | null;
};

export function Profile({ name, email, githubUsername }: ProfileProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name?.trim() || "");

  const initialName = name?.trim() || "";
  const isDirty = displayName.trim() !== initialName;

  const updateProfileMutation = useMutation({
    mutationFn: async (formData: { name: string }) => {
      const response = await fetch("/api/auth/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.status) {
        throw new Error(payload?.message || "Failed to update profile.");
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      router.refresh();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to update profile.";
      toast.error(message);
    },
  });

  const canSave = displayName.trim().length > 0 && isDirty && !updateProfileMutation.isPending;
  const avatarLabel = displayName.trim() || email;

  const handleSave = async () => {
    const nextName = displayName.trim();
    if (!nextName) return;

    updateProfileMutation.mutate({ name: nextName });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
    >
      <div className="rounded-lg border bg-card divide-y divide-border overflow-hidden">
        {/* Profile picture */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm font-medium">Profile picture</span>
          <Avatar className="h-9 w-9 rounded-full">
            <AvatarImage
              src={
                githubUsername
                  ? `https://github.com/${githubUsername}.png`
                  : `https://unavatar.io/${email}?fallback=false`
              }
              alt={avatarLabel}
            />
            <AvatarFallback className="rounded-full text-xs">
              {getInitialsFromName(avatarLabel)}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Email */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm font-medium">Email</span>
          <span className="text-sm text-muted-foreground">{email}</span>
        </div>

        {/* Full name */}
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <span className="text-sm font-medium shrink-0">Full name</span>
          <Input
            id="name"
            name="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            disabled={updateProfileMutation.isPending}
            className="max-w-[260px] h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end mt-3">
        <Button size="sm" type="submit" disabled={!canSave}>
          {updateProfileMutation.isPending && <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save profile
        </Button>
      </div>
    </form>
  );
}
