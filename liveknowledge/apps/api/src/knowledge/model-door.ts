// The one way out to a model (docs/specs/030-knowledgebase/search-and-ask.md "Providers"): the API host of the
// provider the knowledgebase's key is for, over HTTPS, and nowhere else, whatever a request is built to say. The
// team's key and their pages' passages ride on these requests, so the address is checked where the request leaves.
// The provider is the one stored beside the key (ai-settings.ts), never anything a client sent: a key therefore
// reaches only its own provider's host, and never the other's. Tests stub the global `fetch`.
import { modelProvider, type KeyProviderId } from '@liveknowledge/knowledge';

const addressOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const refuse = () => Promise.reject(new Error('outbound host refused'));

// Whether `url` is the provider's API, over HTTPS on its default port.
const allowed = (url: URL, provider: KeyProviderId): boolean =>
  url.protocol === 'https:' && url.host === modelProvider(provider).host;

/** `fetch`, refusing any address that is not the provider's API. */
export const modelDoor =
  (provider: KeyProviderId): typeof fetch =>
  (input, init) =>
    allowed(new URL(addressOf(input)), provider) ? fetch(input, init) : refuse();

/** The var only the e2e stack sets (scripts/e2e-stack.mjs): the origin of its stand-in for the providers' APIs.
 *  One var for both: the stand-in tells them apart by the path asked for. */
export type ModelDoorEnv = { E2E_CLAUDE_STAND_IN?: string };

// The stand-in's origin, or undefined for anything that is not plain HTTP on a port of this machine's loopback: a
// value that names another host (a deployment given the var by mistake, or on purpose) is ignored, so the door stays
// the providers' own.
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
 * The door for this Worker's environment and the knowledgebase's stored provider: `modelDoor`, except under the e2e
 * stack, whose `E2E_CLAUDE_STAND_IN` names a stand-in on the loopback (docs/specs/003-system-architecture/e2e-smoke.md
 * "The model stand-in"). There a request for the provider's API goes to the stand-in instead, and nothing reaches a
 * provider at all; an address that is not the provider's API is refused either way. The var is in no wrangler.toml,
 * hosted var or secret list.
 */
export function modelDoorFor(env: ModelDoorEnv, provider: KeyProviderId): typeof fetch {
  const standIn = standInOrigin(env.E2E_CLAUDE_STAND_IN);
  if (!standIn) return modelDoor(provider);
  return (input, init) => {
    const url = new URL(addressOf(input));
    return allowed(url, provider)
      ? fetch(`${standIn}${url.pathname}${url.search}`, init)
      : refuse();
  };
}

/** The e2e stack's stand-in origin, or undefined anywhere else: where built-in AI is answered under the stack
 *  (setup-built-in-ai.ts), since the `AI` binding has no door to swap. */
export const e2eStandInOrigin = (env: ModelDoorEnv): string | undefined =>
  standInOrigin(env.E2E_CLAUDE_STAND_IN);

/** Whether this Worker runs under the e2e stack: its stand-in is named, on the loopback. No deployment does. */
export const underE2eStack = (env: ModelDoorEnv): boolean =>
  standInOrigin(env.E2E_CLAUDE_STAND_IN) !== undefined;

/** The header an e2e spec sends with Verify to say when the page was verified (routes/knowledge-page-routes.ts). */
export const E2E_VERIFIED_AT_HEADER = 'X-E2E-Verified-At';

/**
 * When a Verify counts from: now. Under the e2e stack alone a spec may name an earlier moment in
 * `X-E2E-Verified-At` (epoch ms), so a page can be due for review without a test waiting 30 days; anywhere else the
 * header is ignored, and a moment in the future always is.
 */
export function verifyMoment(env: ModelDoorEnv, request: Request, now: number): number {
  if (!underE2eStack(env)) return now;
  const asked = Number(request.headers.get(E2E_VERIFIED_AT_HEADER));
  return Number.isInteger(asked) && asked > 0 && asked <= now ? asked : now;
}
