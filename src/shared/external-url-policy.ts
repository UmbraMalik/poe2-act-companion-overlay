import {
  PROJECT_CHAT_URL,
  PROJECT_DONATION_ALERTS_URL,
  PROJECT_FEEDBACK_URL,
  PROJECT_RELEASES_URL,
  PROJECT_REPOSITORY_URL,
  PROJECT_SITE_URL,
  PROJECT_TELEGRAM_URL
} from './community-links';

type UrlTarget = {
  host: string;
  path: string;
  search: string;
};

function normalizePathname(pathname: string): string {
  const withoutTrailingSlash = pathname.replace(/\/+$/g, '');
  return withoutTrailingSlash || '/';
}

function parseUrlTarget(value: string): UrlTarget {
  const parsed = new URL(value);
  return {
    host: parsed.hostname.toLowerCase(),
    path: normalizePathname(parsed.pathname),
    search: parsed.search
  };
}

const projectSiteTarget = parseUrlTarget(PROJECT_SITE_URL);
const githubRepositoryTarget = parseUrlTarget(PROJECT_REPOSITORY_URL);
const exactAllowedTargets = [
  PROJECT_TELEGRAM_URL,
  PROJECT_CHAT_URL,
  PROJECT_FEEDBACK_URL,
  PROJECT_DONATION_ALERTS_URL
].map(parseUrlTarget);

function isSameOrChildPath(pathname: string, parentPath: string): boolean {
  return pathname === parentPath || pathname.startsWith(`${parentPath}/`);
}

function matchesExactTarget(target: UrlTarget, allowed: UrlTarget): boolean {
  return (
    target.host === allowed.host &&
    target.path === allowed.path &&
    target.search === allowed.search
  );
}

export function isAllowedExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  if (parsed.username || parsed.password || parsed.hash) {
    return false;
  }

  const target: UrlTarget = {
    host: parsed.hostname.toLowerCase(),
    path: normalizePathname(parsed.pathname),
    search: parsed.search
  };

  if (exactAllowedTargets.some((allowed) => matchesExactTarget(target, allowed))) {
    return true;
  }

  if (
    target.host === projectSiteTarget.host &&
    target.search === '' &&
    isSameOrChildPath(target.path, projectSiteTarget.path)
  ) {
    return true;
  }

  if (
    target.host === githubRepositoryTarget.host &&
    target.search === '' &&
    isSameOrChildPath(target.path, githubRepositoryTarget.path)
  ) {
    return true;
  }

  return false;
}

export const ALLOWED_EXTERNAL_URL_EXAMPLES = Object.freeze([
  PROJECT_SITE_URL,
  PROJECT_TELEGRAM_URL,
  PROJECT_CHAT_URL,
  PROJECT_FEEDBACK_URL,
  PROJECT_RELEASES_URL,
  PROJECT_REPOSITORY_URL,
  PROJECT_DONATION_ALERTS_URL
]);
