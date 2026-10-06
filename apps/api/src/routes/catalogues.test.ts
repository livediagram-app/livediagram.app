import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';
import { CATALOGUE_CACHE_CONTROL, handleCatalogues, ICON_SEARCH_DEFAULT_LIMIT } from './catalogues';

const get = (path: string, method = 'GET') =>
  handleCatalogues(makeTestRouteContext(method, path, { clerkUserId: null, owner: null }));
let logs: string[];

beforeEach(() => {
  logs = [];
  vi.spyOn(console, 'info').mockImplementation((line: string) => void logs.push(line));
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/templates', () => {
  it('lists the library with caching, no identity needed', async () => {
    const res = await get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CATALOGUE_CACHE_CONTROL);
    const body = (await res.json()) as { categories: unknown[]; templates: { kind: string }[] };
    expect(body.templates.some((t) => t.kind === 'kanban')).toBe(true);
    expect(logs).toEqual(['[catalogues] templates 200']);
  });

  it('shows one template as an outline, or its JSON', async () => {
    const text = await (await get('/api/templates/swot')).text();
    expect(text).toMatch(/^tab swot "SWOT[^"]*" · \d+ elements/);
    const json = (await (await get('/api/templates/swot?json=1')).json()) as {
      elements?: unknown[];
    };
    expect(json).toBeTypeOf('object');
  });

  it('refuses an unknown template naming the kinds, and a deeper path', async () => {
    const res = await get('/api/templates/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: 'unknown_template',
      kinds: expect.arrayContaining(['kanban']),
    });
    expect((await get('/api/templates/kanban/x')).status).toBe(404);
  });
});

describe('GET /api/icons', () => {
  it('searches both catalogues, the default limit applying', async () => {
    const body = (await (await get('/api/icons?query=database')).json()) as {
      icons: unknown[];
      more: number;
    };
    expect(body.icons.length).toBeLessThanOrEqual(ICON_SEARCH_DEFAULT_LIMIT);
    expect((await (await get('/api/icons?query=database&limit=2')).json()) as object).toMatchObject(
      { icons: [{}, {}] },
    );
  });

  it('refuses an empty or long query and a limit out of range', async () => {
    for (const path of [
      '/api/icons',
      `/api/icons?query=${'x'.repeat(61)}`,
      '/api/icons?query=db&limit=0',
      '/api/icons?query=db&limit=51',
      '/api/icons?query=db&limit=x',
    ]) {
      const res = await get(path);
      expect(res.status, path).toBe(400);
      expect(await res.json(), path).toMatchObject({ error: 'invalid_value' });
    }
    expect((await get('/api/icons/x')).status).toBe(404);
  });
});

describe('GET /api/schema', () => {
  it("lists the kinds, and one kind's format", async () => {
    expect(await (await get('/api/schema')).text()).toContain('Element kinds');
    const sticky = await get('/api/schema/sticky');
    expect(sticky.headers.get('Content-Type')).toContain('text/plain');
    expect(sticky.headers.get('Cache-Control')).toBe(CATALOGUE_CACHE_CONTROL);
    expect(await sticky.text()).toMatch(/^sticky: a sticky/);
  });

  it('refuses an unknown kind naming the kinds, and a deeper path', async () => {
    const res = await get('/api/schema/rectangle');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: 'unknown_kind',
      kinds: expect.arrayContaining(['square', 'arrow']),
    });
    expect((await get('/api/schema/square/x')).status).toBe(404);
  });
});

describe('the catalogue routes', () => {
  it('answer GET only', async () => {
    expect((await get('/api/schema', 'POST')).status).toBe(405);
    expect(logs).toEqual(['[catalogues] schema 405']);
  });
});
