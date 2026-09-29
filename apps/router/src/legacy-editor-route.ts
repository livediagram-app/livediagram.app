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

// Help articles about the container moved when it became a document; the old addresses are
// links people have already shared (docs/specs/018-help/help-app.md, "Renamed articles").
const LEGACY_HELP_ARTICLES: Readonly<Record<string, string>> = {
  'tabs/add-to-diagram': 'tabs/add-to-document',
  'troubleshooting/diagram-not-loading': 'troubleshooting/document-not-loading',
  'collaboration/teams/team-shared-diagrams': 'collaboration/teams/team-shared-documents',
  'search-panel/the-search-panel/search-diagrams': 'search-panel/the-search-panel/search-documents',
  'getting-started/sharing-your-diagram': 'getting-started/sharing-your-document',
  'developers/working-with-diagrams': 'developers/working-with-documents',
};

export function legacyHelpRedirect(url: URL): Response | null {
  const match = /^\/help\/(.+?)(\/?)$/.exec(url.pathname);
  const next = match ? LEGACY_HELP_ARTICLES[match[1]!] : undefined;
  if (!match || !next) return null;
  const target = new URL(url.toString());
  target.pathname = `/help/${next}${match[2]}`;
  return Response.redirect(target.toString(), 308);
}
