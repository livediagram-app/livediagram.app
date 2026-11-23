'use client';

import { lazyPanel } from '@liveworkspace/ui/lazy-panel';
import { preloadTeamCard } from './TeamPane';
import { whenIdle } from './when-idle';

// The sections most visits never open, each from its own chunk (liveworkspace/docs/specs/004-index/one-explorer.md
// "Cost and performance"): Inbox, Invites, Gallery and Shape Libraries, kept out of the
// Explorer's first load. The Explorer fetches them all once it has drawn and the page is idle (preloadExplorerPanes),
// so moving to one later draws it in the move's own commit, as a static import would. Landing on one, its section
// draws as soon as its code is in.

export const InboxPane = lazyPanel('inbox', () => import('./InboxPane').then((m) => m.InboxPane));
export const InvitesPane = lazyPanel('invites', () =>
  import('./InvitesPane').then((m) => m.InvitesPane),
);
export const GalleryView = lazyPanel('gallery', () =>
  import('../library/LibraryViews').then((m) => m.GalleryView),
);
export const ShapeLibrariesView = lazyPanel('shape-libraries', () =>
  import('../library/LibraryViews').then((m) => m.ShapeLibrariesView),
);

export const WalkthroughsView = lazyPanel('walkthroughs', () =>
  import('../library/WalkthroughsPane').then((m) => m.WalkthroughsView),
);

const PANES = [InboxPane, InvitesPane, GalleryView, ShapeLibrariesView, WalkthroughsView];

/** Fetches every section's code, and the team view's card. Never rejects. */
export function preloadExplorerPanes(): Promise<void> {
  return Promise.all([...PANES.map((pane) => pane.preload()), preloadTeamCard()]).then(() => {});
}

/** Fetches every section's code once the page is idle; returns a cancel for an unmount before then. */
export function preloadExplorerPanesWhenIdle(): () => void {
  return whenIdle(() => void preloadExplorerPanes());
}
