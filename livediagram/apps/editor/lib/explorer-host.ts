'use client';

// What the shared Explorer (@liveworkspace/explorer) needs from livediagram to be its host: an item's address in
// its own app, a share link's, where New goes, and the person's teams from their token
// (liveworkspace/docs/one-explorer.md). The editor's panel and the workbench's workspace frame both use these.

import { useEffect, useState } from 'react';
import { teamsOfToken } from '@liveworkspace/index-client/browser';
import type { App } from '@liveworkspace/index-client';
import type {
  ExplorerView,
  HelpHref,
  ItemHref,
  Placement,
  ShareUrl,
  TeamRef,
} from '@liveworkspace/explorer';
import { placeHash } from '@liveworkspace/explorer';
import { APP_SITES } from '@liveworkspace/sites';
import { helpArticleHref, type HelpArticleKey } from './help-articles';
import { currentBearer } from './api/core';

// Where each app opens its own items. livediagram's open here; another app's open on its own site.
const ITEM_PATHS: Record<App, string> = {
  livediagram: '/document/',
  livedocuments: '/document/',
  liveplanner: '/project/',
  livedesign: '/design/',
};

const siteOf = (app: App) => APP_SITES.find((site) => site.id === `${app}.app`)?.url ?? '';

export const itemHref: ItemHref = (item, at) => {
  const origin = item.app === 'livediagram' ? '' : siteOf(item.app);
  const query = item.sharedVia ? `?s=${encodeURIComponent(item.sharedVia)}` : '';
  // The editor's deep link (lib/collab-deep-link.ts), built by the Explorer.
  const pin = placeHash(at);
  return `${origin}${ITEM_PATHS[item.app]}${encodeURIComponent(item.id)}${query}${pin}`;
};

// A link opens the canvas on this site as `/document/shared?s=<code>`: the code names the canvas, and that address is
// the one whose page head names it, so the link previews as the canvas in chat apps (src/share-page.ts).
export const shareUrl: ShareUrl = (link) =>
  `${typeof window === 'undefined' ? '' : window.location.origin}/document/shared?s=${encodeURIComponent(link.code)}`;

// New from the Explorer: the /new flow, filed where the person pressed it.
export function newDocumentHref(placement: Placement | null): string {
  const params = new URLSearchParams();
  if (placement?.folderId) params.set('folder', placement.folderId);
  if (placement?.teamId) params.set('team', placement.teamId);
  const query = params.toString();
  return query ? `/new?${query}` : '/new';
}

// The teams an access token names (its `teams` claim): @liveworkspace/index-client/browser's.
export { teamsOfToken };

// The teams the person's access token names (its `teams` claim, liveworkspace/docs/accounts.md "Teams"); none for a
// guest.
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

// Each Explorer view's Help article: the Help button in its page header, and Home's in the hero's corner. Search opens
// Search and Filter; Favourites, with no article of its own, the Explorer's. A view with no article (Invites) shows no
// Help button.
const VIEW_HELP: Partial<Record<ExplorerView['kind'], HelpArticleKey>> = {
  home: 'home',
  all: 'myWork',
  folder: 'folders',
  team: 'teamSpaces',
  unsorted: 'unsorted',
  recent: 'recent',
  favourites: 'explorerPage',
  shared: 'sharedWithYou',
  inbox: 'inbox',
  timeline: 'timeline',
  trash: 'trash',
  search: 'explorerFilters',
  gallery: 'imageGallery',
  'shape-libraries': 'shapeLibraries',
};

export const explorerHelpHref: HelpHref = (view) => {
  const key = VIEW_HELP[view.kind];
  return key ? helpArticleHref(key) : undefined;
};
