import { execSync } from 'node:child_process';
import { writeWranglerSecrets } from './write-wrangler-secrets.mjs';

const staging = process.argv.includes('--staging');

writeWranglerSecrets();

const deployArgs = staging
  ? ['deploy', '--env', 'staging', '--name', 'pagescms-staging']
  : ['deploy'];

const secretArgs = staging
  ? ['secret', 'bulk', 'wrangler-secrets.json', '--env', 'staging', '--name', 'pagescms-staging']
  : ['secret', 'bulk', 'wrangler-secrets.json'];

function runWrangler(args) {
  execSync(['pnpm', 'exec', 'wrangler', ...args].join(' '), {
    stdio: 'inherit',
    env: process.env,
  });
}

// Deploy the worker first so secret updates are not blocked by an undeployed version.
runWrangler(deployArgs);
runWrangler(secretArgs);
