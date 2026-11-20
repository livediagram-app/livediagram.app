import { describe, expect, it } from 'vitest';
import router, { type Env } from './index';
import { legacyHelpRedirect } from './legacy-help-route';

function envWithLive() {
  const urls: string[] = [];
  const fetcher = {
    fetch: (req: Request) => {
      urls.push(req.url);
      return Promise.resolve(new Response('ok'));
    },
  } as unknown as Fetcher;
  const env: Env = {
    MARKETING: fetcher,
    EDITOR: fetcher,
    API: fetcher,
    HELP: fetcher,
  };
  return { env, urls };
}
const dispatch = (path: string, env: Env) =>
  router.fetch(new Request(`https://www.livehuddle.app${path}`), env);

describe('legacyHelpRedirect', () => {
  it('sends every renamed help article to its new address, for good', () => {
    const cases: [string, string][] = [
      ['/help/tabs/add-to-diagram/', '/help/tabs/add-to-document/'],
      ['/help/troubleshooting/diagram-not-loading/', '/help/troubleshooting/document-not-loading/'],
      [
        '/help/collaboration/teams/team-shared-diagrams/',
        '/help/collaboration/teams/team-shared-documents/',
      ],
      [
        '/help/search-panel/the-search-panel/search-diagrams/',
        '/help/search-panel/the-search-panel/search-documents/',
      ],
      [
        '/help/getting-started/sharing-your-diagram/',
        '/help/getting-started/sharing-your-document/',
      ],
      ['/help/developers/working-with-diagrams', '/help/developers/working-with-documents'],
      // Whiteboarding became Draw mode, which livehuddle's help does not have: the Canvas.
      ['/help/canvas/whiteboards/', '/help/canvas/'],
      // Pages mode (once Infographics, then Illustrate) left livehuddle: every article of the three
      // sections lands on Selection Modes (livehuddle's help has no Editor Modes article).
      ['/help/canvas/illustrate/', '/help/selection-modes/'],
      ['/help/canvas/illustrate/illustrate-tour/', '/help/selection-modes/'],
      ['/help/canvas/illustrate/slide-pages', '/help/selection-modes'],
      ['/help/canvas/infographics/', '/help/selection-modes/'],
      ['/help/canvas/infographics/exporting-infographics/', '/help/selection-modes/'],
      ['/help/canvas/pages-mode/', '/help/selection-modes/'],
      ['/help/canvas/pages-mode/pages-tour/', '/help/selection-modes/'],
      ['/help/canvas/pages-mode/wireframe-pages/', '/help/selection-modes/'],
      // Plan mode left livehuddle for liveplanner the same way.
      ['/help/canvas/plan-mode/', '/help/selection-modes/'],
      ['/help/canvas/plan-mode/boards/', '/help/selection-modes/'],
      ['/help/canvas/plan-mode/sheet-functions', '/help/selection-modes'],
      [
        '/help/developers/working-with-documents/plan-sheets-images/',
        '/help/developers/working-with-documents/images-and-copies/',
      ],
      // Facilitate mode became Workshop mode, which then left livehuddle with the Highlighter (Work Tracker #423):
      // the old names land where Workshop mode's and the Highlighter's articles do now.
      ['/help/canvas/facilitate-mode/', '/help/collaboration/session-tools/'],
      [
        '/help/canvas/facilitate-mode/facilitate-tour/',
        '/help/selection-modes/avatar-mode/avatar-tour/',
      ],
      ['/help/selection-modes/highlighter/', '/help/palette/tools/'],
      // The presenting tools, Isometric and Zen left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md).
      ['/help/selection-modes/laser/', '/help/selection-modes/avatar-mode/'],
      ['/help/selection-modes/spotlight/', '/help/selection-modes/avatar-mode/'],
      ['/help/selection-modes/isometric-mode/', '/help/selection-modes/avatar-mode/'],
      ['/help/palette/behaviour/reaction-pads/', '/help/selection-modes/avatar-mode/'],
      ['/help/tools/zen-mode/', '/help/user-interface/panel-layout/'],
      ['/help/canvas/quick-style-panel/', '/help/canvas/colours-borders-opacity/'],
      // Quick Connect left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md#quick-connect).
      ['/help/palette/quick-add-on-hover/', '/help/user-interface/settings/'],
      // The Icons category left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md#icons).
      ['/help/palette/icons/', '/help/palette/stickers/'],
      // Image and Link card left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md).
      ['/help/palette/tools/images/', '/help/palette/tools/'],
      ['/help/canvas/links/link-cards/', '/help/collaboration/'],
      // Element and Tab Locking left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md).
      ['/help/canvas/locking/', '/help/canvas/selecting-and-grouping/'],
      ['/help/tabs/locking-tabs/', '/help/tabs/using-tabs/'],
      // The Activity Panel was removed (docs/specs/012-collaboration/README.md); Undo / Redo moved to Canvas.
      ['/help/activity-panel/', '/help/canvas/undo/'],
      ['/help/activity-panel/undo/', '/help/canvas/undo/'],
      ['/help/activity-panel/redo/', '/help/canvas/redo/'],
      ['/help/activity-panel/what-it-is/', '/help/canvas/undo/'],
      ['/help/activity-panel/how-it-works/', '/help/canvas/undo/'],
      ['/help/activity-panel/reverting-changes/', '/help/canvas/undo/'],
      // The Welcome Tour became the Diagram Tour, which livehuddle's help does not have: Your First Space.
      ['/help/getting-started/welcome-tour/', '/help/getting-started/your-first-space/'],
      // The Self-Hosting category was retired: its pages land on the help centre home.
      ['/help/self-hosting/', '/help/'],
      ['/help/self-hosting', '/help/'],
      ['/help/self-hosting/self-hosting-overview/', '/help/'],
      ['/help/self-hosting/deploying-livehuddle/', '/help/'],
      ['/help/self-hosting/configuration/', '/help/'],
      ['/help/self-hosting/configuration/drive-and-mcp/', '/help/'],
      // Custom themes, tags and the AI assistant were removed: their articles land on the nearest live one.
      ['/help/canvas/themes/custom-themes/', '/help/canvas/themes/'],
      ['/help/canvas/themes/custom-themes', '/help/canvas/themes'],
      ['/help/explorer/themes-library/', '/help/canvas/themes/'],
      ['/help/explorer/tags/', '/help/explorer/folders/'],
      ['/help/tools/ai/', '/help/account-and-data/api-tokens/'],
      ['/help/tools/ai/ai-tools/', '/help/account-and-data/api-tokens/'],
      ['/help/account-and-data/connect-ai-mcp/', '/help/account-and-data/api-tokens/'],
      ['/help/account-and-data/connect-ai-mcp/ai-clients/', '/help/account-and-data/api-tokens/'],
      ['/help/developers/cli/', '/help/developers/api-overview/'],
      ['/help/developers/workbenches/', '/help/developers/api-overview/'],
      ['/help/developers/workbenches/building-a-workbench/', '/help/developers/api-overview/'],
      // Slide decks, presenting and the Page element left livehuddle (Work Tracker #423): the deck's articles land
      // on Following Someone, and Pages on Write Elements.
      ['/help/selection-modes/slide-deck/', '/help/canvas/follow-along/'],
      ['/help/selection-modes/slide-deck', '/help/canvas/follow-along'],
      ['/help/selection-modes/slide-deck/building-a-deck/', '/help/canvas/follow-along/'],
      ['/help/selection-modes/slide-deck/presenting/', '/help/canvas/follow-along/'],
      ['/help/selection-modes/slide-deck/presenter-controls/', '/help/canvas/follow-along/'],
      ['/help/tips-and-tricks/presenting-well/', '/help/canvas/follow-along/'],
      ['/help/palette/tools/pages/', '/help/palette/write/'],
      // Workshop mode, the Collaborate elements, polls and the diagram tools left livehuddle (Work Tracker #423
      // part 3): each lands on the nearest article that stays.
      ['/help/canvas/workshop-mode/', '/help/collaboration/session-tools/'],
      ['/help/canvas/workshop-mode', '/help/collaboration/session-tools'],
      [
        '/help/canvas/workshop-mode/workshop-tour/',
        '/help/selection-modes/avatar-mode/avatar-tour/',
      ],
      ['/help/collaboration/session-tools/polls/', '/help/collaboration/session-tools/'],
      ['/help/collaboration/session-tools/voting/', '/help/collaboration/session-tools/'],
      [
        '/help/collaboration/session-tools/voting/vote-privacy/',
        '/help/collaboration/session-tools/',
      ],
      ['/help/palette/behaviour/session-buttons/', '/help/palette/behaviour/'],
      ['/help/palette/behaviour/reveal-zones/', '/help/palette/behaviour/'],
      ['/help/palette/collaborate/', '/help/collaboration/session-tools/'],
      ['/help/palette/collaborate/quizzes/', '/help/collaboration/session-tools/'],
      ['/help/palette/collaborate/comment-panels/', '/help/collaboration/'],
      ['/help/palette/collaborate/action-panels/', '/help/collaboration/'],
      ['/help/palette/shapes/', '/help/canvas/the-canvas/adding-elements/'],
      ['/help/palette/shapes/style-presets/', '/help/canvas/the-canvas/adding-elements/'],
      ['/help/palette/arrows/', '/help/palette/tools/'],
      ['/help/palette/arrows/arrow-styles/', '/help/palette/tools/'],
      ['/help/palette/auto-attach-arrows/', '/help/palette/tools/'],
      ['/help/palette/lanes/', '/help/palette/virtual-office/'],
      ['/help/palette/timeline-rail/', '/help/palette/virtual-office/'],
      ['/help/palette/pointer-notes/', '/help/palette/write/'],
      ['/help/palette/embed-elements/website/', '/help/palette/tools/'],
      ['/help/palette/tools/tables/', '/help/palette/write/'],
      ['/help/palette/tools/drawing/shape-recognition/', '/help/palette/tools/'],
      ['/help/palette/tools/data-elements/pie-chart/', '/help/palette/tools/'],
      ['/help/canvas/annotations/', '/help/collaboration/'],
      // Comments, actions, links and notes left livehuddle (not-in-livehuddle.md).
      ['/help/collaboration/comments/', '/help/collaboration/'],
      ['/help/collaboration/assigned-actions/', '/help/collaboration/'],
      ['/help/canvas/links/', '/help/collaboration/'],
      ['/help/canvas/notes/', '/help/collaboration/'],
      ['/help/canvas/element-indicators/', '/help/collaboration/'],
      ['/help/tabs/linking-tabs/', '/help/tabs/using-tabs/'],
      ['/help/explorer/activity/', '/help/explorer/home/'],
      [
        '/help/getting-started/adding-shapes-and-arrows/',
        '/help/canvas/the-canvas/adding-elements/',
      ],
      // Auto Layout arranges shapes by their arrows, which a Space no longer draws (Work Tracker #494).
      ['/help/tools/layout-cleanup/auto-layout/', '/help/tools/layout-cleanup/'],
      // Shape Libraries and the draw.io, Microsoft Whiteboard and Markdown imports left livehuddle (Work Tracker #423
      // part 4).
      ['/help/explorer/shape-libraries/', '/help/explorer/explorer-page/'],
      ['/help/explorer/drawio-import/', '/help/tabs/import-tabs/'],
      ['/help/explorer/microsoft-whiteboard-import/', '/help/tabs/import-tabs/'],
      ['/help/tools/markdown-import/', '/help/tabs/import-tabs/'],
      // Element animations left livehuddle (2026-11-18).
      ['/help/canvas/animations/', '/help/canvas/'],
      // The Frame left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "The Frame"): its articles land on
      // Virtual Office, whose Rooms mark out an area of a Space.
      ['/help/palette/build/', '/help/palette/virtual-office/'],
      ['/help/palette/build/frames/', '/help/palette/virtual-office/'],
      // A retired category's link that lost its `/help` prefix lands on the help centre home too.
      ['/self-hosting', '/help/'],
      ['/self-hosting/', '/help/'],
      ['/self-hosting/deploying-livehuddle/', '/help/'],
      ['/self-hosting/configuration/drive-and-mcp', '/help/'],
    ];
    for (const [from, to] of cases) {
      const res = legacyHelpRedirect(new URL(`https://www.livehuddle.app${from}`))!;
      expect(res?.status, from).toBe(308);
      expect(res.headers.get('location')).toBe(`https://www.livehuddle.app${to}`);
    }
  });

  it('leaves articles that kept their address alone', () => {
    for (const path of [
      '/help/getting-started/your-first-space/',
      '/help/account-and-data/exporting-spaces/',
      '/help/tools/layout-cleanup/',
      '/help/tools/layout-cleanup/auto-align/',
      '/help/tabs/add-to-document/',
      '/help/canvas/draw-mode/',
      '/help/canvas/themes/',
      '/help/explorer/folders/',
      '/help/palette/tools/',
      '/help/palette/behaviour/',
      '/help/palette/virtual-office/',
      '/help/collaboration/session-tools/',
      '/self-hostingx/',
      '/help/self-hostingx/',
    ]) {
      expect(legacyHelpRedirect(new URL(`https://www.livehuddle.app${path}`)), path).toBeNull();
    }
  });

  it('redirects through the router before the help worker sees it', async () => {
    const { env, urls } = envWithLive();
    const res = await dispatch('/help/tabs/add-to-diagram/', env);
    expect(res.status).toBe(308);
    expect(urls).toEqual([]);
  });
});
