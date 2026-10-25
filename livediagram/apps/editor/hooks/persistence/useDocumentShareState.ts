'use client';

// Whether the open document has a live share link, for the header's visibility badge and the tab presence stack
// (lib/presence-rows.ts shows who is online only on a document others can reach). Links are the index's
// (liveworkspace/docs/one-explorer-contracts.md "Sharing"), so the api's `shareable` no longer knows: the editor asks
// the index once the document is open and again each time the Share dialog closes, as that is where links change. A
// visitor who came in on a link knows without asking. One request per open plus one per Share dialog session, never
// per edit; a reader who cannot manage links (a 403) keeps what the load said.
import { useEffect } from 'react';
import type { ShareLink } from '@liveworkspace/index-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';

export function hasLiveLink(links: readonly Pick<ShareLink, 'expiresAt'>[], now: number): boolean {
  return links.some((link) => link.expiresAt === null || link.expiresAt > now);
}

export function useDocumentShareState(input: {
  documentId: string | null;
  // On the server: an Offline Mode document has no links to ask about.
  serverStored: boolean;
  // The link this session came in on, if any.
  sessionShareCode: string | null;
  shareDialogOpen: boolean;
  setShareable: (shareable: boolean) => void;
}): void {
  const { documentId, serverStored, sessionShareCode, shareDialogOpen, setShareable } = input;
  useEffect(() => {
    if (!documentId || !serverStored || shareDialogOpen) return;
    if (sessionShareCode) {
      setShareable(true);
      return;
    }
    let live = true;
    indexClient
      .listShareLinks(documentId)
      .then(({ links }) => {
        if (live) setShareable(hasLiveLink(links, Date.now()));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [documentId, serverStored, sessionShareCode, shareDialogOpen, setShareable]);
}
