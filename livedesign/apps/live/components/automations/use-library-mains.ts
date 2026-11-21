'use client';

// The design's main components, for Component Changed's panel (docs/specs/013-workspace/automations.md "The screen";
// blueprint automations.md "Editor", "The kit"): the library read as this person (GET /api/designs/:id/components),
// each main's id, name and whether it is archived, by name. Read once when the panel first shows, and again only on
// Try Again; an answer for another design is dropped. The screen opens only for a signed-in account of a stored
// design, whose token apiHeaders sends, so no owner id is named and no Offline record is read. Loaded with the screen.

import { useCallback, useEffect, useState } from 'react';
import type { ComponentsResponse } from '@livedesign/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from '@/lib/api/core';

export type LibraryMain = { id: string; name: string; archived: boolean };

export type LibraryMains = {
  status: 'loading' | 'ready' | 'error';
  list: readonly LibraryMain[];
  retry: () => void;
};

/** The mains as the panel lists them: the ones in use by name, then the archived ones by name. */
export function mainsOf(components: ComponentsResponse['components']): LibraryMain[] {
  return components
    .filter((c) => typeof c?.id === 'string' && typeof c.name === 'string')
    .map((c) => ({ id: c.id, name: c.name, archived: c.archived === true }))
    .sort(
      (a, b) =>
        Number(a.archived) - Number(b.archived) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

async function readMains(designId: string, shareCode: string | null): Promise<LibraryMain[]> {
  const res = await apiFetch(`${API_BASE}/designs/${encodeURIComponent(designId)}/components`, {
    headers: await apiHeaders('', { share: shareCode }),
  });
  return mainsOf((await expectOk<ComponentsResponse>(res, 'load components')).components ?? []);
}

type Held = { key: string; status: 'ready' | 'error'; list: readonly LibraryMain[] };

const NONE: readonly LibraryMain[] = [];

export function useLibraryMains(item: { id: string; shareCode: string | null }): LibraryMains {
  const [attempt, setAttempt] = useState(0);
  const [held, setHeld] = useState<Held | null>(null);
  const { id, shareCode } = item;
  const key = `${id}\n${attempt}`;
  useEffect(() => {
    if (!id) return;
    let live = true;
    readMains(id, shareCode).then(
      (list) => {
        if (live) setHeld({ key, status: 'ready', list });
      },
      () => {
        if (live) setHeld({ key, status: 'error', list: NONE });
      },
    );
    return () => {
      live = false;
    };
  }, [key, id, shareCode]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // What was read for another design, or before Try Again, is not this answer.
  if (!held || held.key !== key) return { status: 'loading', list: NONE, retry };
  return { status: held.status, list: held.list, retry };
}
