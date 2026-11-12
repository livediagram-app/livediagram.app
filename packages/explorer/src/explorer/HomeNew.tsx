'use client';

// Home's New (liveworkspace/docs/specs/004-index/one-explorer.md "New, on Home"): directly above Most Used, the four
// items made most recently in the person's own space and their teams' (in this app, or every app under All Apps),
// newest first, so something just made and never opened (an AI tool's batch over MCP, which leaves Recent alone) is
// one look away. Most Used and Recent's cards, each line saying when it was made and where it lives; an AI tool's item wears
// Made by AI on its picture. This browser's own items are merged in by the same rule. Its read rides on Home's one
// items read (`newest`, data/homeReads.ts), so the section costs no request; with nothing made yet, or a failed read,
// it stays away (Recent below says when Home could not load).

import { useMemo } from 'react';
import type { ShownItem } from '../data/overlay';
import { useItemList } from '../data/useItemList';
import { HOME_NEW, newestLoader } from '../data/viewLists';
import type { ThisBrowserItem } from '../this-browser';
import { useExplorer } from './context';
import { CardGroup, GridSkeleton, Strip, StripSkeleton } from './HomeCards';
import { HomeSection } from './HomeSection';
import { useThisBrowserItems } from './ThisBrowser';

export const HOME_NEW_TITLE = 'New';

// Live, and not archived here since the read: what New may still show.
const stillNew = (i: ShownItem) => i.trashedAt === null && !i.archivedAt;

/** New's merge: the index's and this browser's together, the most recently made first, at most `max`. */
export function mergeMade<T extends { createdAt: number }>(
  made: readonly T[],
  local: readonly ThisBrowserItem[],
  max: number,
): (T | ThisBrowserItem)[] {
  if (local.length === 0) return made.slice(0, max);
  return [...made, ...local].sort((a, b) => b.createdAt - a.createdAt).slice(0, max);
}

export function HomeNew({ wide, showApp }: { wide: boolean; showApp: boolean }) {
  const { client, app, filter, overlay, epoch } = useExplorer();
  const load = useMemo(() => newestLoader(client, app, filter), [client, app, filter]);
  const made = useItemList({
    key: `home-new:${filter}`,
    load,
    overlay,
    belongs: stillNew,
    cap: HOME_NEW,
    epoch,
  });
  const { live: local } = useThisBrowserItems();
  const shown = useMemo(() => mergeMade(made.items, local, HOME_NEW), [made.items, local]);
  if (!made.loading && (made.error || shown.length === 0)) return null;
  return (
    <HomeSection id="new" title={HOME_NEW_TITLE} busy={made.loading}>
      {made.loading ? (
        wide ? (
          <GridSkeleton cards={HOME_NEW} />
        ) : (
          <StripSkeleton />
        )
      ) : wide ? (
        <CardGroup items={shown} large showApp={showApp} line="made" />
      ) : (
        <Strip
          items={shown.filter((i): i is ShownItem => 'app' in i)}
          local={shown.filter((i): i is ThisBrowserItem => !('app' in i))}
          max={HOME_NEW}
        />
      )}
    </HomeSection>
  );
}
