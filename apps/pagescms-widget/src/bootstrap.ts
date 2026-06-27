import type { BootstrapData } from "./types";

export async function loadBootstrap(
  cmsOrigin: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<BootstrapData> {
  if (!owner || !repo || !branch) {
    return { create: [], routes: [] };
  }

  const endpoint = `${cmsOrigin}/api/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/site`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error("Failed to load site actions.");
    }

    const payload = (await response.json()) as {
      data?: {
        create?: BootstrapData["create"];
        routes?: BootstrapData["routes"];
      };
    };

    return {
      create: Array.isArray(payload?.data?.create) ? payload.data.create : [],
      routes: Array.isArray(payload?.data?.routes) ? payload.data.routes : [],
    };
  } catch {
    return { create: [], routes: [] };
  }
}
