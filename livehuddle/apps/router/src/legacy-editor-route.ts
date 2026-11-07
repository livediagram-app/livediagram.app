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
// assistant were removed: their articles land on the nearest live one (Themes, Folders, Connect AI Tools). Slide
// decks, presenting and the Page element left livehuddle for meeting in Spaces (Work Tracker #423): the deck's
// articles and Presenting from the Canvas land on Following Someone, and Pages on Write Elements. Workshop mode, the
// Collaborate elements, polls and the diagram tools (shapes, arrows, drawing, the layout containers but the frame,
// tables, charts, code, components and embeds) left livehuddle too (Work Tracker #423 part 3): each lands on the
// nearest article that stays (Session Tools, the Avatar Tour, Meeting Elements, Comments, Assigned Actions, Where each
// tool lives, Frames, Write Elements, Images, Notes or Adding Elements), and the older names that led to them follow.
// Auto Layout, which arranges shapes by their arrows, lands on Layout Cleanup (Work Tracker #494). Shape Libraries and
// the draw.io, Microsoft Whiteboard and Markdown imports left livehuddle (Work Tracker #423 part 4): Shape Libraries
// lands on the Explorer Page, and the three imports on Importing a Tab, which names the imports that stay.
// The Laser, the Spotlight, Isometric mode, Zen mode and the Reaction Pads left livehuddle (owner, 2026-11-05): the
// three modes and the pads land on Avatar Mode, where walking, pointing and the Reactions live, and Zen on Panel Layout.
// The Quick Style panel left livehuddle too (owner, 2026-11-05): its article lands on Colours, Borders and Opacity, the
// element menu's styling that stays.
// The Self-Hosting category was retired; its pages land on the help centre home (an empty target). The old addresses are
// links people have already shared (docs/specs/018-help/help-app.md, "Renamed articles").
const LEGACY_HELP_ARTICLES: Readonly<Record<string, string>> = {
  // Hand and the Eraser left as modes with the Selection Mode picker (owner, 2026-11-06; livehuddle/docs/specs/
  // 002-project-scope/not-in-livehuddle.md "Hand, Eraser and Format as modes").
  'selection-modes/hand': 'canvas/the-canvas/pan-and-zoom',
  'selection-modes/eraser': 'selection-modes/select',
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
  'canvas/facilitate-mode': 'collaboration/session-tools',
  'canvas/facilitate-mode/facilitate-tour': 'selection-modes/avatar-mode/avatar-tour',
  'selection-modes/highlighter': 'palette/tools',
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
  'tools/ai': 'account-and-data/api-tokens',
  'tools/ai/ai-tools': 'account-and-data/api-tokens',
  // livehuddle has no MCP server, CLI or workbenches (docs/specs/002-project-scope/not-in-livehuddle.md): their
  // articles' old addresses land on what stays, API tokens and the API.
  'account-and-data/connect-ai-mcp': 'account-and-data/api-tokens',
  'account-and-data/connect-ai-mcp/ai-clients': 'account-and-data/api-tokens',
  'developers/cli': 'developers/api-overview',
  'developers/workbenches': 'developers/api-overview',
  'developers/workbenches/building-a-workbench': 'developers/api-overview',
  'selection-modes/slide-deck': 'canvas/follow-along',
  'selection-modes/slide-deck/building-a-deck': 'canvas/follow-along',
  'selection-modes/slide-deck/presenting': 'canvas/follow-along',
  'selection-modes/slide-deck/presenter-controls': 'canvas/follow-along',
  'tips-and-tricks/presenting-well': 'canvas/follow-along',
  'palette/tools/pages': 'palette/write',
  'canvas/workshop-mode': 'collaboration/session-tools',
  'canvas/workshop-mode/workshop-tour': 'selection-modes/avatar-mode/avatar-tour',
  'collaboration/session-tools/polls': 'collaboration/session-tools',
  // The dot vote left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md, "The Vote").
  'collaboration/session-tools/voting': 'collaboration/session-tools',
  'collaboration/session-tools/voting/casting-dots': 'collaboration/session-tools',
  'collaboration/session-tools/voting/vote-panel': 'collaboration/session-tools',
  'collaboration/session-tools/voting/vote-privacy': 'collaboration/session-tools',
  'collaboration/session-tools/voting/vote-results': 'collaboration/session-tools',
  'collaboration/session-tools/voting/vote-layers': 'collaboration/session-tools',
  'palette/behaviour/done-checks': 'palette/behaviour',
  'palette/behaviour/pickers': 'palette/behaviour',
  'palette/behaviour/reveal-zones': 'palette/behaviour',
  'palette/behaviour/session-buttons': 'palette/behaviour',
  'palette/collaborate': 'collaboration/session-tools',
  'palette/collaborate/comment-panels': 'collaboration/comments',
  'palette/collaborate/action-panels': 'collaboration/assigned-actions',
  'palette/collaborate/agendas': 'collaboration/session-tools',
  'palette/collaborate/decision-records': 'collaboration/session-tools',
  'palette/collaborate/estimate-cards': 'collaboration/session-tools',
  'palette/collaborate/idea-boxes': 'collaboration/session-tools',
  'palette/collaborate/qa-boards': 'collaboration/session-tools',
  'palette/collaborate/quizzes': 'collaboration/session-tools',
  'palette/collaborate/roll-calls': 'collaboration/session-tools',
  'palette/collaborate/temperature-checks': 'collaboration/session-tools',
  'palette/arrows': 'palette/tools',
  'palette/arrows/arrow-styles': 'palette/tools',
  'palette/arrows/arrow-to-arrow': 'palette/tools',
  'palette/arrows/avoiding-elements': 'palette/tools',
  'palette/arrows/curve-and-elbow-handles': 'palette/tools',
  'palette/auto-attach-arrows': 'palette/tools',
  'palette/badges-and-step-numbers': 'palette/virtual-office',
  'palette/boundaries': 'palette/virtual-office',
  'palette/cards-and-callouts': 'palette/virtual-office',
  'palette/components': 'palette/tools',
  'palette/diagram-keys': 'palette/virtual-office',
  'palette/embed-elements': 'palette/tools',
  'palette/embed-elements/website': 'palette/tools',
  'palette/lanes': 'palette/virtual-office',
  'palette/pointer-notes': 'palette/write',
  'palette/shapes': 'canvas/the-canvas/adding-elements',
  'palette/shapes/shape-markers': 'canvas/the-canvas/adding-elements',
  'palette/shapes/style-presets': 'canvas/the-canvas/adding-elements',
  'palette/stacks': 'palette/virtual-office',
  'palette/timeline-rail': 'palette/virtual-office',
  'palette/tools/checklists': 'palette/write',
  'palette/tools/code-blocks': 'palette/write',
  'palette/tools/data-elements': 'palette/tools',
  'palette/tools/data-elements/bar-and-line-charts': 'palette/tools',
  'palette/tools/data-elements/legend': 'palette/tools',
  'palette/tools/data-elements/pie-chart': 'palette/tools',
  'palette/tools/data-elements/progress-elements': 'palette/tools',
  'palette/tools/data-elements/rating': 'palette/tools',
  'palette/tools/drawing': 'palette/tools',
  'palette/tools/drawing/shape-recognition': 'palette/tools',
  'palette/tools/highlighter': 'palette/tools',
  'palette/tools/tables': 'palette/write',
  'canvas/annotations': 'canvas/notes',
  'getting-started/adding-shapes-and-arrows': 'canvas/the-canvas/adding-elements',
  'tools/layout-cleanup/auto-layout': 'tools/layout-cleanup',
  'explorer/shape-libraries': 'explorer/explorer-page',
  'explorer/drawio-import': 'tabs/import-tabs',
  'explorer/microsoft-whiteboard-import': 'tabs/import-tabs',
  'tools/markdown-import': 'tabs/import-tabs',
  'selection-modes/laser': 'selection-modes/avatar-mode',
  'selection-modes/spotlight': 'selection-modes/avatar-mode',
  'selection-modes/isometric-mode': 'selection-modes/avatar-mode',
  'palette/behaviour/reaction-pads': 'selection-modes/avatar-mode',
  'palette/build': 'palette/virtual-office',
  'palette/build/frames': 'palette/virtual-office',
  'tools/zen-mode': 'user-interface/panel-layout',
  'canvas/quick-style-panel': 'canvas/colours-borders-opacity',
  'palette/quick-add-on-hover': 'user-interface/settings',
  'palette/icons': 'palette/stickers',
  // Image and Link card left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "Media: Image and Link card").
  'palette/tools/images': 'palette/tools',
  'canvas/links/link-cards': 'canvas/links',
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
