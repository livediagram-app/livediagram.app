// Where a workspace frame is, and its address (docs/specs/013-workspace/workbench-embeds.md "What renders", blueprint
// "The workspace frame", WB56). A place is an Explorer view or a design. Inside the frame each place has a path
// under /embed/workbench, walked by the frame's own history: Home is /embed/workbench/explorer, a folder
// /embed/workbench/explorer/folder/<id>, every other view its /explorer path under /embed/workbench, and a design
// /embed/workbench/design/<id>. The Explorer (@liveworkspace/explorer) itself keeps speaking its own /explorer
// hrefs; these functions translate both ways, so nothing inside it learns where it runs.

import { explorerPath, viewFromLocation, type ExplorerView } from '@liveworkspace/explorer';
import { WORKSPACE_FRAME_PAGE } from './workbench-frame-path';

export type WorkspacePlace =
  | { kind: 'explorer'; node: ExplorerView }
  | { kind: 'design'; designId: string; tabId: string | null; shareCode: string | null };

const FRAME_PREFIX = '/embed/workbench';
const FOLDER_ROOT = `${WORKSPACE_FRAME_PAGE}/folder/`;
const DESIGN_ROOT = `${FRAME_PREFIX}/design/`;
// The editor's placeholder page name is never a design (lib/legacy-editor-path).
const NOT_A_DESIGN = 'placeholder';

const HOME: WorkspacePlace = { kind: 'explorer', node: { kind: 'home' } };

const withQuery = (path: string, search: URLSearchParams) => {
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export function workspaceFramePath(place: WorkspacePlace): string {
  if (place.kind === 'design') {
    const search = new URLSearchParams();
    if (place.shareCode) search.set('s', place.shareCode);
    if (place.tabId) search.set('tab', place.tabId);
    return withQuery(`${DESIGN_ROOT}${encodeURIComponent(place.designId)}`, search);
  }
  const { node } = place;
  if (node.kind === 'home') return WORKSPACE_FRAME_PAGE;
  if (node.kind === 'folder') return `${FOLDER_ROOT}${encodeURIComponent(node.id)}`;
  return `${FRAME_PREFIX}${explorerPath(node)}`;
}

// The /explorer route a frame path stands for, with its query (the lens's `q`, a team page's `folder`), or null for
// a path outside the frame's Explorer. What the Explorer reads its view from inside the frame.
export function explorerRouteOfFrame(
  pathname: string,
  search: URLSearchParams,
): { pathname: string; search: URLSearchParams } | null {
  const path = pathname.replace(/\/+$/, '');
  if (path === WORKSPACE_FRAME_PAGE) return { pathname: '/explorer/home', search };
  if (!path.startsWith(`${WORKSPACE_FRAME_PAGE}/`)) return null;
  if (path.startsWith(FOLDER_ROOT)) {
    const folder = new URLSearchParams(search);
    folder.set('id', decodeURIComponent(path.slice(FOLDER_ROOT.length)));
    return { pathname: '/explorer/folder', search: folder };
  }
  return { pathname: path.slice(FRAME_PREFIX.length), search };
}

export function workspacePlaceOf(pathname: string, search: URLSearchParams): WorkspacePlace {
  if (pathname.startsWith(DESIGN_ROOT)) {
    const id = decodeURIComponent(pathname.slice(DESIGN_ROOT.length).replace(/\/+$/, ''));
    if (!id || id.includes('/') || id === NOT_A_DESIGN) return HOME;
    return {
      kind: 'design',
      designId: id,
      tabId: search.get('tab'),
      shareCode: search.get('s'),
    };
  }
  const route = explorerRouteOfFrame(pathname, search);
  if (!route) return HOME;
  return { kind: 'explorer', node: viewFromLocation(route.pathname, route.search) };
}

const sameOrigin = (url: URL, origin: string) => url.origin === origin;

// An app href (`/explorer/...`, `/design/<id>...`) as the frame path that shows it, or a frame path as itself; null
// for anything else (the wizard, help, sign-in, another site), which the frame does not hold.
export function framePathOfAppHref(href: string, origin: string): string | null {
  const url = new URL(href, origin);
  if (!sameOrigin(url, origin)) return null;
  const path = url.pathname.replace(/\/+$/, '');
  const search = url.searchParams;
  if (path === WORKSPACE_FRAME_PAGE || path.startsWith(`${FRAME_PREFIX}/`))
    return withQuery(path, search);
  if (path === '/explorer' || path === '/explorer/home')
    return withQuery(WORKSPACE_FRAME_PAGE, search);
  if (path === '/explorer/folder') {
    const id = search.get('id');
    if (!id) return withQuery(WORKSPACE_FRAME_PAGE, search);
    const rest = new URLSearchParams(search);
    rest.delete('id');
    return withQuery(`${FOLDER_ROOT}${encodeURIComponent(id)}`, rest);
  }
  if (path.startsWith('/explorer/')) return withQuery(`${FRAME_PREFIX}${path}`, search);
  if (path.startsWith('/design/')) {
    const id = path.slice('/design/'.length);
    if (!id || id.includes('/') || id === NOT_A_DESIGN) return null;
    return withQuery(`${DESIGN_ROOT}${id}`, search);
  }
  return null;
}

// The new-design wizard: inside a workspace frame a new design is made in place instead (WB58).
export function isNewDesignHref(href: string, origin: string): boolean {
  const url = new URL(href, origin);
  return sameOrigin(url, origin) && url.pathname.replace(/\/+$/, '') === '/new';
}

// The same place in a full tab: Open in livedesign.
export function appHrefOfPlace(place: WorkspacePlace): string {
  if (place.kind === 'explorer') return explorerPath(place.node);
  const path = `/design/${encodeURIComponent(place.designId)}`;
  return place.shareCode ? `${path}?s=${encodeURIComponent(place.shareCode)}` : path;
}

// The place's name for `livedesign:place`: the Explorer view's kind, or `design`.
export function placeView(place: WorkspacePlace): string {
  return place.kind === 'design' ? 'design' : place.node.kind;
}
