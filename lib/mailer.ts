import { env } from "cloudflare:workers";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

type CloudflareEmailSendResult = {
  delivered?: string[];
  permanent_bounces?: string[];
  queued?: string[];
};

type CloudflareApiResponse = {
  success: boolean;
  errors?: Array<{ message: string }>;
  result?: CloudflareEmailSendResult;
};

const getEnv = (name: string) => {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getFromEmail = () => {
  const from = getEnv("EMAIL_FROM");
  if (!from) {
    throw new Error("Missing sender email. Set EMAIL_FROM to a verified Cloudflare Email Service address.");
  }
  return from;
};

const assertDeliveryResult = (result: CloudflareEmailSendResult | undefined) => {
  const bounced = result?.permanent_bounces ?? [];
  if (bounced.length > 0) {
    throw new Error(`Email permanently bounced for: ${bounced.join(", ")}`);
  }
};

const sendViaBinding = async ({
  from,
  to,
  subject,
  html,
  text,
}: SendEmailInput & { from: string }) => {
  if (!env.EMAIL) return false;

  await env.EMAIL.send({
    from,
    to,
    subject,
    html,
    text,
  });

  return true;
};

const sendViaRestApi = async ({
  from,
  to,
  subject,
  html,
  text,
}: SendEmailInput & { from: string }) => {
  const accountId = getEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = getEnv("CLOUDFLARE_API_TOKEN");
  if (!accountId || !apiToken) {
    throw new Error(
      "No email binding available. Configure the EMAIL send_email binding in wrangler.jsonc, or set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for the REST API.",
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    },
  );

  const data = (await response.json()) as CloudflareApiResponse;
  if (!response.ok || !data.success) {
    const message =
      data.errors?.map((error) => error.message).join(", ") ||
      `Cloudflare Email API request failed (${response.status})`;
    throw new Error(message);
  }

  assertDeliveryResult(data.result);
};

export const sendEmail = async ({ to, subject, html, text }: SendEmailInput) => {
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) throw new Error("At least one recipient is required.");

  const payload = {
    from: getFromEmail(),
    to: recipients,
    subject,
    html,
    text,
  };

  if (await sendViaBinding(payload)) return;
  await sendViaRestApi(payload);
};
