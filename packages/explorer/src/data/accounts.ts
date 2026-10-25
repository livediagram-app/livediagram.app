// What the Explorer reads from liveworkspace accounts (liveworkspace/docs/accounts.md "The API") beyond teams
// (data/teams.ts): other people's display names and Google pictures (liveworkspace/docs/accounts.md "Profile
// pictures"), for the Owner column, the Inbox, What Happened and the Timeline. On
// liveworkspace.app these are the person's own routes on its origin (`/api/account/*`, by the session cookie). A host
// elsewhere passes its own `ExplorerAccounts`, or none, and the Explorer goes without.

import { profilePictureOf } from '@liveworkspace/sites/picture';

/** A person as the accounts API names them: their display name, and their published Google picture (null with none,
 *  with their switch off, or when the reader is a guest, who is never sent one). */
export type ExplorerPerson = { name: string | null; picture: string | null };

export type ExplorerAccounts = {
  /** People by id (up to PEOPLE_MAX a call); ids with none are left out. */
  people: (ids: readonly string[], signal?: AbortSignal) => Promise<Map<string, ExplorerPerson>>;
};

export const PEOPLE_MAX = 100;

export class AccountsError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`accounts: ${status}`);
    this.name = 'AccountsError';
    this.status = status;
  }
}

/** The signed-in person's accounts routes on this origin (liveworkspace.app). */
export function createExplorerAccounts({
  baseUrl = '/api/account',
  fetch: doFetch,
}: { baseUrl?: string; fetch?: typeof fetch } = {}): ExplorerAccounts {
  const base = baseUrl.replace(/\/+$/, '');
  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await (doFetch ?? fetch)(`${base}${path}`, {
      credentials: 'same-origin',
      signal,
    });
    if (!res.ok) throw new AccountsError(res.status);
    return (await res.json()) as T;
  }
  return {
    people: async (ids, signal) => {
      const out = new Map<string, ExplorerPerson>();
      const unique = [...new Set(ids)].slice(0, PEOPLE_MAX);
      if (unique.length === 0) return out;
      const res = await get<{
        people: { id: string; name: string | null; picture?: string | null }[];
      }>(`/people?ids=${unique.map(encodeURIComponent).join(',')}`, signal);
      for (const p of res.people) {
        out.set(p.id, { name: p.name, picture: profilePictureOf(p.picture) });
      }
      return out;
    },
  };
}
