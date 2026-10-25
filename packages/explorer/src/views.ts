// The Explorer's views and their addresses. The host app owns routing (Next.js in each app): it reads the
// view from its URL with `viewFromLocation`, renders <Explorer view=…>, and the Explorer asks it to go
// elsewhere through `onNavigate`. `explorerPath` gives each view's address for links, so a view can open
// in a new tab. Folder and team ids ride the query string, as liveplanner's do (a static export
// cannot enumerate ids).

// A list's filter lens (explorer-filters.md), the string the field and chips edit, as `?q=`. Absent or empty:
// unfiltered.
type Lensed = { q?: string };

export type ExplorerView =
  // Jump back in (Recent) and what was shared with you lately.
  | { kind: 'home' }
  // My Work: your root folders and the items in no folder.
  | ({ kind: 'all' } & Lensed)
  | ({ kind: 'recent' } & Lensed)
  | ({ kind: 'favourites' } & Lensed)
  // Shared with me: items reached through a link.
  | ({ kind: 'shared' } & Lensed)
  | { kind: 'trash' }
  // Open actions and unresolved threads, across every app.
  | { kind: 'inbox' }
  // What happened to the items you can reach, and your teams', newest first.
  | { kind: 'timeline' }
  // Search results: every item the person can open, narrowed by the lens (words and filters).
  | { kind: 'search'; q: string }
  | ({ kind: 'folder'; id: string } & Lensed)
  // A team's library, at its root or one of its folders.
  | ({ kind: 'team'; id: string; folderId?: string } & Lensed)
  // The team invitations waiting for the person, each answered where teams are run.
  | { kind: 'invites' }
  // The person's images, from the host's media source (only where the host has one).
  | { kind: 'gallery' }
  // The person's shape libraries, from the host's store (only where the host has one).
  | { kind: 'shape-libraries' }
  // What the host app keeps only in this browser (only where the host can read it: the app's own address).
  | { kind: 'offline' };

/** How a view takes the lens: `scoped` (its breadcrumb is the place), `aggregate` (it lists every place), or
 *  null for a view that lists no items of its own (typing there opens Search results). */
export type LensViewKind = 'scoped' | 'aggregate';

const LENS_VIEWS: Partial<Record<ExplorerView['kind'], LensViewKind>> = {
  all: 'scoped',
  folder: 'scoped',
  team: 'scoped',
  recent: 'aggregate',
  favourites: 'aggregate',
  shared: 'aggregate',
  search: 'aggregate',
};

export function lensViewOf(kind: ExplorerView['kind']): LensViewKind | null {
  return LENS_VIEWS[kind] ?? null;
}

/** The lens string a view carries ('' for none). */
export function viewLens(view: ExplorerView): string {
  return 'q' in view ? (view.q ?? '') : '';
}

/** The view with this lens (collapsed whitespace; none when empty). A view with no lens is returned as it is. */
export function withLens(view: ExplorerView, q: string): ExplorerView {
  if (lensViewOf(view.kind) === null) return view;
  const lens = q.split(/\s+/).filter(Boolean).join(' ');
  if (view.kind === 'search') return { ...view, q: lens };
  const { q: _old, ...rest } = view as ExplorerView & Lensed;
  return (lens ? { ...rest, q: lens } : rest) as ExplorerView;
}

export type ExplorerViewKind = ExplorerView['kind'];

/** The views that list items (and folders): every view but those drawn by panes of their own. */
export type ItemsView = Exclude<
  ExplorerView,
  { kind: 'home' | 'inbox' | 'timeline' | 'invites' | 'gallery' | 'shape-libraries' | 'offline' }
>;

export const DEFAULT_BASE_PATH = '/explorer';

const enc = encodeURIComponent;

/** The address of a view under `base` (default `/explorer`), its lens as `q` last. */
export function explorerPath(view: ExplorerView, base = DEFAULT_BASE_PATH): string {
  const b = base.replace(/\/+$/, '');
  const q = viewLens(view);
  const lens = (joiner: string) => (q ? `${joiner}q=${enc(q)}` : '');
  switch (view.kind) {
    case 'search':
      return `${b}/search${lens('?')}`;
    case 'folder':
      return `${b}/folder?id=${enc(view.id)}${lens('&')}`;
    case 'team':
      return view.folderId
        ? `${b}/team?id=${enc(view.id)}&folder=${enc(view.folderId)}${lens('&')}`
        : `${b}/team?id=${enc(view.id)}${lens('&')}`;
    // livediagram's address for its gallery, kept so its links still land.
    case 'gallery':
      return `${b}/images`;
    default:
      return `${b}/${view.kind}${lens('?')}`;
  }
}

/** Which view an address shows. Unknown addresses, and folder or team ones without an id, are Home. */
export function viewFromLocation(
  pathname: string,
  search: URLSearchParams | string = '',
  base = DEFAULT_BASE_PATH,
): ExplorerView {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const b = base.replace(/\/+$/, '');
  const path = pathname.replace(/\/+$/, '');
  const section = path.startsWith(`${b}/`) ? path.slice(b.length + 1) : '';
  const id = params.get('id');
  const q = params.get('q') ?? '';
  const lensed = (view: ExplorerView) => withLens(view, q);
  switch (section) {
    case 'all':
    case 'recent':
    case 'favourites':
    case 'shared':
      return lensed({ kind: section });
    case 'trash':
    case 'inbox':
    case 'timeline':
    case 'home':
    case 'invites':
    case 'shape-libraries':
    case 'offline':
      return { kind: section };
    case 'images':
      return { kind: 'gallery' };
    case 'search':
      return { kind: 'search', q };
    // The old Unsorted view: My Work's root already lists what is in no folder.
    case 'unsorted':
      return lensed({ kind: 'all' });
    // The old Generated view: Search results, made by AI.
    case 'generated':
      return { kind: 'search', q: 'made-by:ai' };
    case 'folder':
      return id ? lensed({ kind: 'folder', id }) : { kind: 'home' };
    case 'team': {
      if (!id) return { kind: 'home' };
      const folderId = params.get('folder');
      return lensed(folderId ? { kind: 'team', id, folderId } : { kind: 'team', id });
    }
    default:
      return { kind: 'home' };
  }
}

/** Whether two views show the same place, whatever their lens (the sidebar's highlight). */
export function sameView(a: ExplorerView, b: ExplorerView): boolean {
  return explorerPath(withLens(a, '')) === explorerPath(withLens(b, ''));
}

// The sidebar's words, Title Case, as liveplanner's (sidebar-structure.ts).
export const SIDEBAR_LABELS = {
  home: 'Home',
  inbox: 'Inbox',
  timeline: 'Timeline',
  shared: 'Shared With Me',
  myWork: 'My Work',
  library: 'Library',
  trash: 'Trash',
  newTeam: 'New Team',
  invites: 'Invites',
  gallery: 'Image Gallery',
  shapeLibraries: 'Shape Libraries',
  thisBrowser: 'This Browser',
} as const;

export const VIEW_TITLES: Record<Exclude<ExplorerViewKind, 'folder' | 'team'>, string> = {
  home: SIDEBAR_LABELS.home,
  inbox: SIDEBAR_LABELS.inbox,
  timeline: SIDEBAR_LABELS.timeline,
  shared: SIDEBAR_LABELS.shared,
  all: SIDEBAR_LABELS.myWork,
  trash: SIDEBAR_LABELS.trash,
  recent: 'Recent',
  favourites: 'Favourites',
  search: 'Search results',
  invites: SIDEBAR_LABELS.invites,
  gallery: SIDEBAR_LABELS.gallery,
  'shape-libraries': SIDEBAR_LABELS.shapeLibraries,
  offline: SIDEBAR_LABELS.thisBrowser,
};
