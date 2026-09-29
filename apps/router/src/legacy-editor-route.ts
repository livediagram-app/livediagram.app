// The editor route was /diagram/<id> before the container became a document
// (docs/specs/016-platform/router-app.md, "Legacy editor route"). Every old share link,
// embed and bookmark is sent on for good, query string included.
const LEGACY_EDITOR_PATH = '/diagram';
const EDITOR_PATH = '/document';

export function legacyEditorRedirect(url: URL): Response | null {
  const { pathname } = url;
  if (pathname !== LEGACY_EDITOR_PATH && !pathname.startsWith(`${LEGACY_EDITOR_PATH}/`))
    return null;
  const next = new URL(url.toString());
  next.pathname = EDITOR_PATH + pathname.slice(LEGACY_EDITOR_PATH.length);
  return Response.redirect(next.toString(), 308);
}
