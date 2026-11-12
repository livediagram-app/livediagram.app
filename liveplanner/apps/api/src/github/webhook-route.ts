// liveplanner's GitHub App doors (docs/specs/026-plan/github-pull-requests.md "Deliveries", "Connecting a
// repository"; blueprint "Part 2" "The worker's doors"), answered by index.ts before identity, as an Incoming
// Webhook call is: neither carries a person.
//
// `POST /api/github/webhook`: a delivery. Capped at 1 MB, declared or read, and its signature checked on the raw
// bytes in constant time before anything parses it. Refused signatures are limited per network
// (refused-signatures.ts): a network over its limit is turned away before its body is read. The plans it reaches come from the reverse index; each plan's
// room checks it against its own connection and acts once per delivery id.
//
// `GET /api/github/callback`: GitHub sends the person back here after installing the App. The state names the plan;
// the plan's room spends it, checks the installation as that person and as the App, and saves the connection. The
// answer is a redirect back to the plan.
//
// With the App's settings missing, both answer 404 and nothing is logged.
import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import { appBaseUrl } from '../email/client';
import { planRoom } from '../plan-client';
import type { GithubRoomAnswer } from '../plan-room/github/github-room';
import { json, methodNotAllowed, notFound } from '../responses';
import type { Env } from '../types';
import {
  githubConfig,
  INSTALLATION_PLANS_MAX,
  PLANS_PER_REPOSITORY_MAX,
  WEBHOOK_BODY_MAX,
  type GithubConfig,
} from './github-config';
import { githubId, isDeliveryId, readDelivery, type GithubDelivery } from './github-delivery';
import { plansOfInstallation, plansOfRepository, repoKey } from './github-links';
import { countRefusal, isTurnedAway, refusalNetwork } from './refused-signatures';
import { SIGNATURE_HEADER, signatureHex, webhookSignatureOk } from './webhook-signature';

const answer = (status: number, body: Record<string, unknown>): Response =>
  json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function parsed(body: Uint8Array): { ok: true; value: unknown } | { ok: false } {
  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(body)),
    };
  } catch {
    return { ok: false };
  }
}

// The plans a delivery may reach, from the reverse index.
async function plansFor(config: GithubConfig, d: GithubDelivery): Promise<string[]> {
  if (d.event === 'installation')
    return plansOfInstallation(config.links, d.installationId, INSTALLATION_PLANS_MAX);
  const lists = await Promise.all(
    d.repositoryIds.map((id) => plansOfRepository(config.links, id, PLANS_PER_REPOSITORY_MAX)),
  );
  return [...new Set(lists.flat())];
}

const limited = (): Response =>
  json(
    { error: 'github_rate_limited' },
    { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
  );

// A room's failure as its name and message, cut short: enough to say why, never a payload.
const ERROR_TEXT_MAX = 500;
const errorText = (reason: unknown): string =>
  (reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason)).slice(
    0,
    ERROR_TEXT_MAX,
  );

async function webhook(request: Request, env: Env, config: GithubConfig): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed();
  // A network refused too often is turned away before its body is read or hashed; GitHub's own never is.
  const network = refusalNetwork(request);
  const now = Date.now();
  if (network !== null && isTurnedAway(network, now)) return limited();
  const refused = async (): Promise<Response> =>
    network !== null && (await countRefusal(env, network, now))
      ? limited()
      : answer(401, { error: 'github_signature_invalid' });
  const header = request.headers.get(SIGNATURE_HEADER);
  if (!signatureHex(header)) return refused();
  const tooLarge = () => answer(413, { error: 'github_too_large' });
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > WEBHOOK_BODY_MAX) return tooLarge();
  const body = request.body
    ? await readCappedBody(request.body as ReadableStream<Uint8Array>, WEBHOOK_BODY_MAX)
    : new Uint8Array();
  if (!body) return tooLarge();
  // Nothing of the body is read before this.
  if (!(await webhookSignatureOk(config.webhookSecret, body, header))) return refused();
  const id = request.headers.get('X-GitHub-Delivery');
  if (!isDeliveryId(id)) return answer(400, { error: 'github_delivery_invalid' });
  const payload = parsed(body);
  if (!payload.ok) return answer(400, { error: 'github_body_invalid' });
  const event = request.headers.get('X-GitHub-Event');
  if (event === 'ping') return answer(200, { ok: true });
  const delivery = readDelivery(event, id, payload.value);
  if (!delivery) return answer(202, { delivered: 0 });
  const plans = await plansFor(config, delivery);
  const settled = await Promise.allSettled(
    plans.map((planId) => planRoom(env, planId).github({ kind: 'delivery', delivery })),
  );
  const outcomes: Partial<Record<GithubRoomAnswer | 'threw', number>> = {};
  const disowned: Promise<void>[] = [];
  settled.forEach((s, i) => {
    const outcome = s.status === 'fulfilled' ? s.value : 'threw';
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    // A plan that does not connect the repository has no business in its key: a stale or forged entry goes.
    const single = delivery.event === 'pull_request' || delivery.event === 'check_suite';
    if (outcome === 'not_connected' && single)
      disowned.push(config.links.delete(repoKey(delivery.repositoryIds[0]!, plans[i]!)));
  });
  await Promise.allSettled(disowned);
  for (const s of settled) {
    if (s.status === 'rejected')
      console.error('[github] delivery.threw', {
        event: delivery.event,
        action: delivery.action,
        error: errorText(s.reason),
      });
  }
  console.info('[github] delivery', {
    event: delivery.event,
    action: delivery.action,
    plans: plans.length,
    ...outcomes,
  });
  if (outcomes.threw) return answer(502, { error: 'github_delivery_failed' });
  return answer(202, { delivered: outcomes.accepted ?? 0 });
}

// A plan id as the app makes them, then the state's secret (32 bytes, base64url).
const PLAN_ID_MAX = 200;
const SECRET_LENGTH = 43;
const CODE_MAX = 200;

function isUrlSafe(text: string, max: number): boolean {
  if (text.length === 0 || text.length > max) return false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    const ok =
      (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45 || c === 95;
    if (!ok) return false;
  }
  return true;
}

/** The state's plan id and secret, or null when it is not `{plan id}.{secret}`. */
export function readState(state: string | null): { planId: string; secret: string } | null {
  if (!state) return null;
  const dot = state.lastIndexOf('.');
  const planId = state.slice(0, dot);
  const secret = state.slice(dot + 1);
  if (dot < 1 || !isUrlSafe(planId, PLAN_ID_MAX)) return null;
  if (secret.length !== SECRET_LENGTH || !isUrlSafe(secret, SECRET_LENGTH)) return null;
  return { planId, secret };
}

const redirect = (env: Env, planId: string, outcome: string): Response =>
  new Response(null, {
    status: 302,
    headers: {
      Location: `${appBaseUrl(env)}/project/${encodeURIComponent(planId)}#github=${outcome}`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });

async function callback(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed();
  const state = readState(url.searchParams.get('state'));
  if (!state) return answer(400, { error: 'github_state_invalid' });
  if (url.searchParams.get('setup_action') === 'request') {
    console.info('[github] connect', { outcome: 'requested' });
    return redirect(env, state.planId, 'requested');
  }
  const code = url.searchParams.get('code') ?? '';
  const installationId = githubId(Number(url.searchParams.get('installation_id')));
  if (!isUrlSafe(code, CODE_MAX) || installationId === undefined) {
    console.info('[github] connect', { outcome: 'failed', why: 'query' });
    return redirect(env, state.planId, 'failed');
  }
  const outcome = await planRoom(env, state.planId).github({
    kind: 'callback',
    secret: state.secret,
    code,
    installationId,
  });
  return redirect(env, state.planId, outcome === 'connected' ? 'connected' : 'failed');
}

/** `/api/github/*`: a delivery, the connect's callback, or 404 (always, while the App's settings are missing). */
export async function handleGithub(request: Request, env: Env): Promise<Response> {
  const config = githubConfig(env);
  if (!config) return notFound();
  const url = new URL(request.url);
  if (url.pathname === '/api/github/webhook') return webhook(request, env, config);
  if (url.pathname === '/api/github/callback') return callback(request, env, url);
  return notFound();
}
