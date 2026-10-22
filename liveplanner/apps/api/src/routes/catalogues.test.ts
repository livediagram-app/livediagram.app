import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';
import { CATALOGUE_CACHE_CONTROL, handleCatalogues } from './catalogues';

const get = (path: string, method = 'GET') =>
  handleCatalogues(makeTestRouteContext(method, path, { accountUserId: null, owner: null }));
let logs: string[];

beforeEach(() => {
  logs = [];
  vi.spyOn(console, 'info').mockImplementation((line: string) => void logs.push(line));
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/templates', () => {
  it('lists the library with caching, no identity needed', async () => {
    const res = get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CATALOGUE_CACHE_CONTROL);
    const body = (await res.json()) as { categories: unknown[]; templates: { kind: string }[] };
    expect(body.templates.some((t) => t.kind === 'kanban')).toBe(true);
    expect(logs).toEqual(['[catalogues] templates 200']);
  });

  it('shows one template as an outline, or its JSON', async () => {
    const text = await get('/api/templates/swot').text();
    expect(text).toMatch(/^tab swot "SWOT[^"]*" · \d+ elements/);
    const json = (await get('/api/templates/swot?json=1').json()) as {
      elements?: unknown[];
    };
    expect(json).toBeTypeOf('object');
  });

  it('refuses an unknown template naming the kinds, and a deeper path', async () => {
    const res = get('/api/templates/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: 'unknown_template',
      kinds: expect.arrayContaining(['kanban']),
    });
    expect(get('/api/templates/kanban/x').status).toBe(404);
  });
});

describe('GET /api/schema', () => {
  it("lists the kinds, and one kind's format", async () => {
    expect(await get('/api/schema').text()).toContain('Element kinds');
    const sticky = get('/api/schema/sticky');
    expect(sticky.headers.get('Content-Type')).toContain('text/plain');
    expect(sticky.headers.get('Cache-Control')).toBe(CATALOGUE_CACHE_CONTROL);
    expect(await sticky.text()).toMatch(/^sticky: a sticky/);
  });

  it('refuses an unknown kind naming the kinds, and a deeper path', async () => {
    const res = get('/api/schema/rectangle');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: 'unknown_kind',
      kinds: expect.arrayContaining(['square', 'arrow']),
    });
    expect(get('/api/schema/square/x').status).toBe(404);
  });
});

describe('the catalogue routes', () => {
  it('answer GET only', () => {
    expect(get('/api/schema', 'POST').status).toBe(405);
    expect(logs).toEqual(['[catalogues] schema 405']);
  });
});
