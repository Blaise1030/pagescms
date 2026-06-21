import { after } from "next/server";
import { verifyGitHubWebhookSignature } from "@/lib/crypto";
import { handleActionWebhookEvent } from "@/lib/github-webhook-actions";
import { handleInstallationWebhookEvent } from "@/lib/github-webhook-installation";
import { handlePushWebhookEvent } from "@/lib/github-webhook-push";

export const maxDuration = 60;

/**
 * Handles GitHub webhooks:
 * - Maintains tables related to GitHub installations (e.g. collaborators,
 *   installation tokens)
 * - Maintains GitHub cache (both files and permissions)
 *
 * POST /api/webhook/github
 *
 * Requires GitHub App webhook secret and signature.
 */
const processWebhookEvent = async (event: string | null, data: any) => {
  if (await handleInstallationWebhookEvent(event, data)) return;
  if (await handlePushWebhookEvent(event, data)) return;
  if (await handleActionWebhookEvent(event, data)) return;
};

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("X-Hub-Signature-256");
    const event = request.headers.get("X-GitHub-Event");
    const body = await request.text();

    const secret = process.env.A_GITHUB_APP_WEBHOOK_SECRET;
    if (!secret) {
      console.error("Missing A_GITHUB_APP_WEBHOOK_SECRET");
      return Response.json(null, { status: 500 });
    }

    if (!signature) {
      return Response.json(null, { status: 401 });
    }

    const isValid = await verifyGitHubWebhookSignature(secret, body, signature);
    if (!isValid) {
      return Response.json(null, { status: 401 });
    }

    const data = JSON.parse(body);

    after(async () => {
      try {
        await processWebhookEvent(event, data);
      } catch (error: unknown) {
        console.error("Error in Webhook", {
          error,
          event,
          payload: data,
          action: data?.action,
        });
      }
    });

    return Response.json(null, { status: 200 });
  } catch (error: unknown) {
    console.error("Error processing webhook:", error);
    return Response.json(null, { status: 500 });
  }
}
