'use client';

// What the shared Explorer (@liveworkspace/explorer) needs from livedocuments to be its host: an item's address in
// its own app, a share link's, where New goes, and the person's teams from their token
// (liveworkspace/docs/one-explorer.md). The Explorer page and the editor's panel both use these.

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

// livedocuments' own documents open here; another app's item opens on its own site (`@liveworkspace/sites` APP_ITEMS).
export const itemHref: ItemHref = (item, at) => {
  const origin = item.app === 'livedocuments' ? '' : siteOfApp(item.app).url;
  const query = item.sharedVia ? `?s=${encodeURIComponent(item.sharedVia)}` : '';
  // The editor's deep link (lib/collab-deep-link.ts), built by the Explorer.
  const pin = placeHash(at);
  return `${origin}${APP_ITEMS[item.app].itemPath}${encodeURIComponent(item.id)}${query}${pin}`;
};

// A link opens the document on this site as `/document/shared?s=<code>`: the code names the document, and that address is the
// one whose page head names it, so the link previews as the document in chat apps (src/share-page.ts).
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
// Search and Filter Documents; Favourites, with no article of its own, the Explorer's. A view with no article (Invites) shows no Help button.
const VIEW_HELP: Partial<Record<ExplorerView['kind'], HelpArticleKey>> = {
  home: 'home',
  all: 'myWork',
  folder: 'folders',
  team: 'teamSpaces',
  recent: 'recent',
  favourites: 'explorerPage',
  shared: 'sharedWithYou',
  inbox: 'inbox',
  timeline: 'timeline',
  trash: 'trash',
  search: 'explorerFilters',
};

export const explorerHelpHref: HelpHref = (view) => {
  const key = VIEW_HELP[view.kind];
  return key ? helpArticleHref(key) : undefined;
};
