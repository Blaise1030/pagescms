import brand from "../brand.json";

export const APP_NAME = brand.appName;
export const APP_DESCRIPTION = brand.appDescription;
export const APP_SHORT_DESCRIPTION = brand.appShortDescription;

export const FORK_OWNER = brand.fork.owner;
export const FORK_REPO = brand.fork.repo;
export const FORK_COPYRIGHT = brand.fork.copyright;
export const FORK_TAGLINE = brand.fork.tagline;
export const FORK_REPOSITORY = `${FORK_OWNER}/${FORK_REPO}` as const;
export const FORK_URL = `https://github.com/${FORK_REPOSITORY}`;

export const UPSTREAM_APP_NAME = brand.upstream.appName;
export const UPSTREAM_AUTHOR = brand.upstream.author;
export const UPSTREAM_AUTHOR_GITHUB = brand.upstream.authorGithub;
export const UPSTREAM_REPOSITORY = `${brand.upstream.owner}/${brand.upstream.repo}` as const;
export const UPSTREAM_URL = `https://github.com/${UPSTREAM_REPOSITORY}`;
export const UPSTREAM_WEBSITE = brand.upstream.website;
export const UPSTREAM_DOCS_URL = brand.upstream.docsUrl;

export const COMMIT_VIA_LABEL = `via ${APP_NAME}`;
