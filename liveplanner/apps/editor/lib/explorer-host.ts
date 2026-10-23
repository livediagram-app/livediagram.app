'use client';

// What the shared Explorer (@liveworkspace/explorer) needs from liveplanner to be its host: an item's address in
// its own app, a share link's, where New goes, and the person's teams from their token
// (liveworkspace/docs/one-explorer.md). The Explorer page and the editor's panel both use these.

import { useEffect, useState } from 'react';
import type { App } from '@liveworkspace/index-client';
import type {
  ExplorerView,
  HelpHref,
  ItemHref,
  Placement,
  ShareUrl,
  TeamRef,
} from '@liveworkspace/explorer';
import { helpArticleHref, type HelpArticleKey } from './help-articles';
import { APP_SITES } from '@liveworkspace/sites';
import { currentBearer } from './api/core';

// Where each app opens its own items. liveplanner's open here; another app's open on its own site.
const ITEM_PATHS: Record<App, string> = {
  livediagram: '/document/',
  liveplanner: '/project/',
  livedocuments: '/document/',
  livedesign: '/design/',
};

const siteOf = (app: App) => APP_SITES.find((site) => site.id === `${app}.app`)?.url ?? '';

export const itemHref: ItemHref = (item, at) => {
  const origin = item.app === 'liveplanner' ? '' : siteOf(item.app);
  const query = item.sharedVia ? `?s=${encodeURIComponent(item.sharedVia)}` : '';
  // The editor's element deep link (lib/collab-deep-link.ts): `#t=<tab>&el=<element>`.
  const pin =
    at?.tabId && at.elementId
      ? `#t=${encodeURIComponent(at.tabId)}&el=${encodeURIComponent(at.elementId)}`
      : at?.tabId
        ? `#t=${encodeURIComponent(at.tabId)}`
        : '';
  return `${origin}${ITEM_PATHS[item.app]}${encodeURIComponent(item.id)}${query}${pin}`;
};

// A link opens the plan on this site as `/project/shared?s=<code>`: the code names the plan, and that address is the
// one whose page head names it, so the link previews as the plan in chat apps (src/share-page.ts).
export const shareUrl: ShareUrl = (link) =>
  `${typeof window === 'undefined' ? '' : window.location.origin}/project/shared?s=${encodeURIComponent(link.code)}`;

// New from the Explorer: the /new flow, filed where the person pressed it.
export function newPlanHref(placement: Placement | null): string {
  const params = new URLSearchParams();
  if (placement?.folderId) params.set('folder', placement.folderId);
  if (placement?.teamId) params.set('team', placement.teamId);
  const query = params.toString();
  return query ? `/new?${query}` : '/new';
}

// The teams an access token names (its `teams` claim, liveworkspace/docs/accounts.md "Teams"); none for a guest.
export function teamsOfToken(token: string | null): TeamRef[] {
  const part = token?.split('.')[1];
  if (!part) return [];
  try {
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as {
      teams?: unknown;
    };
    if (!Array.isArray(claims.teams)) return [];
    return claims.teams.flatMap((team: unknown) => {
      const t = team as { id?: unknown; name?: unknown };
      return typeof t?.id === 'string' && typeof t.name === 'string'
        ? [{ id: t.id, name: t.name }]
        : [];
    });
  } catch {
    return [];
  }
}

// The person's teams, read from the token the page sends once it is known.
export function useTokenTeams(signedIn: boolean | undefined): TeamRef[] {
  const [teams, setTeams] = useState<TeamRef[]>([]);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void currentBearer().then((token) => {
      if (live) setTeams(teamsOfToken(token));
    });
    return () => {
      live = false;
    };
  }, [signedIn]);
  return signedIn ? teams : [];
}

// Each Explorer view's Help article: the Help button in its page header, and Home's in the hero's corner. Views with
// no article of their own (Search, Favourites) open the Explorer's.
const VIEW_HELP: Record<ExplorerView['kind'], HelpArticleKey> = {
  home: 'home',
  all: 'myWork',
  folder: 'folders',
  team: 'teamSpaces',
  unsorted: 'unsorted',
  recent: 'recent',
  favourites: 'explorerPage',
  shared: 'sharedWithYou',
  inbox: 'inbox',
  trash: 'trash',
  search: 'explorerPage',
};

export const explorerHelpHref: HelpHref = (view) => helpArticleHref(VIEW_HELP[view.kind]);
