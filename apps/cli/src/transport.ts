// The api client a command uses (blueprint CLI45): the profile's api base, the credential, the CLI's headers,
// a share code once a pasted link resolved, a timeout, and a debug line per request.

import { createApiClient, type ApiClient } from '@livediagram/api-client';
import { CLI_VERSION } from './config/version';
import type { DebugLog } from './debug';
import type { CliIo } from './io';

export const REQUEST_TIMEOUT_MS = 30_000;

// Reads the stored credential again: its token, or null when there is none. Null where none can change (an env token).
export type RefreshToken = (() => Promise<string | null>) | null;

export type Transport = {
  forToken: (token: string) => ApiClient;
  // A client whose token is read again from the store when the api refuses it (a newer `auth login` revoked it while
  // a long command ran), retrying the refused request once with the new token.
  forCredential: (token: string, refresh: RefreshToken) => ApiClient;
  useShareCode: (code: string) => void;
};

export function transport(io: CliIo, apiBase: string, log: DebugLog): Transport {
  let shareCode: string | null = null;
  const fetch = async (request: Request) => {
    const started = io.now();
    const res = await io.fetch(request);
    log(
      `request ${request.method} ${new URL(request.url).pathname} ${res.status} ${io.now() - started}`,
    );
    return res;
  };
  const client = (token: () => string, send: (request: Request) => Promise<Response>) =>
    createApiClient({
      baseUrl: apiBase,
      fetch: send,
      timeoutMs: REQUEST_TIMEOUT_MS,
      headers: () => ({
        Authorization: `Bearer ${token()}`,
        'X-Livediagram-Client': 'cli',
        'User-Agent': `livediagram-cli/${CLI_VERSION} ${io.runtime}`,
        ...(shareCode ? { 'X-Share-Code': shareCode } : {}),
      }),
    });
  return {
    forToken: (token) => client(() => token, fetch),
    forCredential: (initial, refresh) => {
      let token = initial;
      const send = async (request: Request) => {
        const retry = refresh ? request.clone() : null;
        const res = await fetch(request);
        if (res.status !== 401 || !refresh || !retry) return res;
        const fresh = await refresh();
        if (!fresh || fresh === token) return res;
        token = fresh;
        log('credential refreshed');
        retry.headers.set('Authorization', `Bearer ${token}`);
        return fetch(retry);
      };
      return client(() => token, send);
    },
    useShareCode: (code) => {
      shareCode = code;
    },
  };
}
