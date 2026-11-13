// Pull Request fields (docs/specs/026-plan/github-pull-requests.md "The Pull Request field", "How a card names its
// pull requests"): one GitHub pull request's address, read left to right with no regex, so a long paste never
// backtracks. Pure: nothing here calls GitHub.
import type { Item } from './item';
import type { ItemTypeDef } from './item-types';

export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
}

// The site and the path step a pull request's address has.
const HOST = 'github.com';
const PULL_STEP = 'pull';
export const PULL_REQUEST_OWNER_MAX = 39;
export const PULL_REQUEST_REPO_MAX = 100;
export const PULL_REQUEST_NUMBER_DIGITS_MAX = 10;
// The most a pasted address may be before it is not read at all (a pull request's own address is under 200).
export const PULL_REQUEST_TEXT_MAX = 2048;
// The most pull requests a card names (spec "How a card names its pull requests").
export const LINKED_PULL_REQUESTS_MAX = 10;

export const PULL_REQUEST_HINT =
  "Paste a pull request's address, like https://github.com/acme/web/pull/42";

const isDigit = (c: string) => c >= '0' && c <= '9';
const isLetter = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

// An owner: 1 to 39 letters, digits and hyphens.
function isOwner(s: string): boolean {
  if (s.length < 1 || s.length > PULL_REQUEST_OWNER_MAX) return false;
  for (const c of s) if (!isLetter(c) && !isDigit(c) && c !== '-') return false;
  return true;
}

// A repository: 1 to 100 letters, digits, `.`, `-` and `_`, never `.` or `..` alone.
function isRepo(s: string): boolean {
  if (s.length < 1 || s.length > PULL_REQUEST_REPO_MAX || s === '.' || s === '..') return false;
  for (const c of s)
    if (!isLetter(c) && !isDigit(c) && c !== '.' && c !== '-' && c !== '_') return false;
  return true;
}

// A number: a whole number from 1, at most 10 digits, no leading zero.
function numberOf(s: string): number | undefined {
  if (s.length < 1 || s.length > PULL_REQUEST_NUMBER_DIGITS_MAX || s[0] === '0') return undefined;
  for (const c of s) if (!isDigit(c)) return undefined;
  return Number(s);
}

// Drops `prefix` from the front of `s` (case aside), or undefined when `s` does not start with it.
function after(s: string, prefix: string): string | undefined {
  return s.slice(0, prefix.length).toLowerCase() === prefix ? s.slice(prefix.length) : undefined;
}

/**
 * The pull request an address names, or undefined. Takes `https://`, `http://` or none, `www.`, a page after the
 * number (`/files`), a query, a fragment and a trailing slash; anything with a space in it is not an address.
 */
export function parsePullRequestUrl(text: unknown): PullRequestRef | undefined {
  if (typeof text !== 'string') return undefined;
  let s = text.trim();
  if (s.length === 0 || s.length > PULL_REQUEST_TEXT_MAX) return undefined;
  for (const c of s) if (c === ' ' || c === '\t' || c === '\n' || c === '\r') return undefined;
  s = after(s, 'https://') ?? after(s, 'http://') ?? s;
  s = after(s, 'www.') ?? s;
  const rest = after(s, HOST);
  if (rest === undefined || rest[0] !== '/') return undefined;
  // The path ends at the first `?` or `#`.
  let end = rest.length;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '?' || rest[i] === '#') {
      end = i;
      break;
    }
  }
  const steps = rest.slice(1, end).split('/');
  const [owner, repo, pull, num] = steps;
  if (owner === undefined || repo === undefined || pull !== PULL_STEP || num === undefined)
    return undefined;
  if (!isOwner(owner) || !isRepo(repo)) return undefined;
  const number = numberOf(num);
  return number === undefined ? undefined : { owner, repo, number };
}

/** A repository's `owner/name` as written (trimmed), or undefined when it names none. */
export function parseRepositoryName(text: unknown): string | undefined {
  if (typeof text !== 'string') return undefined;
  const s = text.trim();
  const slash = s.indexOf('/');
  if (slash < 0 || s.indexOf('/', slash + 1) >= 0) return undefined;
  return isOwner(s.slice(0, slash)) && isRepo(s.slice(slash + 1)) ? s : undefined;
}

/** A pull request's canonical address, as a Pull Request field stores it. */
export const pullRequestUrl = (ref: PullRequestRef): string =>
  `https://${HOST}/${ref.owner}/${ref.repo}/${PULL_STEP}/${ref.number}`;

/** A pull request's short name, `owner/repo#42`, as a card reads it. */
export const pullRequestText = (ref: PullRequestRef): string =>
  `${ref.owner}/${ref.repo}#${ref.number}`;

/** The one key a pull request is counted by, case aside (GitHub's owners and repositories ignore case). */
export const pullRequestKey = (ref: PullRequestRef): string => pullRequestText(ref).toLowerCase();

/** A typed or pasted address as the field keeps it (canonical), or undefined when it names no pull request. */
export function pullRequestValueOf(text: unknown): string | undefined {
  const ref = parsePullRequestUrl(text);
  return ref ? pullRequestUrl(ref) : undefined;
}

/** A stored value's short name, or null when it holds no pull request. */
export function pullRequestValueText(value: unknown): string | null {
  const ref = parsePullRequestUrl(value);
  return ref ? pullRequestText(ref) : null;
}

/**
 * The pull requests a card names by its fields, in order: every Pull Request field's, then every Link field holding a
 * pull request's address, each counted once, at most `LINKED_PULL_REQUESTS_MAX`. (A connected plan adds the pull
 * requests that mention the card, card-mentions.ts.)
 */
export function cardPullRequests(
  item: Pick<Item, 'fields'>,
  type: Pick<ItemTypeDef, 'custom'> | undefined,
): PullRequestRef[] {
  const custom = type?.custom ?? [];
  const out: PullRequestRef[] = [];
  const seen = new Set<string>();
  for (const kind of ['pullrequest', 'link'] as const) {
    for (const f of custom) {
      if (f.kind !== kind) continue;
      const ref = parsePullRequestUrl(item.fields[f.id]);
      if (!ref || seen.has(pullRequestKey(ref))) continue;
      seen.add(pullRequestKey(ref));
      out.push(ref);
      if (out.length >= LINKED_PULL_REQUESTS_MAX) return out;
    }
  }
  return out;
}
