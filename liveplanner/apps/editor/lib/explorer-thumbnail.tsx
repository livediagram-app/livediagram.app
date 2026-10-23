'use client';

// The editor's Explorer panel draws each plan's snapshot as it always did (ProjectThumbnail: fetched only once it
// scrolls into view, cached page-wide, the undrawn sketch for an empty plan with no request at all). Another app's
// item has no snapshot here, so the panel shows its own placeholder.
import type { RenderThumbnail } from '@liveworkspace/explorer';
import { ProjectThumbnail } from '@/components/panels/ProjectThumbnail';

// A row's box and a card's preview, as the panel's pane-parts frame them.
const ROW_BOX =
  'h-11 w-[60px] shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] dark:bg-slate-900 dark:ring-slate-700';
const CARD_BOX = 'h-full w-full bg-white dark:bg-slate-900';

// The viewer is the page's Bearer (lib/api/core.ts identityHeaders); the thumbnail only needs a non-account marker
// to send it.
const VIEWER = 'viewer';

export const renderPlanThumbnail: RenderThumbnail = (item, size) =>
  item.app === 'liveplanner' ? (
    <ProjectThumbnail
      ownerId={VIEWER}
      projectId={item.id}
      version={item.updatedAt}
      empty={item.summary.empty === true}
      shareCode={item.sharedVia}
      className={size === 'row' ? ROW_BOX : CARD_BOX}
    />
  ) : null;
