// The account pages' side of the account API (liveworkspace/apps/accounts src/account-api.ts), on
// this same origin under /api/account: joining and declining a team, and pairing a workbench.

import { pageApp } from './explorer/page-app';

export const ACCOUNT_API = '/api/account';

export type TeamRole = 'admin' | 'member';

export interface Invitation {
  id: string;
  teamId: string;
  teamName: string;
  organisation: string | null;
  memberCount: number;
  role: TeamRole;
  invitedByName: string | null;
  createdAt: number;
}

// What a join link opens onto (GET /join/:token), signed in or not.
export interface JoinPreview {
  teamId: string;
  teamName: string;
  organisation: string | null;
  memberCount: number;
  alreadyMember: boolean;
  signedIn: boolean;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function accountApi<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
  // `keepalive`: sent as the page goes (Settings › Profile's name still waiting), so it outlives the page.
  options?: { keepalive?: boolean },
): Promise<ApiResult<T>> {
  try {
    // On an app's own address (the Explorer, served there) through the app's router, with the page's token.
    const send = pageApp() ? (await import('./explorer/token')).accountFetch : fetch;
    const response = await send(ACCOUNT_API + path, {
      method,
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(options?.keepalive ? { keepalive: true } : {}),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return { ok: true, data: data as T };
    return {
      ok: false,
      status: response.status,
      error: typeof data.error === 'string' ? data.error : 'failed',
    };
  } catch {
    return { ok: false, status: 0, error: 'offline' };
  }
}

// What to tell the person when the API says no: the account panels' own words (@liveworkspace/settings-ui).
export { accountErrorMessage as errorMessage } from '@liveworkspace/settings-ui';
