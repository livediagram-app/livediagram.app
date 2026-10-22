// Where a workspace frame is, and its address (docs/specs/013-workspace/workbench-embeds.md "What renders", blueprint
// "The workspace frame", WB56). A place is an Explorer view or a project. Inside the frame each place has a path
// under /embed/workbench, walked by the frame's own history: Home is /embed/workbench/explorer, a folder
// /embed/workbench/explorer/folder/<id>, every other view its /explorer path under /embed/workbench, and a project
// /embed/workbench/project/<id>. The Explorer itself keeps speaking its own /explorer hrefs; these functions
// translate both ways, so nothing inside it learns where it runs.

import { explorerPathFor, selectedFromRoute } from '@/app/explorer/routes';
import type { SelectedNode } from '@/app/explorer/views';
import { WORKSPACE_FRAME_PAGE } from './workbench-frame-path';

export type WorkspacePlace =
  | { kind: 'explorer'; node: SelectedNode }
  | { kind: 'project'; projectId: string; tabId: string | null; shareCode: string | null };

const FRAME_PREFIX = '/embed/workbench';
const FOLDER_ROOT = `${WORKSPACE_FRAME_PAGE}/folder/`;
const PROJECT_ROOT = `${FRAME_PREFIX}/project/`;
// The editor's placeholder page name is never a project (lib/legacy-editor-path).
const NOT_A_PROJECT = 'placeholder';

const HOME: WorkspacePlace = { kind: 'explorer', node: { kind: 'home' } };

const withQuery = (path: string, search: URLSearchParams) => {
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export function workspaceFramePath(place: WorkspacePlace): string {
  if (place.kind === 'project') {
    const search = new URLSearchParams();
    if (place.shareCode) search.set('s', place.shareCode);
    if (place.tabId) search.set('tab', place.tabId);
    return withQuery(`${PROJECT_ROOT}${encodeURIComponent(place.projectId)}`, search);
  }
  const { node } = place;
  if (node.kind === 'home') return WORKSPACE_FRAME_PAGE;
  if (node.kind === 'folder') return `${FOLDER_ROOT}${encodeURIComponent(node.id)}`;
  return `${FRAME_PREFIX}${explorerPathFor(node)}`;
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
  if (pathname.startsWith(PROJECT_ROOT)) {
    const id = decodeURIComponent(pathname.slice(PROJECT_ROOT.length).replace(/\/+$/, ''));
    if (!id || id.includes('/') || id === NOT_A_PROJECT) return HOME;
    return {
      kind: 'project',
      projectId: id,
      tabId: search.get('tab'),
      shareCode: search.get('s'),
    };
  }
  const route = explorerRouteOfFrame(pathname, search);
  if (!route) return HOME;
  return { kind: 'explorer', node: selectedFromRoute(route.pathname, route.search) };
}

const sameOrigin = (url: URL, origin: string) => url.origin === origin;

// An app href (`/explorer/...`, `/project/<id>...`) as the frame path that shows it, or a frame path as itself; null
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
  if (path.startsWith('/project/')) {
    const id = path.slice('/project/'.length);
    if (!id || id.includes('/') || id === NOT_A_PROJECT) return null;
    return withQuery(`${PROJECT_ROOT}${id}`, search);
  }
  return null;
}

// The new-project wizard: inside a workspace frame a new project is made in place instead (WB58).
export function isNewProjectHref(href: string, origin: string): boolean {
  const url = new URL(href, origin);
  return sameOrigin(url, origin) && url.pathname.replace(/\/+$/, '') === '/new';
}

// The same place in a full tab: Open in liveplanner.
export function appHrefOfPlace(place: WorkspacePlace): string {
  if (place.kind === 'explorer') return explorerPathFor(place.node);
  const path = `/project/${encodeURIComponent(place.projectId)}`;
  return place.shareCode ? `${path}?s=${encodeURIComponent(place.shareCode)}` : path;
}

// The place's name for `liveplanner:place`: the Explorer view's kind, or `project`.
export function placeView(place: WorkspacePlace): string {
  return place.kind === 'project' ? 'project' : place.node.kind;
}
