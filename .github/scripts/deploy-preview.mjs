import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const alias = process.argv[2];
if (!alias) {
  console.error('Usage: node deploy-preview.mjs <preview-alias>');
  process.exit(1);
}

const secretsFile = 'wrangler-secrets.json';
const workerName = 'pagescms-staging';
const fallbackUrl = `https://${alias}-${workerName}.nocodemonkeys1.workers.dev`;

function run(command) {
  console.log(`> ${command}`);
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
}

function uploadVersion() {
  return run(
    `pnpm exec wrangler versions upload --env staging --name ${workerName} --preview-alias ${alias} --secrets-file ${secretsFile}`,
  );
}

function hasPreviewUrl(output) {
  return /Version Preview Alias URL:|Version Preview URL:/.test(output);
}

let uploadOutput = uploadVersion();

if (!hasPreviewUrl(uploadOutput)) {
  console.log(
    'Preview URL not returned; bootstrapping staging worker (workers.dev + preview URLs)...',
  );
  run(
    `pnpm exec wrangler deploy --env staging --name ${workerName} --secrets-file ${secretsFile}`,
  );
  uploadOutput = uploadVersion();
}

console.log(uploadOutput);

const aliasMatch = uploadOutput.match(
  /Version Preview Alias URL: (https:\/\/\S+)/,
);
const versionMatch = uploadOutput.match(
  /Version Preview URL: (https:\/\/\S+)/,
);
const deploymentUrl =
  aliasMatch?.[1] ?? versionMatch?.[1] ?? fallbackUrl;

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `deployment-url=${deploymentUrl}\n`);
}

console.log(`Preview URL: ${deploymentUrl}`);

if (!hasPreviewUrl(uploadOutput)) {
  console.error(
    'Wrangler did not return a preview URL after bootstrap. Check that preview URLs are enabled for pagescms-staging.',
  );
  process.exit(1);
}
