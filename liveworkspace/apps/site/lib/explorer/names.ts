// Who did what, by name (What Happened, the Timeline): the index keeps actor ids only, and accounts answers their
// display names, up to 100 at once (POST /api/auth/workspace-profiles, same origin). The Explorer batches and keeps
// them; this only asks.

import type { NameLookup } from '@liveworkspace/explorer';

export const WORKSPACE_PROFILES_URL = '/api/auth/workspace-profiles';
// The ids accounts names: an account's and a guest's. Anything else is never asked for.
const PERSON_ID = /^(user_[A-Za-z0-9]{1,64}|guest_[0-9a-f-]{36})$/;

export const lookupNames: NameLookup = async (ids) => {
  const asked = ids.filter((id) => PERSON_ID.test(id));
  if (asked.length === 0) return {};
  const res = await fetch(WORKSPACE_PROFILES_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: asked }),
  });
  if (!res.ok) throw new Error(`profiles ${res.status}`);
  const { profiles } = (await res.json()) as { profiles?: { id: string; name: string | null }[] };
  return Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]));
};
