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
// since left livehuddle for livedocuments: every article of all three sections lands on the
// Editor Modes article. Plan mode left for liveplanner the same way, its articles landing there too, and the API's
// Plan Items, Sheets and Images article became Images, Copies and Libraries. Custom themes, tags and the in-editor AI
// assistant were removed: their articles land on the nearest live one (Themes, Folders, Connect AI Tools). The
// Self-Hosting category was retired; its pages land on the help centre home (an empty target). The old addresses are
// links people have already shared (docs/specs/018-help/help-app.md, "Renamed articles").
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
  'canvas/plan-mode': 'canvas/editor-modes',
  'canvas/plan-mode/items': 'canvas/editor-modes',
  'canvas/plan-mode/boards': 'canvas/editor-modes',
  'canvas/plan-mode/cards': 'canvas/editor-modes',
  'canvas/plan-mode/card-types': 'canvas/editor-modes',
  'canvas/plan-mode/plan-tour': 'canvas/editor-modes',
  'canvas/plan-mode/forms': 'canvas/editor-modes',
  'canvas/plan-mode/dashboards': 'canvas/editor-modes',
  'canvas/plan-mode/sheets': 'canvas/editor-modes',
  'canvas/plan-mode/sheet-functions': 'canvas/editor-modes',
  'canvas/plan-mode/visualisations': 'canvas/editor-modes',
  'developers/working-with-documents/plan-sheets-images':
    'developers/working-with-documents/images-and-copies',
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
  'canvas/themes/custom-themes': 'canvas/themes',
  'explorer/themes-library': 'canvas/themes',
  'explorer/tags': 'explorer/folders',
  'tools/ai': 'account-and-data/connect-ai-mcp',
  'tools/ai/ai-tools': 'account-and-data/connect-ai-mcp',
  'self-hosting': '',
  'self-hosting/self-hosting-overview': '',
  'self-hosting/deploying-livehuddle': '',
  'self-hosting/configuration': '',
  'self-hosting/configuration/drive-and-mcp': '',
};

// A retired help category's link that lost its `/help` prefix. The router's bare-category redirect no longer knows
// `self-hosting` (the registry has no such category), so it is answered here, straight to the help centre home.
const RETIRED_BARE_HELP_SEGMENTS = new Set(['self-hosting']);

export function legacyHelpRedirect(url: URL): Response | null {
  if (RETIRED_BARE_HELP_SEGMENTS.has(url.pathname.split('/')[1] ?? '')) {
    const target = new URL(url.toString());
    target.pathname = '/help/';
    return Response.redirect(target.toString(), 308);
  }
  const match = /^\/help\/(.+?)(\/?)$/.exec(url.pathname);
  const next =
    match && Object.prototype.hasOwnProperty.call(LEGACY_HELP_ARTICLES, match[1]!)
      ? LEGACY_HELP_ARTICLES[match[1]!]
      : undefined;
  if (!match || next === undefined) return null;
  const target = new URL(url.toString());
  target.pathname = next ? `/help/${next}${match[2]}` : '/help/';
  return Response.redirect(target.toString(), 308);
}

// Forms are liveplanner's now (docs/specs/016-platform/router-app.md, "Old form links go to liveplanner"). The
// migration carries every form's public link across with its code, so an old `/form/<code>` link goes on to the same
// path on liveplanner, query string included, for good.
const LEGACY_FORM_PATH = '/form';

/** liveplanner's address for this deployment: the router's `DEPLOY_ENV` (unset in production). */
export function liveplannerOrigin(deployEnv: string | undefined): string {
  if (deployEnv === 'staging') return 'https://staging.liveplanner.app';
  if (deployEnv === 'local') return 'http://localhost:3200';
  return 'https://www.liveplanner.app';
}

export function legacyFormRedirect(url: URL, deployEnv: string | undefined): Response | null {
  const { pathname } = url;
  if (pathname !== LEGACY_FORM_PATH && !pathname.startsWith(`${LEGACY_FORM_PATH}/`)) return null;
  const target = new URL(`${pathname}${url.search}`, liveplannerOrigin(deployEnv));
  return Response.redirect(target.toString(), 308);
}
