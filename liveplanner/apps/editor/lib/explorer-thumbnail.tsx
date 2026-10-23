'use client';

// Every Explorer surface (the /explorer page, the editor's panel) draws each plan's snapshot as it always did (ProjectThumbnail: fetched only once it
// scrolls into view, cached page-wide, the undrawn sketch for an empty plan with no request at all). Another app's
// item has no snapshot here, so the Explorer shows its own placeholder.
import type { RenderThumbnail } from '@liveworkspace/explorer';
import { ProjectThumbnail } from '@/components/panels/ProjectThumbnail';

// The Explorer draws each box (a row's, a card's, a folder tile's); the snapshot fills it.
const FILL = 'h-full w-full';

// The viewer is the page's Bearer (lib/api/core.ts identityHeaders); the thumbnail only needs a non-account marker
// to send it.
const VIEWER = 'viewer';

export const renderPlanThumbnail: RenderThumbnail = (item) =>
  item.app === 'liveplanner' ? (
    <ProjectThumbnail
      ownerId={VIEWER}
      projectId={item.id}
      version={item.updatedAt}
      empty={item.summary.empty === true}
      shareCode={item.sharedVia}
      className={FILL}
    />
  ) : null;
