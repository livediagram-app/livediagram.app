'use client';

// What the shared Explorer (@liveworkspace/explorer) needs from livedesign to be its host: an item's address in
// its own app, a share link's, where New goes, and the person's teams from their token
// (liveworkspace/docs/specs/004-index/one-explorer.md). The Explorer page and the editor's panel both use these.

import { useEffect, useState } from 'react';
import type {
  ExplorerView,
  HelpHref,
  ItemHref,
  Placement,
  ShareUrl,
  TeamRef,
} from '@liveworkspace/explorer';
import { placeHash } from '@liveworkspace/explorer';
import { helpArticleHref, type HelpArticleKey } from './help-articles';
import { APP_ITEMS, siteOfApp } from '@liveworkspace/sites';
import { teamsOfToken } from '@liveworkspace/index-client/browser';
import { currentBearer } from './api/core';

// livedesign's own designs open here; another app's item opens on its own site (`@liveworkspace/sites` APP_ITEMS).
export const itemHref: ItemHref = (item, at) => {
  const origin = item.app === 'livedesign' ? '' : siteOfApp(item.app).url;
  const query = item.sharedVia ? `?s=${encodeURIComponent(item.sharedVia)}` : '';
  // The editor's deep link (lib/collab-deep-link.ts), built by the Explorer.
  const pin = placeHash(at);
  return `${origin}${APP_ITEMS[item.app].itemPath}${encodeURIComponent(item.id)}${query}${pin}`;
};

// A link opens the design on this site as `/design/shared?s=<code>`: the code names the design, and that address is the
// one whose page head names it, so the link previews as the design in chat apps (src/share-page.ts).
export const shareUrl: ShareUrl = (link) =>
  `${typeof window === 'undefined' ? '' : window.location.origin}/design/shared?s=${encodeURIComponent(link.code)}`;

// New from the Explorer: the /new flow, filed where the person pressed it.
export function newDesignHref(placement: Placement | null): string {
  const params = new URLSearchParams();
  if (placement?.folderId) params.set('folder', placement.folderId);
  if (placement?.teamId) params.set('team', placement.teamId);
  const query = params.toString();
  return query ? `/new?${query}` : '/new';
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

// Each Explorer view's Help article: the Help button in its page header, and Home's in the hero's corner. Search opens
// Search and Filter Designs; Favourites, with no article of its own, the Explorer's.
const VIEW_HELP: Partial<Record<ExplorerView['kind'], HelpArticleKey>> = {
  home: 'explorerPage',
  all: 'myWork',
  folder: 'folders',
  team: 'teamSpaces',
  recent: 'recentDesigns',
  favourites: 'explorerPage',
  shared: 'sharedWithYou',
  inbox: 'inbox',
  timeline: 'timeline',
  trash: 'trash',
  search: 'explorerFilters',
};

// A view with no article of its own (the Library's, Invites, This Browser) shows no Help button.
export const explorerHelpHref: HelpHref = (view) => {
  const key = VIEW_HELP[view.kind];
  return key ? helpArticleHref(key) : undefined;
};
