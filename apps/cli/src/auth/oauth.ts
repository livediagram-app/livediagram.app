// The CLI's OAuth client (docs/specs/015-api/blueprints/cli.md "The CLI's OAuth client", CLI34 to CLI36): a token
// from the host's authorization server, by the browser (loopback PKCE with the built-in client) or by the device
// grant, for the profile's host. Both end in an ordinary lvd_ API token; what happens with it is login's.

import {
  randomBase64Url,
  pkceChallenge,
  CLI_CLIENT_ID,
  DEVICE_CODE_GRANT,
  DEVICE_CODE_TTL_S,
  DEVICE_SLOW_DOWN_S,
} from '@livediagram/api-schema';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';

// The authorize session's own life (10 minutes): past it the browser could not finish anyway.
export const LOGIN_TIMEOUT_MS = 600_000;

export type AuthServer = {
  authorization_endpoint: string;
  token_endpoint: string;
  device_authorization_endpoint?: string;
};

const authError = (message: string, hint?: string) =>
  new CliError({ exit: EXIT.auth, code: 'auth', message, ...(hint ? { hint } : {}) });

async function postForm(io: CliIo, url: string, fields: Record<string, string>) {
  const res = await io.fetch(
    new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    }),
  );
  const body: unknown = await res.json().catch(() => ({}));
  const field = (key: string): unknown =>
    typeof body === 'object' && body !== null ? Reflect.get(body, key) : undefined;
  return { ok: res.ok, field };
}

// The host's authorization server, from its metadata; every endpoint must be on the issuer's own origin.
export async function discover(io: CliIo, issuer: string, log: DebugLog): Promise<AuthServer> {
  const res = await io.fetch(new Request(`${issuer}/.well-known/oauth-authorization-server`));
  if (!res.ok) throw authError(`${issuer} has no sign-in server (HTTP ${res.status})`);
  const meta = (await res.json()) as Partial<AuthServer>;
  const origin = new URL(issuer).origin;
  const endpoints = [
    meta.authorization_endpoint,
    meta.token_endpoint,
    meta.device_authorization_endpoint,
  ];
  const foreign = endpoints.find((e) => e !== undefined && new URL(e).origin !== origin);
  if (!meta.authorization_endpoint || !meta.token_endpoint || foreign)
    throw authError(
      `${issuer}'s sign-in metadata points elsewhere (${foreign ?? 'missing endpoints'})`,
    );
  log(`oauth discovered ${origin}`);
  return meta as AuthServer;
}

const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>livediagram CLI</title><meta name="color-scheme" content="light dark"><style>body{font:16px system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5}</style></head><body><h1>${title}</h1><p>${body}</p></body></html>`;
const SIGNED_IN = page("You're signed in", 'Return to your terminal. You can close this tab.');
const CANCELLED = page('Sign-in cancelled', 'Nothing was connected. You can close this tab.');

// Rejects after `ms`, cancelling its timer when the race is over.
function deadline<T>(io: CliIo, ms: number, work: Promise<T>, onTimeout: () => Error): Promise<T> {
  let cancel!: () => void;
  const timeout = new Promise<never>((_, reject) => {
    cancel = io.timer(ms, () => reject(onTimeout()));
  });
  return Promise.race([work, timeout]).finally(() => cancel());
}

export async function loginWithBrowser(
  io: CliIo,
  server: AuthServer,
  log: DebugLog,
): Promise<string> {
  const verifier = randomBase64Url(32);
  const challenge = await pkceChallenge(verifier);
  const state = randomBase64Url(16);
  const loopback = await io.listenLoopback();
  const redirectUri = `http://127.0.0.1:${loopback.port}/callback`;
  const url = new URL(server.authorization_endpoint);
  for (const [k, v] of Object.entries({
    client_id: CLI_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  }))
    url.searchParams.set(k, v);
  io.stderr(`Opening ${url} in your browser. If it does not open, open it yourself.\n`);
  if (!(await io.openUrl(url.toString()))) log('oauth browser did not open');
  log(`oauth loopback ${loopback.port}`);
  // The first callback carrying this state ends the wait; a callback with another state gets a 400 (E11), any
  // other path a 404, and both are ignored.
  const callback = async (): Promise<URLSearchParams> => {
    for (;;) {
      const request = await loopback.next();
      if (request.path === '/callback' && request.query.get('state') === state) {
        const denied = request.query.has('error');
        request.respond(denied ? 403 : 200, denied ? CANCELLED : SIGNED_IN);
        return request.query;
      }
      if (request.path === '/callback')
        request.respond(
          400,
          page('Not this sign-in', 'This link is not from the sign-in under way.'),
        );
      else request.respond(404, page('Not found', 'This page is not part of the sign-in.'));
    }
  };
  let query: URLSearchParams;
  try {
    query = await deadline(io, LOGIN_TIMEOUT_MS, callback(), () =>
      authError('sign-in timed out waiting for the browser', 'livediagram auth login --device'),
    );
  } finally {
    loopback.close();
  }
  const code = query.get('code');
  if (!code)
    throw authError(`sign-in was cancelled in the browser (${query.get('error') ?? 'no code'})`);
  const answer = await postForm(io, server.token_endpoint, {
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    client_id: CLI_CLIENT_ID,
  });
  const token = answer.field('access_token');
  if (!answer.ok || typeof token !== 'string')
    throw authError(
      `the sign-in server refused the code (${String(answer.field('error') ?? 'no token')})`,
    );
  return token;
}

export async function loginWithDevice(
  io: CliIo,
  server: AuthServer,
  log: DebugLog,
): Promise<string> {
  if (!server.device_authorization_endpoint)
    throw authError('this host offers no device sign-in', 'livediagram auth login');
  const started = await postForm(io, server.device_authorization_endpoint, {
    client_id: CLI_CLIENT_ID,
  });
  const deviceCode = started.field('device_code');
  if (!started.ok || typeof deviceCode !== 'string')
    throw authError(
      `device sign-in could not start (${String(started.field('error') ?? 'no code')})`,
    );
  io.stderr(
    `Open ${String(started.field('verification_uri'))} and enter ${String(started.field('user_code'))}. Waiting for approval…\n` +
      `Or open ${String(started.field('verification_uri_complete'))}\n`,
  );
  let interval = Number(started.field('interval') ?? 5);
  // The code's own lifetime bounds the wait, so a server that keeps answering pending never holds the CLI forever.
  const expiresIn = Number(started.field('expires_in') ?? DEVICE_CODE_TTL_S);
  const expiresAt =
    io.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : DEVICE_CODE_TTL_S) * 1000;
  for (;;) {
    if (io.now() + interval * 1000 > expiresAt) {
      log('oauth device expired');
      throw authError('the code expired before it was approved', 'livediagram auth login --device');
    }
    await io.sleep(interval * 1000);
    const poll = await postForm(io, server.token_endpoint, {
      grant_type: DEVICE_CODE_GRANT,
      device_code: deviceCode,
      client_id: CLI_CLIENT_ID,
    });
    const token = poll.field('access_token');
    if (poll.ok && typeof token === 'string') return token;
    const error = String(poll.field('error') ?? 'unknown');
    log(`oauth device ${error}`);
    if (error === 'authorization_pending') continue;
    if (error === 'slow_down') {
      interval += DEVICE_SLOW_DOWN_S;
      continue;
    }
    if (error === 'access_denied') throw authError('sign-in was refused on the device page');
    if (error === 'expired_token')
      throw authError('the code expired before it was approved', 'livediagram auth login --device');
    throw authError(`device sign-in failed (${error})`);
  }
}
