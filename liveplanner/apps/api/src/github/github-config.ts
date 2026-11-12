// liveplanner's GitHub App settings and limits (docs/specs/026-plan/github-pull-requests.md "The App", "Limits";
// blueprint "Part 2" "Configuration"). The feature is on only with every secret set and the GITHUB_LINKS namespace
// bound; otherwise `githubConfig` is null and every GitHub door answers 404, logging nothing.
import type { Env } from '../types';

/** The largest delivery body read, declared or counted (GitHub's own cap is 25 MB; ours are small). */
export const WEBHOOK_BODY_MAX = 1024 * 1024;
/** The repositories one plan connects. */
export const REPOSITORIES_MAX = 20;
/** The plans one repository connects to: bounds a delivery's fan-out. */
export const PLANS_PER_REPOSITORY_MAX = 20;
/** One page of GitHub's repository list (`per_page`'s cap): what a connection lists. */
export const INSTALLATION_REPOSITORIES_LISTED = 100;
/** The plans an uninstall reaches. */
export const INSTALLATION_PLANS_MAX = 100;
/** How long a connect's state lives: long enough to install the App on GitHub. */
export const CONNECT_STATE_TTL_MS = 10 * 60 * 1000;
/** The live states a plan keeps; the oldest goes past it. */
export const CONNECT_STATES_MAX = 20;
/** How long a plan remembers a delivery id: GitHub redelivers deliveries up to 3 days old. */
export const DELIVERY_KEEP_MS = 3 * 24 * 60 * 60 * 1000;
/** Every call to GitHub gives up after this. */
export const GITHUB_FETCH_TIMEOUT_MS = 10_000;

export const GITHUB_API = 'https://api.github.com';
export const GITHUB_WEB = 'https://github.com';

export type GithubConfig = {
  appId: string;
  slug: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  links: KVNamespace;
};

const set = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** The App's settings, or null when any is missing: the feature off. */
export function githubConfig(env: Partial<Env>): GithubConfig | null {
  const {
    GITHUB_APP_ID: appId,
    GITHUB_APP_SLUG: slug,
    GITHUB_APP_PRIVATE_KEY: privateKey,
    GITHUB_APP_CLIENT_ID: clientId,
    GITHUB_APP_CLIENT_SECRET: clientSecret,
    GITHUB_WEBHOOK_SECRET: webhookSecret,
    GITHUB_LINKS: links,
  } = env;
  if (!set(appId) || !set(slug) || !set(privateKey) || !set(clientId) || !set(clientSecret))
    return null;
  if (!set(webhookSecret) || !links) return null;
  return {
    appId: appId.trim(),
    slug: slug.trim(),
    privateKey,
    clientId: clientId.trim(),
    clientSecret,
    webhookSecret,
    links,
  };
}
