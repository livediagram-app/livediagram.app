// The editor route is /document/<id>; it was /diagram/<id> before the container became a
// document (docs/specs/016-platform/router-app.md, "Legacy editor route"). The router redirects
// the old path for good, but while a deploy rolls out an old router can still forward it here,
// so the editor serves both and the page corrects the address bar.
const EDITOR = 'document';
const LEGACY_EDITOR = 'diagram';

export function isEditorPath(pathname: string): boolean {
  return [EDITOR, LEGACY_EDITOR].some((s) => pathname === `/${s}` || pathname.startsWith(`/${s}/`));
}

export function documentIdFromPath(pathname: string): { id: string | null; legacy: boolean } {
  const match = /^\/(document|diagram)\/([^/?#]+)/.exec(pathname);
  if (!match || match[2] === 'placeholder') return { id: null, legacy: false };
  return { id: match[2]!, legacy: match[1] === LEGACY_EDITOR };
}
