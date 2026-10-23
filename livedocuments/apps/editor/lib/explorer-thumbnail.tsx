'use client';

// Every Explorer surface (the /explorer page, the editor's panel) draws each document's snapshot as it always did (DocumentThumbnail: fetched only once it
// scrolls into view, cached page-wide, the undrawn sketch for an empty document with no request at all). Another app's
// item has no snapshot here, so the Explorer shows its own placeholder.
import type { RenderThumbnail } from '@liveworkspace/explorer';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';

// The Explorer draws each box (a row's, a card's, a folder tile's); the snapshot fills it.
const FILL = 'h-full w-full';

// The viewer is the page's Bearer (lib/api/core.ts identityHeaders); the thumbnail only needs a non-account marker
// to send it.
const VIEWER = 'viewer';

export const renderDocumentThumbnail: RenderThumbnail = (item) =>
  item.app === 'livedocuments' ? (
    <DocumentThumbnail
      ownerId={VIEWER}
      documentId={item.id}
      version={item.updatedAt}
      empty={item.summary.empty === true}
      shareCode={item.sharedVia}
      className={FILL}
    />
  ) : null;
