// The api client a command uses (blueprint CLI45): the profile's api base, the credential, the CLI's headers,
// a share code once a pasted link resolved, a timeout, and a debug line per request.

import { createApiClient, type ApiClient } from '@livediagram/api-client';
import { CLI_VERSION } from './config/version';
import type { DebugLog } from './debug';
import type { CliIo } from './io';

export const REQUEST_TIMEOUT_MS = 30_000;

export type Transport = {
  forToken: (token: string) => ApiClient;
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
  return {
    forToken: (token) =>
      createApiClient({
        baseUrl: apiBase,
        fetch,
        timeoutMs: REQUEST_TIMEOUT_MS,
        headers: () => ({
          Authorization: `Bearer ${token}`,
          'X-Livediagram-Client': 'cli',
          'User-Agent': `livediagram-cli/${CLI_VERSION} ${io.runtime}`,
          ...(shareCode ? { 'X-Share-Code': shareCode } : {}),
        }),
      }),
    useShareCode: (code) => {
      shareCode = code;
    },
  };
}
