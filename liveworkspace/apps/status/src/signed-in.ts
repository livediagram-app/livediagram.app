// The signed-in Explorer check (liveworkspace/docs/specs/009-status/status.md "The signed-in check"): a fresh guest
// token through an app's own guest hand-off, then an index call with it as the Bearer, so the index's token check is
// exercised. The guest's cookie is the Worker's secret: it goes to accounts' hand-off on PLATFORM_ORIGIN and nowhere
// else, and is never stored or logged.

import {
  type CheckResult,
  handoffOrigin,
  type Probe,
  resolveProbeUrl,
  type Service,
  type WorkerProbe,
} from '@liveworkspace/status';
import { HANDOFF_TIMEOUT_MS, USER_AGENT } from './config';
import type { Env } from './env';
import { environmentOfWorker } from './environment';
import { type Clock, type Fetch, probeOne, type ProbeTarget, withTimeout } from './probe';

export const GUEST_COOKIE = 'lw_guest';

export type SignedInOptions = {
  // liveworkspace.app's origin: the index's and accounts', the only place the cookie is sent.
  platformOrigin: string;
  // The app whose /api/auth/guest starts the hand-off.
  handoffOrigin: string;
  cookie: string;
  fetch: Fetch;
  now?: Clock;
  stepTimeoutMs?: number;
};

// One step of the hand-off: a GET whose redirect is read, never followed, its body unread.
async function step(
  url: URL,
  headers: Record<string, string>,
  options: SignedInOptions,
): Promise<Response> {
  const res = await withTimeout(
    (signal) =>
      options.fetch(
        new Request(url, {
          method: 'GET',
          redirect: 'manual',
          headers: { 'User-Agent': USER_AGENT, ...headers },
          signal,
        }),
      ),
    options.stepTimeoutMs ?? HANDOFF_TIMEOUT_MS,
  );
  await res.body?.cancel().catch(() => {});
  return res;
}

function redirectOf(res: Response, base: URL): URL | null {
  const location = res.headers.get('Location');
  if (res.status < 300 || res.status >= 400 || !location) return null;
  try {
    return new URL(location, base);
  } catch {
    return null;
  }
}

/** A fresh guest token, as an app's page gets one: the app's door redirects to accounts' hand-off, which answers a
 *  redirect back with the token and our state in the fragment. Null when any step answers otherwise, or the hand-off
 *  isn't on `platformOrigin` (then the cookie isn't sent at all). Rejects on a timeout or a network error. */
export async function mintGuestToken(options: SignedInOptions): Promise<string | null> {
  const state = crypto.randomUUID().replaceAll('-', '');
  const start = new URL('/api/auth/guest', options.handoffOrigin);
  start.searchParams.set('state', state);
  const accounts = redirectOf(await step(start, {}, options), start);
  if (!accounts || accounts.origin !== new URL(options.platformOrigin).origin) return null;
  const back = redirectOf(
    await step(accounts, { Cookie: `${GUEST_COOKIE}=${options.cookie}` }, options),
    accounts,
  );
  if (!back) return null;
  const fragment = new URLSearchParams(back.hash.slice(1));
  if (fragment.get('state') !== state) return null;
  return fragment.get('guest_token') || null;
}

/** The signed-in check. Never throws: a hand-off that gives no token is `down` with `sign_in` and its time; else the
 *  index call is judged as any read, with the probe's own timeout, and its time is the one kept. */
export async function signedInCheck(
  probe: WorkerProbe,
  options: SignedInOptions,
): Promise<CheckResult> {
  const now = options.now ?? Date.now;
  const started = now();
  const token = await mintGuestToken(options).catch(() => null);
  if (!token) {
    return {
      state: 'down',
      code: null,
      ms: Math.max(0, Math.round(now() - started)),
      error: 'sign_in',
    };
  }
  const call: Probe = { kind: 'read', url: probe.url, method: 'GET', ok: probe.ok, json: true };
  const bearer: Fetch = (request) => {
    const signed = new Request(request);
    signed.headers.set('Authorization', `Bearer ${token}`);
    return options.fetch(signed);
  };
  return probeOne(
    call,
    resolveProbeUrl(probe, options.platformOrigin),
    bearer,
    now,
    probe.timeoutMs,
  );
}

/** A service's signed-in check as a run's target, or null without the secret (the check is then skipped). */
export function signedInTarget(
  env: Env,
  service: Service & { worker: WorkerProbe },
  fetchImpl: Fetch,
  now?: Clock,
): ProbeTarget | null {
  const cookie = env.STATUS_GUEST_COOKIE;
  if (!cookie) return null;
  const probe = service.worker;
  return {
    id: service.id,
    probe: { kind: 'read', url: probe.url, method: 'GET', ok: probe.ok, json: true },
    url: resolveProbeUrl(probe, env.PLATFORM_ORIGIN),
    fetch: fetchImpl,
    run: () =>
      signedInCheck(probe, {
        platformOrigin: env.PLATFORM_ORIGIN,
        handoffOrigin: handoffOrigin(probe, environmentOfWorker(env)),
        cookie,
        fetch: fetchImpl,
        now,
      }),
  };
}
