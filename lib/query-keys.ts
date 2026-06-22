export const queryKeys = {
  entry: (owner: string, repo: string, branch: string, path: string, name: string) =>
    ['entry', owner, repo, branch, path, name] as const,

  entryHistory: (owner: string, repo: string, branch: string, path: string, name: string) =>
    ['entryHistory', owner, repo, branch, path, name] as const,

  collection: (owner: string, repo: string, branch: string, name: string, collectionPath: string) =>
    ['collection', owner, repo, branch, name, collectionPath] as const,

  collectionAll: (owner: string, repo: string, branch: string, name: string) =>
    ['collection', owner, repo, branch, name] as const,

  media: (owner: string, repo: string, branch: string, mediaName: string, path: string) =>
    ['media', owner, repo, branch, mediaName, path] as const,

  mediaAll: (owner: string, repo: string, branch: string, mediaName: string) =>
    ['media', owner, repo, branch, mediaName] as const,

  reference: (owner: string, repo: string, branch: string, collectionName: string, queryString: string) =>
    ['reference', owner, repo, branch, collectionName, queryString] as const,

  collaborators: (owner: string, repo: string) =>
    ['collaborators', owner, repo] as const,

  collaboratorInvite: (token: string) =>
    ['collaboratorInvite', token] as const,

  cacheStatus: (owner: string, repo: string, branch: string) =>
    ['cacheStatus', owner, repo, branch] as const,
}
