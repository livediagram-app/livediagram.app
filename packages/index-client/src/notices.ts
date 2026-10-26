// What the index tells an item's app, and asks of it, for the app's notification emails
// (liveworkspace/docs/one-explorer-contracts.md "Notices"). The index holds who shared an item and who
// opened it through a link, and how many items each person has made; the app holds the email.
//
//   - A notice: `POST <app>/api/internal/items/:id/notices` with the app's key, sent by the index after the
//     change is written and off its request's path. `shared`: someone made a share link on the item.
//     `joined`: a person (an account or a guest) opened it through a link for the first time.
//   - A count: `GET /api/index/app/people/:id/count?limit=` with the app's key, the items that person has
//     made in the app (the Trash's included), counted up to `limit`.

import { INDEX_API_PATH, INDEX_APP_HEADER, isLevel, type Level } from './constants';
import { IndexError, type IndexAppClientOptions } from './client';

export type ItemNotice =
  { type: 'shared'; actorId: string } | { type: 'joined'; personId: string; level: Level };

// The path under the app's /api/internal a notice goes to.
export const itemNoticePath = (itemId: string) => `/items/${encodeURIComponent(itemId)}/notices`;

const ID_MAX = 200;
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= ID_MAX;

// A notice as the app reads its body, or null for anything else.
export function parseItemNotice(value: unknown): ItemNotice | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== 'object') return null;
  if (v.type === 'shared' && isId(v.actorId)) return { type: 'shared', actorId: v.actorId };
  if (v.type === 'joined' && isId(v.personId) && isLevel(v.level)) {
    return { type: 'joined', personId: v.personId, level: v.level };
  }
  return null;
}

// The most a count goes up to.
export const OWNED_COUNT_MAX = 1000;

// How many items this person has made in the app, up to `limit` (an app that only needs to know whether
// the tenth was just made asks up to 11, so the count costs the same however many they have).
export async function countOwnedItems(
  { app, key, baseUrl, fetch: doFetch }: IndexAppClientOptions,
  personId: string,
  limit: number,
): Promise<number> {
  const base = (baseUrl || `https://www.liveworkspace.app${INDEX_API_PATH}`).replace(/\/+$/, '');
  const capped = Math.max(1, Math.min(OWNED_COUNT_MAX, Math.floor(limit)));
  const res = await (doFetch ?? fetch)(
    `${base}/app/people/${encodeURIComponent(personId)}/count?limit=${capped}`,
    { headers: { Authorization: `Bearer ${key}`, [INDEX_APP_HEADER]: app } },
  );
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new IndexError(res.status, typeof parsed?.error === 'string' ? parsed.error : 'unknown');
  }
  return ((await res.json()) as { count: number }).count;
}
