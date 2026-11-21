'use client';

// One tab's named versions, for Restore a Version's panel (docs/specs/013-workspace/automations.md "The screen";
// blueprint automations.md "Editor", "The kit"): the tab's versions read as this person (GET /api/documents/:id/tabs/
// :tabId/versions), the named ones alone, newest first. Read when the panel shows with a tab, and again only for a new
// tab or on Try Again; an answer for a tab no longer picked is dropped. The screen opens only for a signed-in
// account, whose token apiHeaders sends, so no owner id is named. Loaded with the screen.

import { useCallback, useEffect, useState } from 'react';
import type { VersionSummary } from '@livedocuments/api-schema';
import { apiListVersions } from '@/lib/api/versions';

export type NamedVersion = { id: string; name: string; createdAt: number };

export type NamedVersions = {
  status: 'loading' | 'ready' | 'error';
  list: readonly NamedVersion[];
  retry: () => void;
};

/** The named ones of `versions`, newest first. */
export function namedOnly(versions: readonly VersionSummary[]): NamedVersion[] {
  return versions
    .flatMap((v) => (v.name === null ? [] : [{ id: v.id, name: v.name, createdAt: v.createdAt }]))
    .sort((a, b) => b.createdAt - a.createdAt);
}

type Held = { key: string; status: 'ready' | 'error'; list: readonly NamedVersion[] };

const NONE: readonly NamedVersion[] = [];

export function useNamedVersions(
  item: { id: string; shareCode: string | null },
  tabId: string,
): NamedVersions {
  const [attempt, setAttempt] = useState(0);
  const [held, setHeld] = useState<Held | null>(null);
  const key = `${item.id}\n${tabId}\n${attempt}`;
  const { id, shareCode } = item;
  useEffect(() => {
    if (!tabId) return;
    let live = true;
    apiListVersions({ ownerId: '', shareCode }, id, tabId).then(
      (versions) => {
        if (live) setHeld({ key, status: 'ready', list: namedOnly(versions) });
      },
      () => {
        if (live) setHeld({ key, status: 'error', list: NONE });
      },
    );
    return () => {
      live = false;
    };
  }, [key, id, shareCode, tabId]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // What was read for another tab, or before Try Again, is not this tab's answer.
  if (!held || held.key !== key) return { status: 'loading', list: NONE, retry };
  return { status: held.status, list: held.list, retry };
}
