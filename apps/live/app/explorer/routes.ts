// Explorer section ↔ URL mapping (docs/specs/013-workspace/folders.md). Each sidebar section is
// its own route under /explorer so sections are linkable, the browser
// back button works, and new sections keep landing as new pages:
//
//   home     → /explorer/home            recent  → /explorer/recent
//   inbox    → /explorer/inbox           timeline → /explorer/timeline
//   search   → /explorer/search          shared  → /explorer/shared
//   favourites → /explorer/favourites
//   gallery  → /explorer/images          invites → /explorer/invites
//   shape-libraries → /explorer/shape-libraries
//   folder   → /explorer/folder?id=<id>  team    → /explorer/team?id=<id>
//   trash    → /explorer/trash (Library sidebar row + Settings › Account)
//
// Folder / team ids ride in the query string rather than a path
// segment ON PURPOSE: `output: 'export'` can't enumerate user-minted
// ids, and the /document/<id> workaround (placeholder file + worker
// rewrite + the not-found rescue in app/not-found.tsx) is a hack we
// don't want a second consumer of. A static /explorer/folder page
// reading ?id= needs none of that.
//
// Pure functions, no React — tested in routes.test.ts.

import type { SelectedNode } from './views';

export function explorerPathFor(node: SelectedNode): string {
  switch (node.kind) {
    case 'home':
      return '/explorer/home';
    case 'timeline':
      return '/explorer/timeline';
    case 'inbox':
      return '/explorer/inbox';
    case 'recent':
      return '/explorer/recent';
    case 'all':
      return '/explorer/all';
    case 'favourites':
      return '/explorer/favourites';
    case 'offline':
      return '/explorer/offline';
    case 'search':
      return '/explorer/search';
    case 'shared':
      return '/explorer/shared';
    case 'gallery':
      return '/explorer/images';
    case 'themes':
      return '/explorer/themes';
    case 'shape-libraries':
      return '/explorer/shape-libraries';
    case 'trash':
      return '/explorer/trash';
    case 'invites':
      return '/explorer/invites';
    case 'folder':
      return `/explorer/folder?id=${encodeURIComponent(node.id)}`;
    case 'team':
      return `/explorer/team?id=${encodeURIComponent(node.id)}`;
  }
}

// Inverse: which section a URL shows. `pathname` arrives without the
// /live basePath (usePathname strips it); trailing slashes from the
// static export are tolerated. Unknown paths and id-less folder/team
// URLs fall back to `home`, the section /explorer itself redirects to
// (docs/specs/013-workspace/timeline.md §8.1), so a mangled link degrades to the default view,
// never a crash.
export function selectedFromRoute(pathname: string, search: URLSearchParams): SelectedNode {
  const path = pathname.replace(/\/+$/, '');
  switch (path) {
    case '/explorer/home':
      return { kind: 'home' };
    case '/explorer/timeline':
      return { kind: 'timeline' };
    case '/explorer/inbox':
      return { kind: 'inbox' };
    // Explicit, not left to the default: without its own case /explorer/recent would resolve
    // to Home (docs/specs/013-workspace/timeline.md §8.1) and the sidebar would highlight the
    // wrong row.
    case '/explorer/recent':
      return { kind: 'recent' };
    case '/explorer/all':
      return { kind: 'all' };
    // The retired buckets (docs/specs/013-workspace/folders.md#the-root-and-the-retired-buckets):
    // their pages replace themselves with these views, so the sidebar highlights the row at once.
    case '/explorer/unsorted':
    case '/explorer/dynamic':
      return { kind: 'all' };
    case '/explorer/generated':
    case '/explorer/search':
      return { kind: 'search' };
    // The Inbox was once Activity (docs/specs/013-workspace/inbox.md); its page replaces itself.
    case '/explorer/activity':
      return { kind: 'inbox' };
    case '/explorer/favourites':
      return { kind: 'favourites' };
    case '/explorer/offline':
      return { kind: 'offline' };
    case '/explorer/shared':
      return { kind: 'shared' };
    case '/explorer/images':
      return { kind: 'gallery' };
    case '/explorer/themes':
      return { kind: 'themes' };
    case '/explorer/shape-libraries':
      return { kind: 'shape-libraries' };
    case '/explorer/trash':
      return { kind: 'trash' };
    case '/explorer/invites':
      return { kind: 'invites' };
    case '/explorer/folder': {
      const id = search.get('id');
      return id ? { kind: 'folder', id } : { kind: 'home' };
    }
    case '/explorer/team': {
      const id = search.get('id');
      return id ? { kind: 'team', id } : { kind: 'home' };
    }
    default:
      return { kind: 'home' };
  }
}
