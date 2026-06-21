/**
 * Persist and synchronize repository configuration between GitHub and the DB.
 */

import { Config } from "@/types/config";
import { db } from "@/db";
import { configTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { configVersion, normalizeConfig, parseConfig } from "@/lib/config";
import { decodeBase64Utf8 } from "@/lib/encoding";

const CONFIG_CACHE_TTL_MS =
  parseInt(process.env.CONFIG_CACHE_TTL ?? "30", 10) * 1000;

const configMemCache = new Map<string, { value: Config; expiresAt: number }>();

const getConfigFromDb = async (
  owner: string,
  repo: string,
  branch: string,
): Promise<Config | null> => {
  if (!owner || !repo || !branch)
    throw new Error(`Owner, repo, and branch must all be provided.`);

  const cacheKey = `${owner}::${repo}::${branch}`;
  const cached = configMemCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const config = await db.query.configTable.findFirst({
    where: and(
      eq(configTable.owner, owner.toLowerCase()),
      eq(configTable.repo, repo.toLowerCase()),
      eq(configTable.branch, branch),
    ),
  });

  if (!config) return null;

  const parsedConfig: Config = {
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    sha: config.sha,
    version: config.version,
    object: JSON.parse(config.object),
    lastCheckedAt: config.lastCheckedAt,
  };

  configMemCache.set(cacheKey, {
    value: parsedConfig,
    expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
  });

  return parsedConfig;
};

const saveConfig = async (
  config: Config,
): Promise<Config> => {
  await db.insert(configTable).values({
    owner: config.owner.toLowerCase(),
    repo: config.repo.toLowerCase(),
    branch: config.branch,
    sha: config.sha,
    version: config.version,
    object: JSON.stringify(config.object),
    lastCheckedAt: new Date(),
  }).onConflictDoUpdate({
    target: [configTable.owner, configTable.repo, configTable.branch],
    set: {
      sha: config.sha,
      version: config.version,
      object: JSON.stringify(config.object),
      lastCheckedAt: new Date(),
    },
  });

  configMemCache.delete(`${config.owner.toLowerCase()}::${config.repo.toLowerCase()}::${config.branch}`);

  return config;
}

const updateConfig = async (
  config: Config,
): Promise<Config> => {
  await db.update(configTable).set({
    sha: config.sha,
    version: config.version,
    object: JSON.stringify(config.object),
    lastCheckedAt: new Date(),
  }).where(
    and(
      eq(configTable.owner, config.owner.toLowerCase()),
      eq(configTable.repo, config.repo.toLowerCase()),
      eq(configTable.branch, config.branch),
    ),
  );

  configMemCache.delete(`${config.owner.toLowerCase()}::${config.repo.toLowerCase()}::${config.branch}`);

  return config;
}

const touchConfigCheck = async (
  owner: string,
  repo: string,
  branch: string,
) => {
  await db.update(configTable).set({
    lastCheckedAt: new Date(),
  }).where(
    and(
      eq(configTable.owner, owner.toLowerCase()),
      eq(configTable.repo, repo.toLowerCase()),
      eq(configTable.branch, branch),
    ),
  );
};

type GetConfigOptions = {
  sync?: boolean;
  getToken?: () => Promise<string>;
  bootstrapOnMiss?: boolean;
  ttlMs?: number;
  backgroundRefreshWhenStale?: boolean;
};

const DEFAULT_CONFIG_CHECK_TTL_MS = parseInt(
  process.env.CONFIG_CHECK_MIN ||
    process.env.CFG_CHECK_MIN ||
    process.env.CONFIG_CHECK_TTL ||
    "5",
  10,
) * 60 * 1000;

const isConfigCheckDue = (lastCheckedAt?: Date, ttlMs = DEFAULT_CONFIG_CHECK_TTL_MS) => {
  if (!lastCheckedAt) return true;
  return Date.now() - new Date(lastCheckedAt).getTime() > ttlMs;
};

const configSyncInFlight = new Map<string, Promise<Config | null>>();
const getConfigSyncKey = (owner: string, repo: string, branch: string) =>
  `${owner.toLowerCase()}::${repo.toLowerCase()}::${branch}`;

const fetchConfigFromGithub = async (
  owner: string,
  repo: string,
  branch: string,
  token: string,
): Promise<Pick<Config, "sha" | "object"> | null> => {
  const octokit = createOctokitInstance(token);
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ".pages.yml",
      ref: branch,
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (Array.isArray(response.data)) {
      throw new Error("Expected .pages.yml to be a file but found a directory.");
    }
    if (response.data.type !== "file") {
      throw new Error("Invalid .pages.yml response type.");
    }

    const configFile = decodeBase64Utf8(response.data.content);
    const parsed = parseConfig(configFile);
    const configObject = normalizeConfig(parsed.document.toJSON());

    return {
      sha: response.data.sha,
      object: configObject,
    };
  } catch (error: any) {
    if (error?.status === 404 && error?.response?.data?.message === "Not Found") {
      return null;
    }
    throw error;
  }
};

const getConfig = async (
  owner: string,
  repo: string,
  branch: string,
  options?: GetConfigOptions,
): Promise<Config | null> => {
  const sync = options?.sync ?? false;
  const getToken = options?.getToken;
  const bootstrapOnMiss = options?.bootstrapOnMiss ?? true;
  if (sync && !getToken) throw new Error("getToken is required when sync is enabled.");
  const resolveToken = getToken;
  const requireToken = getToken!;

  const normalizedOwner = owner.toLowerCase();
  const normalizedRepo = repo.toLowerCase();
  const key = getConfigSyncKey(normalizedOwner, normalizedRepo, branch);
  const existing = configSyncInFlight.get(key);
  if (existing) return existing;

  const run = (async (): Promise<Config | null> => {
    const cachedConfig = await getConfigFromDb(normalizedOwner, normalizedRepo, branch);
    if (!sync) {
      if (cachedConfig?.version === configVersion) return cachedConfig;
      if (!resolveToken || !bootstrapOnMiss) return cachedConfig;

      const token = await resolveToken();
      if (!token) throw new Error("Token not found");

      const latest = await fetchConfigFromGithub(owner, repo, branch, token);
      if (!latest) return null;

      const nextConfig: Config = {
        owner: normalizedOwner,
        repo: normalizedRepo,
        branch,
        sha: latest.sha,
        version: configVersion ?? "0.0",
        object: latest.object,
      };
      await saveConfig(nextConfig);
      return nextConfig;
    }

    const ttlMs = options?.ttlMs ?? DEFAULT_CONFIG_CHECK_TTL_MS;
    const backgroundRefreshWhenStale = options?.backgroundRefreshWhenStale ?? false;

    if (
      cachedConfig &&
      cachedConfig.version === configVersion &&
      !isConfigCheckDue(cachedConfig.lastCheckedAt, ttlMs)
    ) {
      return cachedConfig;
    }

    if (
      cachedConfig &&
      cachedConfig.version === configVersion &&
      backgroundRefreshWhenStale
    ) {
      // Return stale cache immediately and refresh async to reduce branch-layout blocking.
      void (async () => {
        try {
          const token = await requireToken();
          if (!token) return;
          const latest = await fetchConfigFromGithub(owner, repo, branch, token);
          if (!latest) {
            await db.delete(configTable).where(
              and(
                eq(configTable.owner, normalizedOwner),
                eq(configTable.repo, normalizedRepo),
                eq(configTable.branch, branch),
              ),
            );
            return;
          }
          if (cachedConfig.sha === latest.sha) {
            await touchConfigCheck(owner, repo, branch);
            return;
          }
          const nextConfig: Config = {
            owner: normalizedOwner,
            repo: normalizedRepo,
            branch,
            sha: latest.sha,
            version: configVersion ?? "0.0",
            object: latest.object,
          };
          await updateConfig(nextConfig);
        } catch {
          // Ignore background refresh failures; stale cached config remains usable.
        }
      })();

      return cachedConfig;
    }

    const token = await requireToken();
    if (!token) throw new Error("Token not found");

    const latest = await fetchConfigFromGithub(owner, repo, branch, token);
    if (!latest) {
      if (cachedConfig) {
        await db.delete(configTable).where(
          and(
            eq(configTable.owner, normalizedOwner),
            eq(configTable.repo, normalizedRepo),
            eq(configTable.branch, branch),
          ),
        );
      }
      return null;
    }

    if (cachedConfig && cachedConfig.version === configVersion && cachedConfig.sha === latest.sha) {
      await touchConfigCheck(normalizedOwner, normalizedRepo, branch);
      return {
        ...cachedConfig,
        lastCheckedAt: new Date(),
      };
    }

    const nextConfig: Config = {
      owner: normalizedOwner,
      repo: normalizedRepo,
      branch,
      sha: latest.sha,
      version: configVersion ?? "0.0",
      object: latest.object,
    };

    if (cachedConfig) {
      await updateConfig(nextConfig);
    } else {
      await saveConfig(nextConfig);
    }

    return nextConfig;
  })();

  configSyncInFlight.set(key, run);
  try {
    return await run;
  } finally {
    configSyncInFlight.delete(key);
  }
};

export { getConfig, saveConfig, updateConfig, touchConfigCheck };
