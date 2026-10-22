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

// Renamed help articles: the ones about the container moved when it became a document,
// Whiteboards became Draw mode, the Highlighter went from a selection mode to a Draw tile, and
// the Activity Panel category went when the panel was removed (Undo and Redo moved to Canvas;
// its other articles land on Undo), Facilitate mode became Workshop mode, and the Welcome Tour
// became the Diagram Tour. Infographics became Illustrate mode and then Pages mode, which has
// since left livediagram for livedocuments: every article of all three sections lands on the
// Editor Modes article. The old addresses are links people have already shared (docs/specs/018-help/help-app.md, "Renamed articles").
const LEGACY_HELP_ARTICLES: Readonly<Record<string, string>> = {
  'tabs/add-to-diagram': 'tabs/add-to-document',
  'troubleshooting/diagram-not-loading': 'troubleshooting/document-not-loading',
  'collaboration/teams/team-shared-diagrams': 'collaboration/teams/team-shared-documents',
  'search-panel/the-search-panel/search-diagrams': 'search-panel/the-search-panel/search-documents',
  'getting-started/sharing-your-diagram': 'getting-started/sharing-your-document',
  'developers/working-with-diagrams': 'developers/working-with-documents',
  'canvas/whiteboards': 'canvas/draw-mode',
  'canvas/infographics': 'canvas/editor-modes',
  'canvas/infographics/infographic-layouts': 'canvas/editor-modes',
  'canvas/infographics/exporting-infographics': 'canvas/editor-modes',
  'canvas/illustrate': 'canvas/editor-modes',
  'canvas/illustrate/articles': 'canvas/editor-modes',
  'canvas/illustrate/exporting-pages': 'canvas/editor-modes',
  'canvas/illustrate/illustrate-tour': 'canvas/editor-modes',
  'canvas/illustrate/infographic-layouts': 'canvas/editor-modes',
  'canvas/illustrate/logo-pages': 'canvas/editor-modes',
  'canvas/illustrate/slide-pages': 'canvas/editor-modes',
  'canvas/illustrate/tab-windows': 'canvas/editor-modes',
  'canvas/pages-mode': 'canvas/editor-modes',
  'canvas/pages-mode/articles': 'canvas/editor-modes',
  'canvas/pages-mode/exporting-pages': 'canvas/editor-modes',
  'canvas/pages-mode/infographic-layouts': 'canvas/editor-modes',
  'canvas/pages-mode/logo-pages': 'canvas/editor-modes',
  'canvas/pages-mode/pages-tour': 'canvas/editor-modes',
  'canvas/pages-mode/slide-pages': 'canvas/editor-modes',
  'canvas/pages-mode/tab-windows': 'canvas/editor-modes',
  'canvas/pages-mode/wireframe-pages': 'canvas/editor-modes',
  'canvas/facilitate-mode': 'canvas/workshop-mode',
  'canvas/facilitate-mode/facilitate-tour': 'canvas/workshop-mode/workshop-tour',
  'selection-modes/highlighter': 'palette/tools/highlighter',
  'activity-panel': 'canvas/undo',
  'activity-panel/what-it-is': 'canvas/undo',
  'activity-panel/how-it-works': 'canvas/undo',
  'activity-panel/undo': 'canvas/undo',
  'activity-panel/redo': 'canvas/redo',
  'activity-panel/reverting-changes': 'canvas/undo',
  'getting-started/welcome-tour': 'getting-started/diagram-tour',
};

export function legacyHelpRedirect(url: URL): Response | null {
  const match = /^\/help\/(.+?)(\/?)$/.exec(url.pathname);
  const next = match ? LEGACY_HELP_ARTICLES[match[1]!] : undefined;
  if (!match || !next) return null;
  const target = new URL(url.toString());
  target.pathname = `/help/${next}${match[2]}`;
  return Response.redirect(target.toString(), 308);
}
