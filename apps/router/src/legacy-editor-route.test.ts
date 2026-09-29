import { describe, expect, it } from 'vitest';
import router, { type Env } from './index';
import { legacyEditorRedirect } from './legacy-editor-route';

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
