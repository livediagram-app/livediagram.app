import { describe, expect, it } from 'vitest';
import router, { type Env } from './index';
import { legacyEditorRedirect, legacyHelpRedirect } from './legacy-editor-route';

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
    LIVE: fetcher,
    API: fetcher,
    TELEMETRY: fetcher,
    HELP: fetcher,
  };
  return { env, urls };
}
const dispatch = (path: string, env: Env) =>
  router.fetch(new Request(`https://livediagram.app${path}`), env);

describe('legacyEditorRedirect', () => {
  it('permanently redirects /diagram/<id> to /document/<id>, keeping the query', () => {
    const res = legacyEditorRedirect(new URL('https://livediagram.app/diagram/abc-123?t=tab1'))!;
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://livediagram.app/document/abc-123?t=tab1');
  });

  it('redirects a share link and the bare segment', () => {
    expect(
      legacyEditorRedirect(
        new URL('https://livediagram.app/diagram/shared?s=CODE1234'),
      )!.headers.get('location'),
    ).toBe('https://livediagram.app/document/shared?s=CODE1234');
    expect(
      legacyEditorRedirect(new URL('https://livediagram.app/diagram'))!.headers.get('location'),
    ).toBe('https://livediagram.app/document');
  });

  it('leaves look-alike and current paths alone', () => {
    for (const path of ['/diagrams', '/diagramx/1', '/document/abc', '/help/diagram']) {
      expect(legacyEditorRedirect(new URL(`https://livediagram.app${path}`)), path).toBeNull();
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

  it('still serves the current editor route from the live worker', async () => {
    const { env, urls } = envWithLive();
    await dispatch('/document/abc-123', env);
    expect(urls).toEqual(['https://livediagram.app/document/abc-123']);
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
      // The Activity Panel was removed (docs/specs/012-collaboration/README.md); Undo / Redo moved to Canvas.
      ['/help/activity-panel/', '/help/canvas/undo/'],
      ['/help/activity-panel/undo/', '/help/canvas/undo/'],
      ['/help/activity-panel/redo/', '/help/canvas/redo/'],
      ['/help/activity-panel/what-it-is/', '/help/canvas/undo/'],
      ['/help/activity-panel/how-it-works/', '/help/canvas/undo/'],
      ['/help/activity-panel/reverting-changes/', '/help/canvas/undo/'],
    ];
    for (const [from, to] of cases) {
      const res = legacyHelpRedirect(new URL(`https://livediagram.app${from}`))!;
      expect(res?.status, from).toBe(308);
      expect(res.headers.get('location')).toBe(`https://livediagram.app${to}`);
    }
  });

  it('leaves articles that kept their address alone', () => {
    for (const path of [
      '/help/getting-started/your-first-diagram/',
      '/help/account-and-data/exporting-diagrams/',
      '/help/tabs/add-to-document/',
      '/help/canvas/draw-mode/',
    ]) {
      expect(legacyHelpRedirect(new URL(`https://livediagram.app${path}`)), path).toBeNull();
    }
  });

  it('redirects through the router before the help worker sees it', async () => {
    const { env, urls } = envWithLive();
    const res = await dispatch('/help/tabs/add-to-diagram/', env);
    expect(res.status).toBe(308);
    expect(urls).toEqual([]);
  });
});
