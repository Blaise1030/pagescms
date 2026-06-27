import fs from 'node:fs';

const SECRET_NAMES = [
  'BASE_URL',
  'AUTH_PRODUCTION_URL',
  'OAUTH_PROXY_SECRET',
  'BETTER_AUTH_SECRET',
  'CRYPTO_KEY',
  'A_GITHUB_APP_PRIVATE_KEY',
  'A_GITHUB_APP_CLIENT_SECRET',
  'ADMIN_EMAILS',
  'A_GITHUB_APP_ID',
  'A_GITHUB_APP_NAME',
  'A_GITHUB_APP_CLIENT_ID',
  'EMAIL_FROM',
  'CACHE_CHECK_MIN',
  'CONFIG_CHECK_MIN',
  'FILE_TTL_MIN',
  'PERMISSIONS_TTL_MIN',
  'BRANCH_HEAD_TTL_MS',
  'REPO_META_TTL_MS',
  'WEBHOOK_PUSH_INCREMENTAL_MAX_FILES',
  'WEBHOOK_PUSH_SCOPED_INVALIDATION_MAX_FILES',
];

export function writeWranglerSecrets(overrides = {}) {
  const secrets = Object.fromEntries(
    SECRET_NAMES.map((name) => {
      const value = overrides[name] ?? process.env[name];
      return value === undefined || value === '' ? null : [name, value];
    }).filter(Boolean),
  );

  if (!secrets.BASE_URL) {
    throw new Error('BASE_URL is required for deploy secrets.');
  }

  if (!secrets.AUTH_PRODUCTION_URL) {
    secrets.AUTH_PRODUCTION_URL = secrets.BASE_URL;
  }

  if (!secrets.OAUTH_PROXY_SECRET && secrets.BASE_URL !== secrets.AUTH_PRODUCTION_URL) {
    throw new Error(
      'OAUTH_PROXY_SECRET is required when BASE_URL differs from AUTH_PRODUCTION_URL.',
    );
  }

  fs.writeFileSync('wrangler-secrets.json', JSON.stringify(secrets));
  return secrets;
}

if (process.argv[1]?.endsWith('write-wrangler-secrets.mjs')) {
  writeWranglerSecrets();
}
