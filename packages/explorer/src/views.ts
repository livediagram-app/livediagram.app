// The Explorer's views and their addresses. The host app owns routing (Next.js in each app): it reads the
// view from its URL with `viewFromLocation`, renders <Explorer view=…>, and the Explorer asks it to go
// elsewhere through `onNavigate`. `explorerPath` gives each view's address for links, so a view can open
// in a new tab. Folder and team ids ride the query string, as liveplanner's do (a static export
// cannot enumerate ids).

export type ExplorerView =
  // Jump back in (Recent) and what was shared with you lately.
  | { kind: 'home' }
  // My Work: your root folders and the items in no folder.
  | { kind: 'all' }
  // Every item in no folder, yours and your teams'.
  | { kind: 'unsorted' }
  | { kind: 'recent' }
  | { kind: 'favourites' }
  // Shared with me: items reached through a link.
  | { kind: 'shared' }
  | { kind: 'trash' }
  // Open actions and unresolved threads, across every app.
  | { kind: 'inbox' }
  // What happened to the items you can reach, and your teams', newest first.
  | { kind: 'timeline' }
  // Title and folder search over the index.
  | { kind: 'search'; q: string }
  | { kind: 'folder'; id: string }
  // A team's library, at its root or one of its folders.
  | { kind: 'team'; id: string; folderId?: string };

export type ExplorerViewKind = ExplorerView['kind'];

export const DEFAULT_BASE_PATH = '/explorer';

const enc = encodeURIComponent;

/** The address of a view under `base` (default `/explorer`). */
export function explorerPath(view: ExplorerView, base = DEFAULT_BASE_PATH): string {
  const b = base.replace(/\/+$/, '');
  switch (view.kind) {
    case 'search':
      return view.q ? `${b}/search?q=${enc(view.q)}` : `${b}/search`;
    case 'folder':
      return `${b}/folder?id=${enc(view.id)}`;
    case 'team':
      return view.folderId
        ? `${b}/team?id=${enc(view.id)}&folder=${enc(view.folderId)}`
        : `${b}/team?id=${enc(view.id)}`;
    default:
      return `${b}/${view.kind}`;
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
  switch (section) {
    case 'all':
    case 'unsorted':
    case 'recent':
    case 'favourites':
    case 'shared':
    case 'trash':
    case 'inbox':
    case 'timeline':
    case 'home':
      return { kind: section };
    case 'search':
      return { kind: 'search', q: params.get('q') ?? '' };
    case 'folder':
      return id ? { kind: 'folder', id } : { kind: 'home' };
    case 'team': {
      if (!id) return { kind: 'home' };
      const folderId = params.get('folder');
      return folderId ? { kind: 'team', id, folderId } : { kind: 'team', id };
    }
    default:
      return { kind: 'home' };
  }
}

/** Whether two views show the same thing (the sidebar's highlight). */
export function sameView(a: ExplorerView, b: ExplorerView): boolean {
  return explorerPath(a) === explorerPath(b);
}

// The sidebar's words, Title Case, as liveplanner's (sidebar-structure.ts).
export const SIDEBAR_LABELS = {
  home: 'Home',
  inbox: 'Inbox',
  timeline: 'Timeline',
  shared: 'Shared With Me',
  myWork: 'My Work',
  unsorted: 'Unsorted',
  library: 'Library',
  trash: 'Trash',
  manageTeams: 'Manage Teams',
} as const;

export const VIEW_TITLES: Record<Exclude<ExplorerViewKind, 'folder' | 'team'>, string> = {
  home: SIDEBAR_LABELS.home,
  inbox: SIDEBAR_LABELS.inbox,
  timeline: SIDEBAR_LABELS.timeline,
  shared: SIDEBAR_LABELS.shared,
  all: SIDEBAR_LABELS.myWork,
  unsorted: SIDEBAR_LABELS.unsorted,
  trash: SIDEBAR_LABELS.trash,
  recent: 'Recent',
  favourites: 'Favourites',
  search: 'Search results',
};
