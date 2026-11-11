// list_images and the imageId check (docs/specs/015-api/mcp-server.md §4.5b, docs/specs/009-elements/images.md
// "Agents").
import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { contactSheetTab, IMAGES_UNAVAILABLE } from './image-tools';
import { registerTools } from './tools';

// The SVG each preview drew, so a test reads what the contact sheet holds (resvg's wasm does not load here).
const drawn: string[] = [];
vi.mock('@liveworkspace/mcp-kit/render', () => ({
  svgToPngBase64: async (svg: string) => {
    drawn.push(svg);
    return 'cG5n';
  },
}));

type Handler = (args: unknown, extra: unknown) => Promise<unknown>;
type Result = { isError?: boolean; content: { type: string; text?: string }[] };

// A 1x1 transparent PNG, the bytes an image read answers.
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

const GALLERY = {
  images: [
    {
      id: 'shot-1',
      contentType: 'image/png',
      byteSize: 2048,
      width: 1280,
      height: 800,
      originalName: 'Screenshot dashboard.png',
      createdAt: 2,
    },
    {
      id: 'shot-2',
      contentType: 'image/png',
      byteSize: 4096,
      width: 800,
      height: 600,
      originalName: 'Logo.png',
      createdAt: 1,
    },
  ],
};

function harness(images: 'ok' | 'none' = 'ok') {
  const calls: string[] = [];
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => handlers.set(name, handler),
  } as unknown as McpServer;
  const env = {
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/events')) return new Response(null, { status: 204 });
        calls.push(`${request.method} ${url.pathname}`);
        if (url.pathname === '/api/images')
          return images === 'ok'
            ? Response.json(GALLERY)
            : Response.json({ error: 'images_unavailable' }, { status: 503 });
        if (url.pathname.startsWith('/api/images/'))
          return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
        // Anything else stops the handler at its first write: the check under test has already run by then.
        return Response.json({ error: 'not in this test' }, { status: 500 });
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const call = (name: string, args: unknown) =>
    handlers.get(name)!(args, { authInfo: { token: 'tok_test' } }) as Promise<Result>;
  return { calls, call };
}

const json = (r: Result) => JSON.parse(r.content[0]!.text!) as unknown;

describe('list_images', () => {
  it('lists the caller’s gallery newest first, filtered by name', async () => {
    const { calls, call } = harness();
    const result = await call('list_images', { query: 'screenshot' });
    expect(calls).toEqual(['GET /api/images']);
    expect(json(result)).toEqual({
      images: [
        {
          id: 'shot-1',
          name: 'Screenshot dashboard.png',
          width: 1280,
          height: 800,
          size: 2048,
          uploadedAt: '1970-01-01T00:00:00.002Z',
        },
      ],
      more: 0,
    });
    expect(result.content.some((c) => c.type === 'image')).toBe(false);
  });

  it('attaches a contact sheet drawn with each picture’s bytes', async () => {
    const { calls, call } = harness();
    const result = await call('list_images', { image: true });
    expect(calls).toContain('GET /api/images/shot-1');
    expect(calls).toContain('GET /api/images/shot-2');
    expect(result.content.at(-1)).toMatchObject({ type: 'image', mimeType: 'image/png' });
    const svg = drawn.at(-1)!;
    expect(svg.match(/data:image\/png;base64/g)).toHaveLength(2);
    expect(svg).toContain('1. Screenshot dashboard.png');
    expect(svg).toContain('2. Logo.png');
  });

  it('says so when the server keeps no images', async () => {
    const { call } = harness('none');
    const result = await call('list_images', {});
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain(IMAGES_UNAVAILABLE);
  });
});

describe('the imageId check on writes', () => {
  const page = (imageId: string | null) => ({
    name: 'Doc',
    tabs: [
      {
        name: 'Page',
        elements: [{ id: 'hero', type: 'image', x: 0, y: 0, width: 640, height: 400, imageId }],
      },
    ],
  });

  it('refuses a picture the gallery does not hold, before writing anything', async () => {
    const { calls, call } = harness();
    const result = await call('create_document', page('someone-elses'));
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain(
      'imageId "someone-elses" on element "hero" is not in your image gallery',
    );
    expect(calls).toEqual(['GET /api/images']);
  });

  it('lets a gallery picture through to the write', async () => {
    const { calls, call } = harness();
    // The write itself fails in this harness: what matters is that it was reached.
    await call('create_document', page('shot-1')).catch(() => undefined);
    expect(calls[0]).toBe('GET /api/images');
    expect(calls.length).toBeGreaterThan(1);
  });

  it('reads no gallery when nothing places a picture', async () => {
    const { calls, call } = harness();
    await call('create_document', page(null)).catch(() => undefined);
    expect(calls).not.toContain('GET /api/images');
  });

  it('checks add_tab and update_document’s ops too', async () => {
    const { call } = harness();
    const added = await call('add_tab', {
      documentId: 'd1',
      name: 'Page',
      elements: page('nope').tabs[0]!.elements,
    });
    expect(added.content[0]!.text).toContain('imageId "nope"');
    const updated = await call('update_document', {
      documentId: 'd1',
      mode: 'ops',
      ops: [{ op: 'update', elementId: 'hero', element: { imageId: 'nope' } }],
    });
    expect(updated.isError).toBe(true);
    expect(updated.content[0]!.text).toContain('imageId "nope" on element "hero"');
  });

  it('says so when the server keeps no images', async () => {
    const { call } = harness('none');
    const result = await call('create_document', page('shot-1'));
    expect(result.content[0]!.text).toContain(IMAGES_UNAVAILABLE);
  });
});

describe('contactSheetTab', () => {
  it('lays pictures four a row, each above its place and name, at most twelve', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      id: `p${i}`,
      name: i === 0 ? 'A very long screenshot name that goes on and on.png' : `p${i}.png`,
      width: 10,
      height: 10,
      size: 1,
      uploadedAt: '',
    }));
    const tab = contactSheetTab(many);
    const pictures = tab.elements.filter((e) => e.type === 'image');
    expect(pictures).toHaveLength(12);
    expect(pictures.map((p) => [p.x, p.y]).slice(0, 5)).toEqual([
      [0, 0],
      [344, 0],
      [688, 0],
      [1032, 0],
      [0, 288],
    ]);
    const captions = tab.elements.filter((e) => e.type === 'text').map((e) => e.label);
    expect(pictures.every((p) => p.type === 'image' && p.imageId)).toBe(true);
    expect(captions[0]).toBe('1. A very long screenshot name that goe…');
    expect(captions[1]).toBe('2. p1.png');
  });

  const drawnIds = (tab: ReturnType<typeof contactSheetTab>) =>
    tab.elements.flatMap((e) => (e.type === 'image' ? [e.imageId] : []));

  it("draws pictures within the preview's pixel budget, and captions the rest as too large", () => {
    // A retina screenshot of a 1440x900 screen (5.2 megapixels) fits eight megapixels once; a 1464x784 one still fits
    // after it, a second retina one does not.
    const shot = (id: string, width: number, height: number) => ({
      id,
      name: `${id}.png`,
      width,
      height,
      size: 1,
      uploadedAt: '',
    });
    const tab = contactSheetTab([
      shot('r0', 2880, 1800),
      shot('r1', 2880, 1800),
      shot('s2', 1464, 784),
    ]);
    expect(drawnIds(tab)).toEqual(['r0', null, 's2']);
    expect(tab.elements.find((e) => e.id === 'caption-2')?.label).toBe(
      '2. r1.png\n(too large to draw here)',
    );
  });

  it("keeps to the preview's byte limits: 2 MB a picture, 6 MB together", () => {
    const mb = 1024 * 1024;
    const file = (id: string, size: number) => ({
      id,
      name: id,
      width: 10,
      height: 10,
      size,
      uploadedAt: '',
    });
    const tab = contactSheetTab([
      file('huge', 2 * mb + 1),
      file('a', 2 * mb),
      file('b', 2 * mb),
      file('c', 2 * mb),
      file('d', 1),
    ]);
    expect(drawnIds(tab)).toEqual([null, 'a', 'b', 'c', null]);
  });
});

// upload_image and delete_image (docs/specs/015-api/mcp-server.md §4.5c, §4.5d): wired to the caller's own api, as
// they are; a refusal answers as a tool error in words.
function galleryHarness() {
  const calls: { method: string; path: string; headers: Headers; bytes: number }[] = [];
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => handlers.set(name, handler),
  } as unknown as McpServer;
  const env = {
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/events')) return new Response(null, { status: 204 });
        const body = await request.arrayBuffer();
        calls.push({
          method: request.method,
          path: url.pathname,
          headers: request.headers,
          bytes: body.byteLength,
        });
        if (url.pathname === '/api/images' && request.method === 'POST') {
          const image = { ...GALLERY.images[0]!, id: 'new-1', originalName: 'Chart.png' };
          return Response.json({ image, deduped: false });
        }
        if (url.pathname === '/api/images') return Response.json(GALLERY);
        if (url.pathname === '/api/images/usage') {
          return Response.json({
            usage: { 'shot-1': [{ id: 'item-1', name: 'Launch plan', app: 'livediagram' }] },
          });
        }
        if (request.method === 'DELETE') return Response.json({ ok: true });
        return Response.json({ error: 'not in this test' }, { status: 500 });
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const call = (name: string, args: unknown) =>
    handlers.get(name)!(args, { authInfo: { token: 'tok_test' } }) as Promise<
      Result & { structuredContent?: Record<string, unknown> }
    >;
  return { calls, call };
}

const PNG_BASE64 = btoa(String.fromCharCode(...PNG));

describe('upload_image', () => {
  it('uploads base64 bytes as the caller, marked as the MCP’s, and answers the new image', async () => {
    const { calls, call } = galleryHarness();
    const result = await call('upload_image', { data: PNG_BASE64, name: 'Chart.png' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      id: 'new-1',
      name: 'Chart.png',
      deduped: false,
    });
    const [post] = calls;
    expect(post).toMatchObject({ method: 'POST', path: '/api/images', bytes: PNG.byteLength });
    expect(post!.headers.get('Authorization')).toBe('Bearer tok_test');
    expect(post!.headers.get('X-Image-Source')).toBe('mcp');
    expect(post!.headers.get('X-Image-Width')).toBe('1');
  });

  it('refuses SVG and a private URL in words, sending nothing', async () => {
    const { calls, call } = galleryHarness();
    const svg = await call('upload_image', { data: btoa('<svg onload="alert(1)"/>') });
    expect(svg.isError).toBe(true);
    expect(svg.content[0]!.text).toMatch(/^That is SVG or other markup/);
    const inward = await call('upload_image', { url: 'https://169.254.169.254/latest/meta-data' });
    expect(inward.isError).toBe(true);
    expect(inward.content[0]!.text).toContain('private, loopback, link-local or internal address');
    expect(calls).toEqual([]);
  });
});

describe('delete_image', () => {
  it('removes an unused picture, keeps a placed one, and says where it is used', async () => {
    const { calls, call } = galleryHarness();
    const result = await call('delete_image', { imageIds: ['shot-1', 'shot-2', 'not-mine'] });
    expect(result.structuredContent).toEqual({
      results: [
        {
          id: 'shot-1',
          outcome: 'in_use',
          name: 'Screenshot dashboard.png',
          usedIn: [{ id: 'item-1', name: 'Launch plan', app: 'livediagram' }],
        },
        { id: 'shot-2', outcome: 'deleted', name: 'Logo.png' },
        { id: 'not-mine', outcome: 'not_found' },
      ],
      deleted: 1,
      kept: 2,
    });
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual([
      '/api/images/shot-2',
    ]);
  });

  it('removes a placed picture when forced', async () => {
    const { calls, call } = galleryHarness();
    const result = await call('delete_image', { imageIds: ['shot-1'], force: true });
    expect(result.structuredContent).toMatchObject({ deleted: 1, kept: 0 });
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual([
      '/api/images/shot-1',
    ]);
  });
});
