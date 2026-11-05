import { describe, expect, it } from 'vitest';
import router, { type Env } from './index';
import {
  legacyEditorRedirect,
  legacyFormRedirect,
  legacyHelpRedirect,
  liveplannerOrigin,
} from './legacy-editor-route';

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

describe('legacyEditorRedirect', () => {
  it('permanently redirects /diagram/<id> to /document/<id>, keeping the query', () => {
    const res = legacyEditorRedirect(new URL('https://www.livehuddle.app/diagram/abc-123?t=tab1'))!;
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://www.livehuddle.app/document/abc-123?t=tab1');
  });

  it('redirects a share link and the bare segment', () => {
    expect(
      legacyEditorRedirect(
        new URL('https://www.livehuddle.app/diagram/shared?s=CODE1234'),
      )!.headers.get('location'),
    ).toBe('https://www.livehuddle.app/document/shared?s=CODE1234');
    expect(
      legacyEditorRedirect(new URL('https://www.livehuddle.app/diagram'))!.headers.get('location'),
    ).toBe('https://www.livehuddle.app/document');
  });

  it('leaves look-alike and current paths alone', () => {
    for (const path of ['/diagrams', '/diagramx/1', '/document/abc', '/help/diagram']) {
      expect(legacyEditorRedirect(new URL(`https://www.livehuddle.app${path}`)), path).toBeNull();
    }
  });
});

describe('router dispatch of the legacy editor route', () => {
  it('redirects before any worker sees the request', async () => {
    const { env, urls } = envWithLive();
    const res = await dispatch('/diagram/abc-123', env);
    expect(res.status).toBe(308);
    expect(urls).toEqual([]);
  });

  it('still serves the current editor route from the editor worker', async () => {
    const { env, urls } = envWithLive();
    await dispatch('/document/abc-123', env);
    expect(urls).toEqual(['https://www.livehuddle.app/document/abc-123']);
  });
});

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
      // Whiteboarding became Draw mode (docs/specs/007-editor/editor-modes.md "Naming in the interface").
      ['/help/canvas/whiteboards/', '/help/canvas/draw-mode/'],
      // Pages mode (once Infographics, then Illustrate) left livehuddle: every article of the three
      // sections lands on Editor Modes (docs/specs/007-editor/editor-modes.md).
      ['/help/canvas/illustrate/', '/help/canvas/editor-modes/'],
      ['/help/canvas/illustrate/illustrate-tour/', '/help/canvas/editor-modes/'],
      ['/help/canvas/illustrate/slide-pages', '/help/canvas/editor-modes'],
      ['/help/canvas/infographics/', '/help/canvas/editor-modes/'],
      ['/help/canvas/infographics/exporting-infographics/', '/help/canvas/editor-modes/'],
      ['/help/canvas/pages-mode/', '/help/canvas/editor-modes/'],
      ['/help/canvas/pages-mode/pages-tour/', '/help/canvas/editor-modes/'],
      ['/help/canvas/pages-mode/wireframe-pages/', '/help/canvas/editor-modes/'],
      // Plan mode left livehuddle for liveplanner the same way.
      ['/help/canvas/plan-mode/', '/help/canvas/editor-modes/'],
      ['/help/canvas/plan-mode/boards/', '/help/canvas/editor-modes/'],
      ['/help/canvas/plan-mode/sheet-functions', '/help/canvas/editor-modes'],
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
      // The Activity Panel was removed (docs/specs/012-collaboration/README.md); Undo / Redo moved to Canvas.
      ['/help/activity-panel/', '/help/canvas/undo/'],
      ['/help/activity-panel/undo/', '/help/canvas/undo/'],
      ['/help/activity-panel/redo/', '/help/canvas/redo/'],
      ['/help/activity-panel/what-it-is/', '/help/canvas/undo/'],
      ['/help/activity-panel/how-it-works/', '/help/canvas/undo/'],
      ['/help/activity-panel/reverting-changes/', '/help/canvas/undo/'],
      // The Welcome Tour became the Diagram Tour (docs/specs/007-editor/editor-tour.md).
      ['/help/getting-started/welcome-tour/', '/help/getting-started/diagram-tour/'],
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
      ['/help/tools/ai/', '/help/account-and-data/connect-ai-mcp/'],
      ['/help/tools/ai/ai-tools/', '/help/account-and-data/connect-ai-mcp/'],
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
      ['/help/palette/collaborate/comment-panels/', '/help/collaboration/comments/'],
      ['/help/palette/collaborate/action-panels/', '/help/collaboration/assigned-actions/'],
      ['/help/palette/shapes/', '/help/canvas/the-canvas/adding-elements/'],
      ['/help/palette/shapes/style-presets/', '/help/canvas/the-canvas/adding-elements/'],
      ['/help/palette/arrows/', '/help/palette/tools/'],
      ['/help/palette/arrows/arrow-styles/', '/help/palette/tools/'],
      ['/help/palette/auto-attach-arrows/', '/help/palette/tools/'],
      ['/help/palette/lanes/', '/help/palette/virtual-office/'],
      ['/help/palette/timeline-rail/', '/help/palette/virtual-office/'],
      ['/help/palette/pointer-notes/', '/help/palette/write/'],
      ['/help/palette/embed-elements/website/', '/help/palette/tools/images/'],
      ['/help/palette/tools/tables/', '/help/palette/write/'],
      ['/help/palette/tools/drawing/shape-recognition/', '/help/palette/tools/'],
      ['/help/palette/tools/data-elements/pie-chart/', '/help/palette/tools/'],
      ['/help/canvas/annotations/', '/help/canvas/notes/'],
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

describe('legacyFormRedirect', () => {
  const at = (path: string) => new URL(`https://www.livehuddle.app${path}`);

  it('sends an old form link to the same path on liveplanner, for good, keeping the query', () => {
    const res = legacyFormRedirect(at('/form/AbC123?embed=1'), undefined)!;
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://www.liveplanner.app/form/AbC123?embed=1');
    expect(legacyFormRedirect(at('/form'), undefined)!.headers.get('location')).toBe(
      'https://www.liveplanner.app/form',
    );
    expect(legacyFormRedirect(at('/form/'), undefined)!.headers.get('location')).toBe(
      'https://www.liveplanner.app/form/',
    );
  });

  it("names liveplanner's address for each deployment", () => {
    expect(liveplannerOrigin(undefined)).toBe('https://www.liveplanner.app');
    expect(liveplannerOrigin('staging')).toBe('https://staging.liveplanner.app');
    expect(liveplannerOrigin('local')).toBe('http://localhost:3200');
    expect(legacyFormRedirect(at('/form/CODE'), 'staging')!.headers.get('location')).toBe(
      'https://staging.liveplanner.app/form/CODE',
    );
    expect(legacyFormRedirect(at('/form/CODE'), 'local')!.headers.get('location')).toBe(
      'http://localhost:3200/form/CODE',
    );
  });

  it('leaves look-alike paths alone', () => {
    for (const path of ['/forms', '/formx/1', '/help/form', '/document/form']) {
      expect(legacyFormRedirect(at(path), undefined), path).toBeNull();
    }
  });

  it('redirects through the router before the editor sees it', async () => {
    const { env, urls } = envWithLive();
    const res = await dispatch('/form/CODE1234', env);
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://www.liveplanner.app/form/CODE1234');
    expect(urls).toEqual([]);
  });
});
