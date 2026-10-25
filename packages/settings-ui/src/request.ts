// How the Settings panel reaches the accounts API (liveworkspace/docs/accounts.md "Who calls what"). Its own module,
// apart from the store, so an editor's Settings carries only this until All is first chosen.

export type SettingsApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string };

/** One call to the accounts API's account routes: `path` is under `/api/account` (`/settings/livediagram.app`). */
export type SettingsRequest = <T>(
  path: string,
  method?: 'GET' | 'PATCH',
  body?: unknown,
) => Promise<SettingsApiResult<T>>;

/** A request over the accounts API's bearer door through an app's router (`/api/workspace/account`), as each
 *  editor's Explorer panel calls it: the person's access token, asked for per request. */
export function bearerSettingsRequest({
  baseUrl,
  token,
}: {
  baseUrl: string;
  token: () => Promise<string | null>;
}): SettingsRequest {
  return async <T>(path: string, method: 'GET' | 'PATCH' = 'GET', body?: unknown) => {
    try {
      const bearer = await token();
      if (!bearer) return { ok: false, status: 401, error: 'signed_out' } as const;
      const init: RequestInit = {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${bearer}`,
        },
        credentials: 'omit',
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const response = await fetch(baseUrl + path, init);
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.ok) return { ok: true, data: data as T } as const;
      return {
        ok: false,
        status: response.status,
        error: typeof data.error === 'string' ? data.error : 'failed',
      } as const;
    } catch {
      return { ok: false, status: 0, error: 'offline' } as const;
    }
  };
}
