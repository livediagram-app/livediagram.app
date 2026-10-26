// Previews on an app's address (liveworkspace/docs/previews.md "The addresses"): what each router forwards to the
// media service, and how.
import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_PREVIEWS_ORIGIN,
  previewsTargetFor,
  routeToPreviews,
  WORKSPACE_CLIENT_IP_HEADER,
} from './workspace-proxy';

describe('previewsTargetFor', () => {
  it.each([
    ['/api/previews/items/abc', '/api/previews/items/abc'],
    ['/api/previews', '/api/previews'],
    ['/api/share/ABC123/image.svg', '/api/previews/share/ABC123/image.svg'],
    ['/api/share/ABC123/image.png', '/api/previews/share/ABC123/image.png'],
    ['/api/share/ABC123/card', '/api/previews/share/ABC123/card'],
    // What a link opens stays the app's.
    ['/api/share/ABC123', null],
    ['/api/share/ABC123/other', null],
    ['/api/previewsx', null],
    ['/api/documents/abc/thumbnail', null],
  ])('%s', (path, target) => {
    expect(previewsTargetFor(path)).toBe(target);
  });
});

describe('routeToPreviews', () => {
  const capture = () => {
    const seen: Request[] = [];
    const doFetch = (async (input: RequestInfo | URL) => {
      seen.push(input as Request);
      return new Response('ok');
    }) as typeof fetch;
    return { seen, doFetch };
  };

  it("forwards with the token and share headers, without the site's cookies", async () => {
    const { seen, doFetch } = capture();
    const request = new Request('https://liveplanner.app/api/previews/items/I1?v=5', {
      headers: {
        Authorization: 'Bearer t',
        'X-Share-Code': 'CODE',
        Cookie: 'session=1',
        'CF-Connecting-IP': '198.51.100.7',
      },
    });
    await routeToPreviews(request, undefined, doFetch);
    expect(seen[0]!.url).toBe(`${PRODUCTION_PREVIEWS_ORIGIN}/api/previews/items/I1?v=5`);
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer t');
    expect(seen[0]!.headers.get('X-Share-Code')).toBe('CODE');
    expect(seen[0]!.headers.has('Cookie')).toBe(false);
    expect(seen[0]!.headers.get(WORKSPACE_CLIENT_IP_HEADER)).toBe('198.51.100.7');
  });

  it('sends an old live image address to the service, query and all', async () => {
    const { seen, doFetch } = capture();
    const request = new Request(
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/share/ABC/image.svg?tab=T1',
    );
    await routeToPreviews(request, 'http://127.0.0.1:8792', doFetch);
    expect(seen[0]!.url).toBe('http://127.0.0.1:8792/api/previews/share/ABC/image.svg?tab=T1');
  });

  it('leaves every other path to the router, and refuses to forward to itself', async () => {
    const { doFetch } = capture();
    expect(
      routeToPreviews(
        new Request('https://livediagram-router.liveworkspace-easing509.workers.dev/api/documents'),
        undefined,
        doFetch,
      ),
    ).toBeNull();
    const self = await routeToPreviews(
      new Request('https://liveworkspace.app/api/previews/items/I1'),
      undefined,
      doFetch,
    );
    expect(self!.status).toBe(508);
  });
});
