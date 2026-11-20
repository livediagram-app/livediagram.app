// The one way out to a model (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): the Anthropic API's host, over
// HTTPS, and nowhere else, whatever a request is built to say. The team's key and their pages' passages ride on
// these requests, so the address is checked where the request leaves. Tests stub the global `fetch`.
export const CLAUDE_HOST = 'api.anthropic.com';

const addressOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** `fetch`, refusing any address that is not the Anthropic API's. */
export const claudeDoor: typeof fetch = (input, init) => {
  const url = new URL(addressOf(input));
  if (url.protocol !== 'https:' || url.host !== CLAUDE_HOST)
    return Promise.reject(new Error('outbound host refused'));
  return fetch(input, init);
};

/** The var only the e2e stack sets (scripts/e2e-stack.mjs): the origin of its stand-in for the Anthropic API. */
export type ClaudeDoorEnv = { E2E_CLAUDE_STAND_IN?: string };

// The stand-in's origin, or undefined for anything that is not plain HTTP on a port of this machine's loopback: a
// value that names another host (a deployment given the var by mistake, or on purpose) is ignored, so the door stays
// the Anthropic API's.
function standInOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  return url.protocol === 'http:' && loopback && url.port ? url.origin : undefined;
}

/**
 * The door for this Worker's environment: `claudeDoor`, except under the e2e stack, whose `E2E_CLAUDE_STAND_IN` names
 * a stand-in on the loopback (docs/specs/003-system-architecture/e2e-smoke.md "The Claude stand-in"). There a request
 * for the Anthropic API goes to the stand-in instead, and nothing reaches Anthropic at all; an address that is not
 * the Anthropic API's is refused either way. The var is in no wrangler.toml, hosted var or secret list.
 */
export function claudeDoorFor(env: ClaudeDoorEnv): typeof fetch {
  const standIn = standInOrigin(env.E2E_CLAUDE_STAND_IN);
  if (!standIn) return claudeDoor;
  return (input, init) => {
    const url = new URL(addressOf(input));
    if (url.protocol !== 'https:' || url.host !== CLAUDE_HOST)
      return Promise.reject(new Error('outbound host refused'));
    return fetch(`${standIn}${url.pathname}${url.search}`, init);
  };
}

/** Whether this Worker runs under the e2e stack: its stand-in is named, on the loopback. No deployment does. */
export const underE2eStack = (env: ClaudeDoorEnv): boolean =>
  standInOrigin(env.E2E_CLAUDE_STAND_IN) !== undefined;

/** The header an e2e spec sends with Verify to say when the page was verified (routes/knowledge-page-routes.ts). */
export const E2E_VERIFIED_AT_HEADER = 'X-E2E-Verified-At';

/**
 * When a Verify counts from: now. Under the e2e stack alone a spec may name an earlier moment in
 * `X-E2E-Verified-At` (epoch ms), so a page can be due for review without a test waiting 30 days; anywhere else the
 * header is ignored, and a moment in the future always is.
 */
export function verifyMoment(env: ClaudeDoorEnv, request: Request, now: number): number {
  if (!underE2eStack(env)) return now;
  const asked = Number(request.headers.get(E2E_VERIFIED_AT_HEADER));
  return Number.isInteger(asked) && asked > 0 && asked <= now ? asked : now;
}
