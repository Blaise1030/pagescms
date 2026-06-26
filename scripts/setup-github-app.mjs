#!/usr/bin/env node
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const brand = JSON.parse(
  readFileSync(resolve(process.cwd(), "brand.json"), "utf8"),
);
const defaultAppName = brand.appName;
const defaultAppDescription = `${brand.appName} is an open source CMS for editing content in GitHub repositories. Based on ${brand.upstream.appName} by ${brand.upstream.author}.`;

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

async function main() {
  const host = "127.0.0.1";
  const port = Number(args.port || 8787);
  const baseUrl = trimSlash(
    args.baseUrl ||
      process.env.BASE_URL ||
      process.env.BETTER_AUTH_URL ||
      "http://localhost:3000",
  );
  const appName = (args.appName || defaultAppName).trim();
  const ownerType = args.ownerType === "org" ? "org" : "personal";
  const orgSlug = ownerType === "org" ? (args.org || "").trim() : "";
  const state = randomBytes(16).toString("hex");

  if (ownerType === "org" && !orgSlug) {
    throw new Error("Missing --org <slug> when --owner-type org.");
  }

  const localCallbackUrl = `http://${host}:${port}/api/github-app/callback`;
  const userAuthorizationCallbackUrl = `${baseUrl}/api/auth/callback/github`;
  const webhookUrl = trimSlash(args.webhookUrl || `${baseUrl}/api/webhook/github`);
  const setupUrl = `${baseUrl}/`;
  const webhookEnabled = !isPrivateBaseUrl(webhookUrl);
  const defaultEvents = [
    "installation_target",
    "repository",
    "push",
    "delete",
    "check_run",
    "check_suite",
    "status",
    "workflow_run",
  ];

  const manifest = {
    name: appName,
    url: baseUrl,
    callback_urls: [userAuthorizationCallbackUrl],
    redirect_url: localCallbackUrl,
    description: defaultAppDescription,
    public: false,
    default_permissions: {
      administration: "write",
      actions: "write",
      checks: "read",
      statuses: "read",
      contents: "write",
      metadata: "read",
    },
    request_oauth_on_install: false,
    setup_on_update: true,
    setup_url: setupUrl,
  };

  if (webhookEnabled) {
    manifest.hook_attributes = {
      url: webhookUrl,
      active: true,
    };
    manifest.default_events = defaultEvents;
  } else if (args.webhookUrl) {
    throw new Error(
      `Webhook URL must be publicly reachable. Got: ${webhookUrl}`,
    );
  } else {
    console.warn(
      `\nNo webhook or events in manifest because ${webhookUrl} is not publicly reachable.`,
    );
    console.warn(
      "Pass --webhook-url with a tunnel URL, or configure webhook + events later in GitHub App settings.",
    );
  }

  const appCreationUrl =
    ownerType === "org"
      ? `https://github.com/organizations/${encodeURIComponent(orgSlug)}/settings/apps/new?state=${encodeURIComponent(state)}`
      : `https://github.com/settings/apps/new?state=${encodeURIComponent(state)}`;

  const code = await runLocalFlow({
    host,
    port,
    state,
    appCreationUrl,
    manifest,
    autoOpen: args.open,
  });

  const converted = await exchangeManifestCode(code);
  const envPath = args.envPath ? resolve(process.cwd(), args.envPath) : "";
  const authSecret =
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    randomBytes(32).toString("base64url");

  const envValues = {
    BASE_URL: baseUrl,
    BETTER_AUTH_SECRET: authSecret,
    GITHUB_APP_ID: String(converted.id),
    GITHUB_APP_NAME: converted.slug,
    GITHUB_APP_CLIENT_ID: converted.client_id,
    GITHUB_APP_CLIENT_SECRET: converted.client_secret,
    GITHUB_APP_PRIVATE_KEY: wrapQuoted(escapeNewlines(converted.pem || "")),
    GITHUB_APP_WEBHOOK_SECRET: converted.webhook_secret,
  };

  if (envPath) {
    upsertEnv(envPath, envValues);
  }

  console.log("\nGitHub App created.");
  console.log(`- App: ${converted.name} (${converted.slug})`);
  console.log(`- Settings: https://github.com/settings/apps/${converted.slug}`);
  if (envPath) {
    console.log(`- Env file updated: ${envPath}`);
  } else {
    console.log("- Env vars:");
    for (const [key, value] of Object.entries(envValues)) {
      console.log(`  ${key}=${value}`);
    }
    console.log("\nPass --env <path> to write them to a file automatically.");
  }
  console.log(`- User authorization callback: ${userAuthorizationCallbackUrl}`);
  console.log(`- Setup URL: ${setupUrl}`);
  console.log(
    "- Preview deployments: register only the production callback URL above in GitHub App settings.",
  );
  console.log(
    "  Use better-auth oauth-proxy (AUTH_PRODUCTION_URL + OAUTH_PROXY_SECRET) for PR previews.",
  );
  if (webhookEnabled) {
    console.log(`- Webhook URL: ${webhookUrl}`);
  } else {
    console.log("- Webhook: disabled during setup (local/private URL)");
    console.log(`  Configure later in GitHub App settings: ${webhookUrl}`);
    console.log(`  Also subscribe to events: ${defaultEvents.join(", ")}`);
  }
  console.log("\nNext:");
  console.log("1) In GitHub App settings → Permissions & events:");
  console.log("   Account permissions → Email addresses → Read-only (required for sign-in).");
  console.log("2) Install the app on your target account/repositories.");
  console.log("   Disable 'User-to-server token expiration' if GitHub shows that option.");
  if (!webhookEnabled) {
    console.log(
      "   After exposing the app publicly, set the webhook URL in GitHub App settings.",
    );
  }
  console.log(`3) Start ${defaultAppName}.`);
}

main().catch((error) => {
  console.error(`\nSetup failed: ${toMessage(error)}`);
  process.exit(1);
});

async function runLocalFlow({
  host,
  port,
  state,
  appCreationUrl,
  manifest,
  autoOpen,
}) {
  let resolveCode;
  let rejectCode;

  const codePromise = new Promise((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const startPath = "/start";
  const callbackPath = "/api/github-app/callback";

  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${host}:${port}`);

    if (url.pathname === startPath) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderAutoPostPage({ appCreationUrl, manifest }));
      return;
    }

    if (url.pathname === callbackPath) {
      const incomingState = url.searchParams.get("state") || "";
      const code =
        url.searchParams.get("code") ||
        url.searchParams.get("temporary_code") ||
        "";
      const error = url.searchParams.get("error") || "";

      if (error) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end(`Error from GitHub: ${error}`);
        rejectCode(new Error(`GitHub returned error: ${error}`));
        return;
      }

      if (incomingState !== state) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end("Invalid state. Return to terminal.");
        rejectCode(new Error("OAuth state mismatch while creating GitHub App."));
        return;
      }

      if (!code) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end("No temporary code received.");
        rejectCode(new Error("Missing temporary code in callback URL."));
        return;
      }

      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<h1>GitHub App created.</h1><p>Return to terminal.</p>");
      resolveCode(code);
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const launchUrl = `http://${host}:${port}${startPath}`;
  console.log("\n=== GitHub App setup ===");
  console.log("Keep this terminal open until you see 'GitHub App created.'");
  console.log("\nSteps:");
  console.log("  1. Open the local setup page (browser may open automatically)");
  console.log("  2. GitHub opens with a pre-filled app form");
  console.log("  3. Click 'Create GitHub App' on GitHub (you can change the name)");
  console.log("  4. GitHub redirects back to localhost and this script finishes");
  console.log("\nIf GitHub shows 'Invalid GitHub App configuration', fix the error there.");
  console.log("No app is created until step 3 succeeds.\n");
  console.log(`Setup page:\n${launchUrl}`);
  if (autoOpen) tryOpenBrowser(launchUrl);

  const timeoutMs = 10 * 60 * 1000;
  const timeoutId = setTimeout(
    () => rejectCode(new Error("Timed out waiting for browser callback.")),
    timeoutMs,
  );

  try {
    return await codePromise;
  } finally {
    clearTimeout(timeoutId);
    server.close();
  }
}

function renderAutoPostPage({ appCreationUrl, manifest }) {
  const escapedAction = escapeHtml(appCreationUrl);
  const escapedManifest = escapeHtml(JSON.stringify(manifest));

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GitHub App Setup</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; line-height: 1.5; }
      button { font: inherit; padding: 0.6rem 1rem; cursor: pointer; }
      ol { padding-left: 1.2rem; }
    </style>
  </head>
  <body>
    <h1>Create GitHub App</h1>
    <p>This page sends a pre-filled manifest to GitHub.</p>
    <ol>
      <li>Click <strong>Continue to GitHub</strong> below.</li>
      <li>On GitHub, review the form and click <strong>Create GitHub App</strong>.</li>
      <li>After GitHub redirects back here, return to your terminal.</li>
    </ol>
    <p>If GitHub shows a manifest error, no app is created. Fix it in the repo setup script and try again.</p>
    <form id="manifest-form" method="post" action="${escapedAction}">
      <input type="hidden" name="manifest" value="${escapedManifest}" />
      <button type="submit">Continue to GitHub</button>
    </form>
  </body>
</html>`;
}

async function exchangeManifestCode(code) {
  const response = await fetch(
    `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub manifest conversion failed (${response.status}): ${body}`,
    );
  }

  return response.json();
}

function upsertEnv(filePath, values) {
  const lines = existsSync(filePath)
    ? readFileSync(filePath, "utf8").split(/\r?\n/)
    : [];

  const nextLines = [...lines];

  for (const [key, rawValue] of Object.entries(values)) {
    const value = rawValue == null ? "" : String(rawValue);
    const line = `${key}=${value}`;
    const index = nextLines.findIndex((existing) =>
      existing.startsWith(`${key}=`),
    );

    if (index >= 0) nextLines[index] = line;
    else nextLines.push(line);
  }

  writeFileSync(
    filePath,
    `${nextLines.join("\n").replace(/\n+$/g, "")}\n`,
    "utf8",
  );
}

function tryOpenBrowser(url) {
  const platform = process.platform;

  if (platform === "darwin") {
    execFile("open", [url], () => {});
    return;
  }

  if (platform === "win32") {
    execFile("cmd", ["/c", "start", "", url], () => {});
    return;
  }

  execFile("xdg-open", [url], () => {});
}

function parseArgs(argv) {
  const result = {
    help: false,
    port: "",
    envPath: "",
    baseUrl: "",
    webhookUrl: "",
    appName: "",
    ownerType: "",
    org: "",
    open: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--port") result.port = argv[++i] || "";
    else if (arg === "--env") result.envPath = argv[++i] || "";
    else if (arg === "--base-url") result.baseUrl = argv[++i] || "";
    else if (arg === "--webhook-url") result.webhookUrl = argv[++i] || "";
    else if (arg === "--app-name") result.appName = argv[++i] || "";
    else if (arg === "--owner-type") result.ownerType = argv[++i] || "";
    else if (arg === "--org") result.org = argv[++i] || "";
    else if (arg === "--no-open") result.open = false;
  }

  return result;
}

function printHelp() {
  console.log(
    [
      "GitHub App setup helper",
      "",
      "Usage:",
      "  node scripts/setup-github-app.mjs [options]",
      "",
      "Options:",
      "  --base-url <url>         App base URL (default: http://localhost:3000)",
      "  --webhook-url <url>      Public webhook URL (default: <base-url>/api/webhook/github)",
      `  --app-name <name>        GitHub App display name (default: ${defaultAppName})`,
      "  --owner-type <type>      personal or org (default: personal)",
      "  --org <slug>             Organization slug when owner-type=org",
      "  --port <number>          Local callback port (default: 8787)",
      "  --env <path>             Write generated env vars to this file",
      "  --no-open                Do not try to open browser automatically",
      "  -h, --help               Show help",
      "",
      "Examples:",
      "  node scripts/setup-github-app.mjs --base-url http://localhost:3000",
      "  node scripts/setup-github-app.mjs --owner-type org --org my-company --base-url https://cms.example.com",
    ].join("\n"),
  );
}

function trimSlash(value) {
  return value.replace(/\/+$/g, "");
}

function isPrivateBaseUrl(value) {
  let hostname;
  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    return true;
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    return true;
  }

  if (hostname === "::1" || hostname === "[::1]") {
    return true;
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) {
    return true;
  }

  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 169 && b === 254
  );
}

function escapeNewlines(value) {
  return value.replace(/\r\n/g, "\n").replace(/\n/g, "\\n");
}

function wrapQuoted(value) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
