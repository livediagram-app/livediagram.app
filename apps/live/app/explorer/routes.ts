// Explorer section ↔ URL mapping (spec/15). Each sidebar section is
// its own route under /explorer so sections are linkable, the browser
// back button works, and new sections keep landing as new pages:
//
//   recent   → /explorer/recent          all     → /explorer/all
//   unsorted → /explorer/unsorted        shared  → /explorer/shared
//   gallery  → /explorer/images          invites → /explorer/invites
//   folder   → /explorer/folder?id=<id>  team    → /explorer/team?id=<id>
//
// Folder / team ids ride in the query string rather than a path
// segment ON PURPOSE: `output: 'export'` can't enumerate user-minted
// ids, and the /diagram/<id> workaround (placeholder file + worker
// rewrite + the not-found rescue in app/not-found.tsx) is a hack we
// don't want a second consumer of. A static /explorer/folder page
// reading ?id= needs none of that.
//
// Pure functions, no React — tested in routes.test.ts.

import type { SelectedNode } from './views';

export function explorerPathFor(node: SelectedNode): string {
  switch (node.kind) {
    case 'recent':
      return '/explorer/recent';
    case 'all':
      return '/explorer/all';
    case 'unsorted':
      return '/explorer/unsorted';
    case 'generated':
      return '/explorer/generated';
    case 'offline':
      return '/explorer/offline';
    case 'shared':
      return '/explorer/shared';
    case 'gallery':
      return '/explorer/images';
    case 'themes':
      return '/explorer/themes';
    case 'tokens':
      return '/explorer/tokens';
    case 'profile':
      return '/explorer/profile';
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
// URLs fall back to `recent` — the section /explorer itself redirects
// to — so a mangled link degrades to the default view, never a crash.
export function selectedFromRoute(pathname: string, search: URLSearchParams): SelectedNode {
  const path = pathname.replace(/\/+$/, '');
  switch (path) {
    case '/explorer/all':
      return { kind: 'all' };
    case '/explorer/unsorted':
      return { kind: 'unsorted' };
    case '/explorer/generated':
      return { kind: 'generated' };
    case '/explorer/offline':
      return { kind: 'offline' };
    case '/explorer/shared':
      return { kind: 'shared' };
    case '/explorer/images':
      return { kind: 'gallery' };
    case '/explorer/themes':
      return { kind: 'themes' };
    case '/explorer/tokens':
      return { kind: 'tokens' };
    case '/explorer/profile':
      return { kind: 'profile' };
    case '/explorer/invites':
      return { kind: 'invites' };
    case '/explorer/folder': {
      const id = search.get('id');
      return id ? { kind: 'folder', id } : { kind: 'recent' };
    }
    case '/explorer/team': {
      const id = search.get('id');
      return id ? { kind: 'team', id } : { kind: 'recent' };
    }
    default:
      return { kind: 'recent' };
  }
}
