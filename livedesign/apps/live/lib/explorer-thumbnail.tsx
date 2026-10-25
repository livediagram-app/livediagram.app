'use client';

// Every Explorer surface (the /explorer page, the editor's panel) draws each design's snapshot as it always did (DesignThumbnail: fetched only once it
// scrolls into view, cached page-wide, the undrawn sketch for an empty design with no request at all). Every app's
// items have their previews at the same address (`/api/previews/items/<id>`, liveworkspace's media service through
// this site's router), so under All another app's item shows its own picture too, never a bare icon.
import type { RenderThumbnail } from '@liveworkspace/explorer';
import { DesignThumbnail } from '@/components/panels/DesignThumbnail';

// The Explorer draws each box (a row's, a card's, a folder tile's); the snapshot fills it.
const FILL = 'h-full w-full';

// The viewer is the page's Bearer (lib/api/core.ts identityHeaders); the thumbnail only needs a non-account marker
// to send it.
const VIEWER = 'viewer';

export const renderDesignThumbnail: RenderThumbnail = (item) => (
  <DesignThumbnail
    ownerId={VIEWER}
    designId={item.id}
    version={item.updatedAt}
    empty={item.summary.empty === true}
    shareCode={item.sharedVia}
    className={FILL}
  />
);
