'use client';

import { lazyPanel } from '@liveworkspace/ui/lazy-panel';
import { SkeletonRows } from './EmptyPane';
import { FilteredEmpty, LensBar } from './lazy-lens';
import { preloadTeamCard } from './TeamPane';
import { whenIdle } from './when-idle';

// The sections most visits never open, each from its own chunk (liveworkspace/docs/specs/004-index/one-explorer.md
// "Cost and performance"): Inbox, Invites, Gallery, Shape Libraries, Offline, the Trash and Archived's band, the Details layout and the lens's
// chips (lazy-lens.tsx), kept out of the Explorer's first load. The Explorer fetches them all once it has drawn and the page is idle (preloadExplorerPanes),
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

/** Offline's own view (`/explorer/offline`). */
export const ThisBrowserPane = lazyPanel('offline', () =>
  import('./ThisBrowserPane').then((m) => m.ThisBrowserPane),
);

/** The Trash's view, its band and days-left meters (`/explorer/trash`): the list's skeleton rows stand in while its
 *  code lands. */
export const TrashPane = lazyPanel('trash', () => import('./TrashPane').then((m) => m.TrashPane), {
  fallback: SkeletonRows,
});

/** Archived's band (`/explorer/archived`), above its list. */
export const ArchivedIntro = lazyPanel('archived-intro', () =>
  import('./ShelfIntro').then((m) => m.ArchivedIntro),
);

/** The Details layout of a list: the list's skeleton rows stand in while its code lands. A list that opens in Details
 *  fetches it as it mounts (ItemsPane), while its items load. */
export const DetailsView = lazyPanel(
  'details',
  () => import('./DetailsView').then((m) => m.DetailsView),
  { fallback: SkeletonRows },
);

/** The phone's sidebar drawer, opened from the sections bar: only a phone's tap draws it. */
export const SectionsDrawer = lazyPanel('sections-drawer', () =>
  import('./SectionsDrawer').then((m) => m.SectionsDrawer),
);

const PANES = [
  InboxPane,
  InvitesPane,
  GalleryView,
  ShapeLibrariesView,
  WalkthroughsView,
  ThisBrowserPane,
  TrashPane,
  ArchivedIntro,
  DetailsView,
  SectionsDrawer,
  LensBar,
  FilteredEmpty,
];

/** Fetches every section's code, and the team view's card. Never rejects. */
export function preloadExplorerPanes(): Promise<void> {
  return Promise.all([...PANES.map((pane) => pane.preload()), preloadTeamCard()]).then(() => {});
}

/** Fetches every section's code once the page is idle; returns a cancel for an unmount before then. */
export function preloadExplorerPanesWhenIdle(): () => void {
  return whenIdle(() => void preloadExplorerPanes());
}
