import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';

// GET /api/designs/:id/tabs/:tabId/render.svg (docs/specs/015-api/api.md): one tab drawn by the shared renderer.

let sql: SqliteD1;

const call = (path: string, owner = 'owner', method = 'GET') =>
  handleDesigns(
    makeTestRouteContext(method, `/api/designs/d1/tabs/${path}`, { env: sql.env, owner }),
  );

beforeEach(() => {
  sql = sqliteD1();
  sql.sql.exec(`
    INSERT INTO test_designs (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'owner', 'Shop', 0, 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Main', '{"elements":[{"id":"a","type":"shape","shape":"square","x":0,"y":0,"width":100,"height":60,"label":"Web app"}]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Empty', '{"elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t3', 'Broken', '{"elements":', 1);
    INSERT INTO design_tabs (design_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO design_tabs (design_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
    INSERT INTO design_tabs (design_id, tab_id, order_index, added_at) VALUES ('d1', 't3', 2, 1);
  `);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('the tab render route', () => {
  // docs/specs/009-elements/components.md "Exports, thumbnails and agents": an instance draws its main.
  it("draws an instance as its main's elements, and a missing main as the missing frame", async () => {
    sql.sql.exec(`
      INSERT INTO tabs (id, name, data, updated_at) VALUES ('t4', 'Uses', '{"elements":[{"id":"i1","type":"shape","shape":"instance","componentId":"c1","x":0,"y":0,"width":200,"height":80},{"id":"i2","type":"shape","shape":"instance","componentId":"gone","x":0,"y":100,"width":50,"height":50}]}', 1);
      INSERT INTO design_tabs (design_id, tab_id, order_index, added_at) VALUES ('d1', 't4', 3, 1);
      INSERT INTO components (id, data, updated_at) VALUES ('c1', '{"id":"c1","name":"Nav","width":100,"height":40,"elements":[{"id":"e1","type":"shape","shape":"square","x":0,"y":0,"width":100,"height":40,"label":"Main nav"}],"updatedAt":1}', 1);
    `);
    const svg = await (await call('t4/render.svg')).text();
    expect(svg).toContain('Main nav');
    expect(svg).toContain('stroke-dasharray="6 5"');
  });

  it('draws a tab as SVG, never cached', async () => {
    const res = await call('t1/render.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const svg = await res.text();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Web app');
  });

  it('draws an empty tab too', async () => {
    const res = await call('t2/render.svg');
    expect(res.status).toBe(200);
    expect((await res.text()).startsWith('<svg')).toBe(true);
  });

  it('answers 404 for a tab not in the design or one that does not parse, and refuses a stranger', async () => {
    expect((await call('t9/render.svg')).status).toBe(404);
    expect((await call('t3/render.svg')).status).toBe(404);
    expect(console.warn).toHaveBeenCalledWith(
      '[render] tab unreadable',
      expect.objectContaining({ tabId: 't3' }),
    );
    expect((await call('t1/render.svg', 'stranger')).status).toBe(403);
    expect((await call('t1/render.svg', 'owner', 'POST')).status).not.toBe(200);
  });
});
