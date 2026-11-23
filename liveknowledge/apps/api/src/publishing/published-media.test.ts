// A published page's pictures, drawings and cover (docs/specs/030-knowledgebase/publishing.md "Pictures on the public
// site"; blueprint publishing.md P31 to P36, Work Tracker 1346): what a reader with no identity sees and may fetch, and
// that nothing else of the media service is reachable from the public site.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { laidOutPagesOf } from '@liveknowledge/document';
import { clearImageGrantCachesForTests } from '../db/image-grants';
import { mediaImages } from '../db/test-image-fixtures';
import { clearMediaOwnersForTests } from '../media';
import { knowledgeKit, OWNER, page, type Kit } from '../routes/knowledge-test-kit';
import { mediaServiceFor, type TestMediaService } from '../test-media-service';
import { handlePublicSite } from './public-site';
import { PUBLIC_MEDIA_CSP } from './public-media';

vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearImageGrantCachesForTests();
  clearMediaOwnersForTests();
});

const ORIGIN = 'https://www.liveknowledge.app';

// Where a page's first (and only) sheet stands, so a zone and its elements can be placed on it as the editor does.
const SHEET = laidOutPagesOf({ id: 's', name: 's', elements: [] })[0]!;
const at = (x: number, y: number) => ({ page: SHEET.id, x, y });
const ox = SHEET.rect.x;
const oy = SHEET.rect.y;

const para = (id: string, text: string) => ({ id, type: 'paragraph', runs: [{ text }] });
const zone = (id: string, x: number, y: number, extra: object = {}) => ({
  id,
  type: 'zone',
  zone: 'object',
  width: 200,
  height: 100,
  at: at(x, y),
  ...extra,
});
const image = (id: string, imageId: string, x: number, y: number, alt?: string) => ({
  id,
  type: 'image',
  imageId,
  x: ox + x,
  y: oy + y,
  width: 200,
  height: 100,
  ...(alt ? { alt } : {}),
});
const box = (id: string, x: number, y: number, label: string) => ({
  id,
  type: 'shape',
  shape: 'square',
  x: ox + x,
  y: oy + y,
  width: 160,
  height: 40,
  label,
});

// The guide: a screenshot (with its words), a drawing, a chart-like object to the right, a zone never laid out, an
// empty zone, a picture of someone else's, and a cover picture.
const GUIDE = page(
  'guide',
  'Guide',
  [
    para('b1', 'Before the screenshot.'),
    zone('z1', 0, 0),
    para('b2', 'Between.'),
    zone('z2', 0, 200, { zone: 'drawing', wrap: 'left' }),
    zone('z3', 0, 400, { align: 'right', wrap: 'right' }),
    { id: 'z4', type: 'zone', zone: 'object', width: 50, height: 50 },
    zone('z5', 0, 600),
    zone('z6', 0, 800, { align: 'left' }),
    para('b3', 'After.'),
  ],
  {
    elements: [
      image('e1', 'pic-a', 0, 0, 'The deploy button'),
      box('e2', 20, 220, 'Step one'),
      box('e3', 20, 420, 'Object'),
      image('e4', 'pic-stranger', 0, 800),
    ],
    cover: { imageId: 'pic-cover', focus: 30, credit: 'By <Ana>' },
  },
);
const DRAFTS = page('drafts', 'Drafts', [para('b1', 'Nothing placed here.')], {
  cover: { gradient: 'theme-dawn' },
});
const MOVING = page('moving', 'Moving', [para('b1', 'An animated cover.')], {
  cover: { motion: 'aurora', colouring: 'deep' },
});

async function setUp(): Promise<{ kit: Kit; media: TestMediaService }> {
  const kit = await knowledgeKit({}, [GUIDE, DRAFTS, MOVING]);
  const media = mediaServiceFor(kit.db.env);
  mediaImages(media, OWNER, ['pic-a', 'pic-cover', 'pic-gallery']);
  mediaImages(media, 'user_x', ['pic-stranger']);
  return { kit, media };
}

const publish = (kit: Kit, address = 'handbook', id = 'kb') =>
  kit.call('editor', 'PUT', `/api/documents/${id}/publishing`, {
    address,
    root: null,
    noindex: false,
    showWriters: false,
  });

const read = (kit: Kit, path: string, init: RequestInit = {}) =>
  handlePublicSite(new Request(`${ORIGIN}${path}`, init), kit.db.env, () => {});

describe('a published page shows its pictures, drawings and cover', () => {
  it('draws them for a reader with no identity, and serves just those pictures', async () => {
    const { kit } = await setUp();
    expect((await publish(kit)).status).toBe(200);
    const html = await (await read(kit, '/kb/handbook')).text();
    // The screenshot, named by its words, at its own address under the site.
    expect(html).toContain(
      '<figure class="zone zone-picture align-center" style="max-width:200px">',
    );
    expect(html).toContain('role="img" aria-label="The deploy button"');
    expect(html).toContain('href="/kb/handbook/media/pic-a"');
    // The drawing, wrapped, its words drawn; an object to the right.
    expect(html).toContain('<figure class="zone zone-drawing align-center wrap-left"');
    expect(html).toContain('Step one');
    expect(html).toContain('<figure class="zone zone-object align-right wrap-right"');
    expect(html).toContain('aria-hidden="true"');
    // The cover band, its credit escaped.
    expect(html).toContain(
      '<div class="cover"><img src="/kb/handbook/media/pic-cover" alt="" style="object-position:50% 30%"',
    );
    expect(html).toContain('<span class="credit">By &lt;Ana&gt;</span>');
    // Someone else's picture keeps its frame: never linked, never served.
    expect(html).toContain('<figure class="zone zone-picture align-left"');
    expect(html).not.toContain('pic-stranger');
    expect(html.indexOf('Before the screenshot.')).toBeLessThan(html.indexOf('zone-picture'));

    const res = await read(kit, '/kb/handbook/media/pic-a');
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(Object.fromEntries(res.headers)).toMatchObject({
      'content-type': 'image/png',
      'cache-control': 'public, max-age=60',
      etag: '"pic-a"',
      'x-content-type-options': 'nosniff',
      'content-security-policy': PUBLIC_MEDIA_CSP,
      'cross-origin-resource-policy': 'same-origin',
    });
    expect((await read(kit, '/kb/handbook/media/pic-cover')).status).toBe(200);
    const head = await read(kit, '/kb/handbook/media/pic-a', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
  });

  it('paints a gradient cover, and an animated one still, in the style', async () => {
    const { kit } = await setUp();
    await publish(kit);
    for (const path of ['/kb/handbook/drafts', '/kb/handbook/moving']) {
      const html = await (await read(kit, path)).text();
      expect(html).toMatch(
        /<div class="cover" style="background:linear-gradient\(\d+deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)"><\/div>/,
      );
    }
  });

  it('answers a browser that holds the picture without reading it again', async () => {
    const { kit, media } = await setUp();
    await publish(kit);
    const before = media.calls.filter((c) => c.includes('/bytes')).length;
    const res = await read(kit, '/kb/handbook/media/pic-a', {
      headers: { 'If-None-Match': '"other", "pic-a"' },
    });
    expect(res.status).toBe(304);
    expect(res.headers.get('ETag')).toBe('"pic-a"');
    expect(media.calls.filter((c) => c.includes('/bytes')).length).toBe(before);
    expect(
      (await read(kit, '/kb/handbook/media/pic-a', { headers: { 'If-None-Match': '"x"' } })).status,
    ).toBe(200);
  });
});

describe('every other picture stays private', () => {
  it('refuses a picture no published page places, someone else’s, and an id no gallery holds', async () => {
    const { kit } = await setUp();
    await publish(kit);
    for (const path of [
      // In the owner's gallery, on no page.
      '/kb/handbook/media/pic-gallery',
      // Placed, but not the knowledgebase's to serve.
      '/kb/handbook/media/pic-stranger',
      // Unknown to everyone.
      '/kb/handbook/media/nope',
      // Not a published site.
      '/kb/nowhere/media/pic-a',
    ]) {
      const res = await read(kit, path);
      expect(res.status, path).toBe(404);
      expect(await res.text(), path).toBe('');
    }
    // An address no gallery id makes answers the site's not found page before any lookup.
    for (const path of ['/kb/handbook/media/%E0%A4%A', '/kb/handbook/media/data%3Aimage%2Fpng']) {
      expect(await (await read(kit, path)).text(), path).toContain('Page Not Found');
    }
    expect((await read(kit, '/kb/handbook/media/pic-a/more')).status).toBe(404);
  });

  it('refuses a picture another knowledgebase publishes, which its own site serves', async () => {
    const { kit, media } = await setUp();
    await publish(kit);
    // Another knowledgebase of the same owner, in its own Durable Object (its own kit), on the same media service.
    const other = await knowledgeKit({}, [
      page('other', 'Other', [para('b1', 'Its own.'), zone('z1', 0, 0)], {
        elements: [image('e1', 'pic-other', 0, 0)],
      }),
    ]);
    other.db.env.MEDIA_URL = kit.db.env.MEDIA_URL;
    other.db.env.MEDIA_KEY = kit.db.env.MEDIA_KEY;
    mediaImages(media, OWNER, ['pic-other']);
    expect((await publish(other, 'other-kb')).status).toBe(200);
    expect((await read(other, '/kb/other-kb/media/pic-other')).status).toBe(200);
    expect((await read(other, '/kb/other-kb/media/pic-a')).status).toBe(404);
    // The owner's picture, published elsewhere, is not this site's to serve.
    expect((await read(kit, '/kb/handbook/media/pic-other')).status).toBe(404);
  });

  it('keeps the pictures of a page left out private', async () => {
    const { kit } = await setUp();
    await kit.call('editor', 'PUT', '/api/documents/kb/publishing', {
      address: 'handbook',
      root: 'drafts',
      noindex: false,
      showWriters: false,
    });
    expect((await read(kit, '/kb/handbook/media/pic-a')).status).toBe(404);
  });
});

describe('a picture comes down with its page', () => {
  it('stops serving a picture removed from the page, and every picture on Unpublish', async () => {
    const { kit } = await setUp();
    await publish(kit);
    expect((await read(kit, '/kb/handbook/media/pic-a')).status).toBe(200);
    // The screenshot taken out of the page: the next read redraws it without.
    kit.db.sql.exec(
      `UPDATE tabs SET data = json_remove(data, '$.elements[0]'), rev = rev + 1 WHERE id = 'guide'`,
    );
    expect((await read(kit, '/kb/handbook/media/pic-a')).status).toBe(404);
    expect(await (await read(kit, '/kb/handbook')).text()).not.toContain('pic-a');
    expect((await read(kit, '/kb/handbook/media/pic-cover')).status).toBe(200);
    // Unpublish: every picture's address is in the purge, and nothing is served.
    const down = await kit.call('editor', 'DELETE', '/api/documents/kb/publishing');
    expect(JSON.parse(down.headers.get('X-Publish-Purge')!)).toContain(
      '/kb/handbook/media/pic-cover',
    );
    expect((await read(kit, '/kb/handbook/media/pic-cover')).status).toBe(404);
    expect(kit.db.sql.prepare('SELECT COUNT(*) AS n FROM published_media').get()).toEqual({
      n: 0,
    });
  });

  it('stops serving a picture the knowledgebase may no longer serve', async () => {
    const { kit, media } = await setUp();
    await publish(kit);
    // Deleted from its owner's gallery: nothing to read.
    media.objects.delete('pic-a');
    expect((await read(kit, '/kb/handbook/media/pic-a')).status).toBe(404);
    // Its grant gone: refused before any byte is read.
    kit.db.sql.exec(`UPDATE image_owners SET owner_id = 'user_x' WHERE image_id = 'pic-cover'`);
    clearImageGrantCachesForTests();
    expect((await read(kit, '/kb/handbook/media/pic-cover')).status).toBe(404);
  });

  it('redraws every page when the style changes, and not when it is written unchanged', async () => {
    const { kit } = await setUp();
    await publish(kit);
    await read(kit, '/kb/handbook');
    const dirty = () =>
      (
        kit.db.sql.prepare('SELECT tab FROM published_dirty ORDER BY tab').all() as {
          tab: string;
        }[]
      ).map((r) => r.tab);
    expect(dirty()).toEqual([]);
    kit.db.sql.exec('UPDATE document SET knowledge_style = knowledge_style');
    expect(dirty()).toEqual([]);
    kit.db.sql.exec(`UPDATE document SET knowledge_style = '{"theme":"ocean"}'`);
    expect(dirty()).toEqual(['drafts', 'guide', 'moving']);
  });
});

describe('the picture route’s edges', () => {
  it('keeps answers at the edge, answers a held picture from it, and never keeps a failure', async () => {
    const kept = new Map<string, Response>();
    vi.stubGlobal('caches', {
      default: {
        match: async (r: Request) => kept.get(r.url)?.clone(),
        put: async (r: Request, res: Response) => void kept.set(r.url, res),
        delete: async (r: Request) => kept.delete(r.url),
      },
    });
    const { kit, media } = await setUp();
    await publish(kit);
    const waits: Promise<unknown>[] = [];
    const fetchIt = (path: string, init: RequestInit = {}) =>
      handlePublicSite(new Request(`${ORIGIN}${path}`, init), kit.db.env, (p) => {
        waits.push(p);
      });
    expect((await fetchIt('/kb/handbook/media/pic-a')).status).toBe(200);
    await Promise.all(waits);
    expect(kept.has(`${ORIGIN}/kb/handbook/media/pic-a`)).toBe(true);
    const calls = media.calls.length;
    expect((await fetchIt('/kb/handbook/media/pic-a')).status).toBe(200);
    expect(
      (await fetchIt('/kb/handbook/media/pic-a', { headers: { 'If-None-Match': '"pic-a"' } }))
        .status,
    ).toBe(304);
    expect(media.calls.length).toBe(calls);
    // A refusal is kept too, for the same minute.
    expect((await fetchIt('/kb/handbook/media/pic-gallery')).status).toBe(404);
    await Promise.all(waits);
    expect((await fetchIt('/kb/handbook/media/pic-gallery')).status).toBe(404);
    // The media service down: not kept, so the next fetch tries again.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    media.objects.delete('pic-cover');
    vi.stubGlobal('fetch', async () => {
      throw new Error('down');
    });
    const failed = await fetchIt('/kb/handbook/media/pic-cover');
    expect(failed.status).toBe(404);
    expect(failed.headers.get('Cache-Control')).toBe('no-store');
    expect(warn).toHaveBeenCalledWith('[publishing] media_unreadable', expect.anything());
    await Promise.all(waits);
    expect(kept.has(`${ORIGIN}/kb/handbook/media/pic-cover`)).toBe(false);
  });

  it('serves the picture when the edge cache fails', async () => {
    const down = async () => {
      throw new Error('down');
    };
    vi.stubGlobal('caches', { default: { match: down, put: down, delete: down } });
    const { kit } = await setUp();
    await publish(kit);
    const waits: Promise<unknown>[] = [];
    const res = await handlePublicSite(
      new Request(`${ORIGIN}/kb/handbook/media/pic-a`),
      kit.db.env,
      (p) => void waits.push(p),
    );
    expect(res.status).toBe(200);
    await expect(Promise.all(waits)).resolves.toBeDefined();
  });

  it('answers nothing, and keeps nothing, when this deploy has no media service', async () => {
    const { kit } = await setUp();
    await publish(kit);
    delete kit.db.env.MEDIA_KEY;
    const res = await read(kit, '/kb/handbook/media/pic-a');
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('follows a site that moved, to the same picture at its new address', async () => {
    const { kit } = await setUp();
    await publish(kit);
    await publish(kit, 'guides');
    const res = await read(kit, '/kb/handbook/media/pic-a');
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('/kb/guides/media/pic-a');
    expect((await read(kit, '/kb/guides/media/pic-a')).status).toBe(200);
  });

  it('limits the fetches the edge has not kept per network, apart from search', async () => {
    const keys: string[] = [];
    let allow = true;
    const { kit } = await setUp();
    kit.db.env.SEARCH_RATE_LIMITER = {
      limit: async ({ key }) => {
        keys.push(key);
        return { success: allow };
      },
    };
    await publish(kit);
    const init = { headers: { 'CF-Connecting-IP': '203.0.113.9' } };
    expect((await read(kit, '/kb/handbook/media/pic-a', init)).status).toBe(200);
    allow = false;
    const res = await read(kit, '/kb/handbook/media/pic-a', init);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(keys.every((k) => k.startsWith('kb-media:'))).toBe(true);
  });
});
