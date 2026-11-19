import { describe, expect, it } from 'vitest';
import { parse } from 'smol-toml';
import { wranglerPart } from './wrangler';

const partOf = (toml: string, env?: string) => {
  const built = wranglerPart(parse(toml), 'fallback', env);
  if (!built.ok) throw new Error(built.error.message);
  return built.part;
};

const FULL = `
name = "shop-api"
main = "src/index.ts"
compatibility_date = "2026-01-01"
workers_dev = false
routes = ["shop.example.com/api/*", { pattern = "api.example.com/*", zone_name = "example.com" }]

[vars]
MODE = "prod"

[observability]
enabled = true

[[kv_namespaces]]
binding = "CACHE"
id = "abc123"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "shop-media"

[[d1_databases]]
binding = "DB"
database_name = "shop-db"
database_id = "x"

[[queues.producers]]
binding = "JOBS"
queue = "shop-jobs"

[[queues.consumers]]
queue = "shop-jobs"

[durable_objects]
bindings = [
  { name = "ROOM", class_name = "Room" },
  { name = "COUNTER", class_name = "Counter", script_name = "counter-worker" },
]

[[services]]
binding = "AUTH"
service = "auth-worker"

[ai]
binding = "AI"

[images]
binding = "IMAGES"

[browser]
binding = "BROWSER"

[assets]
directory = "./public"

[[vectorize]]
binding = "VEC"
index_name = "products"

[[hyperdrive]]
binding = "PG"
id = "h1"

[[analytics_engine_datasets]]
binding = "AE"
dataset = "events"

[[workflows]]
binding = "FLOW"
name = "checkout"
class_name = "Checkout"

[triggers]
crons = ["0 * * * *", "*/5 * * * *"]

[env.staging]
name = "shop-api-staging"

[env.preview]
name = "shop-api-preview"
`;

describe('wranglerPart', () => {
  it('draws the Worker and a box for every binding, each joined from the Worker', () => {
    const part = partOf(FULL);
    expect(part.title).toBe('shop-api');
    const byId = Object.fromEntries(part.nodes.map((n) => [n.id, n]));
    expect(byId['worker-shop-api']).toMatchObject({ label: 'shop-api', icon: 'cf-workers' });
    expect(byId['kv-abc123']).toMatchObject({ label: 'CACHE', icon: 'cf-kv' });
    expect(byId['r2-shop-media']).toMatchObject({ label: 'shop-media', icon: 'cf-r2' });
    expect(byId['d1-shop-db']).toMatchObject({ label: 'shop-db', icon: 'cf-d1' });
    expect(byId['queue-shop-jobs']).toMatchObject({ icon: 'cf-queues' });
    expect(byId['do-shop-api-room']).toMatchObject({ label: 'Room', icon: 'cf-durable-objects' });
    expect(byId['do-counter-worker-counter']).toMatchObject({ note: 'hosted by counter-worker' });
    expect(byId['worker-auth-worker']).toMatchObject({ label: 'auth-worker', icon: 'cf-workers' });
    expect(byId.ai).toMatchObject({ label: 'Workers AI', icon: 'cf-workers-ai' });
    expect(byId.images).toMatchObject({ icon: 'cf-images' });
    expect(byId.browser).toMatchObject({ label: 'Browser Rendering' });
    expect(byId['assets-shop-api']).toMatchObject({
      icon: 'cf-pages',
      note: 'directory: ./public',
    });
    expect(byId['vectorize-products']).toMatchObject({ shape: 'cylinder' });
    expect(byId['hyperdrive-pg']).toMatchObject({ label: 'Hyperdrive PG', shape: 'cylinder' });
    expect(byId['ae-events']).toMatchObject({ shape: 'cylinder' });
    expect(byId['workflow-checkout']).toMatchObject({ shape: 'square' });
    expect(byId['route-shop-api']).toMatchObject({
      label: 'shop.example.com/api/* +1',
      icon: 'cf-dns',
      note: 'shop.example.com/api/*\napi.example.com/*',
    });
    expect(byId['cron-shop-api']).toMatchObject({ label: 'Cron 0 * * * *', shape: 'stadium' });

    const edges = part.edges.map((e) => `${e.from}>${e.to}${e.line ? ` ${e.line}` : ''}`);
    expect(edges).toContain('worker-shop-api>kv-abc123');
    expect(edges).toContain('worker-shop-api>queue-shop-jobs');
    expect(edges).toContain('queue-shop-jobs>worker-shop-api');
    expect(edges).toContain('route-shop-api>worker-shop-api');
    expect(edges).toContain('cron-shop-api>worker-shop-api dashed');
    expect(edges).toContain('worker-shop-api>worker-auth-worker');
  });

  it('names every key it does not draw, environments by name, and settings never', () => {
    const part = partOf(FULL);
    expect(part.skipped).toEqual([
      { key: 'vars', count: 1 },
      { key: 'observability', count: 1 },
      { key: 'env.staging', count: 1 },
      { key: 'env.preview', count: 1 },
    ]);
  });

  it('draws a chosen environment in place of the top level', () => {
    const part = partOf(
      'name = "api"\n[[kv_namespaces]]\nbinding="A"\nid="1"\n[env.staging]\nname = "api-staging"\nkv_namespaces = [{ binding = "B", id = "2" }]',
      'staging',
    );
    expect(part.nodes.map((n) => n.id)).toEqual(['worker-api-staging', 'kv-2']);
    expect(part.skipped).toEqual([]);
  });

  it("leaves the top level's bindings behind in an environment, as Wrangler does, and inherits routes and name", () => {
    const part = partOf(
      'name = "api"\nroutes = ["api.example.com/*"]\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "main"\n[vars]\nA = "1"\n[env.staging]\nkv_namespaces = [{ binding = "B", id = "2" }]',
      'staging',
    );
    expect(part.nodes.map((n) => n.id).sort()).toEqual([
      'kv-2',
      'route-api-staging',
      'worker-api-staging',
    ]);
    expect(part.skipped).toEqual([]);
  });

  it('draws only the Worker of an environment that declares no bindings', () => {
    const part = partOf(
      'name = "api"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "main"\n[env.staging]\nname = "s"',
      'staging',
    );
    expect(part.nodes.map((n) => n.id)).toEqual(['worker-s']);
  });

  it('refuses an environment the file does not have, naming those it has', () => {
    const toml = parse('name = "api"\n[env.staging]\nname = "s"');
    expect(wranglerPart(toml, 'x', 'prod')).toMatchObject({
      ok: false,
      error: {
        code: 'unknown-env',
        message: 'No environment "prod" in this wrangler.toml; it has: staging.',
      },
    });
    expect(wranglerPart(parse('name = "api"'), 'x', 'prod')).toMatchObject({
      ok: false,
      error: { message: 'No environment "prod" in this wrangler.toml; it has none.' },
    });
  });

  it('falls back to the folder name and counts malformed entries under their key', () => {
    const part = wranglerPart(
      {
        kv_namespaces: ['oops', { other: 1 }],
        r2_buckets: { binding: 'ONE' },
        services: ['x', { binding: 'S' }],
        queues: { producers: [{ binding: 'Q' }], consumers: [{ queue: 'in' }], unknown: 1 },
        durable_objects: { bindings: [{ name: 'X' }] },
        ai: 'yes',
        assets: true,
        routes: [],
        triggers: { crons: [], other: 1 },
        constructor: 1,
        tail_consumers: [{ service: 'tail' }],
      },
      'api',
    );
    if (!part.ok) throw new Error('expected a part');
    expect(part.part.title).toBe('api');
    expect(part.part.nodes.map((n) => n.id)).toEqual(['worker-api', 'r2-one', 'queue-in']);
    expect(part.part.skipped).toEqual([
      { key: 'kv_namespaces', count: 2 },
      { key: 'services', count: 2 },
      { key: 'queues.producers', count: 1 },
      { key: 'queues.unknown', count: 1 },
      { key: 'durable_objects', count: 1 },
      { key: 'ai', count: 1 },
      { key: 'assets', count: 1 },
      { key: 'routes', count: 1 },
      { key: 'triggers.other', count: 1 },
      { key: 'constructor', count: 1 },
      { key: 'tail_consumers', count: 1 },
    ]);
  });

  it('takes one-table forms and route entries without a pattern', () => {
    const part = wranglerPart(
      {
        name: 'w',
        services: { binding: 'A', service: 'auth' },
        assets: { binding: 'ASSETS' },
        queues: { producers: 'nope' },
        routes: [{ zone_name: 'x' }, true, 5, 'b.example/*'],
      },
      'x',
    );
    if (!part.ok) throw new Error('expected a part');
    const byId = Object.fromEntries(part.part.nodes.map((n) => [n.id, n]));
    expect(byId['worker-auth']).toBeTruthy();
    expect(byId['assets-w']).toEqual({ id: 'assets-w', label: 'Static assets', icon: 'cf-pages' });
    expect(byId['route-w']).toMatchObject({ label: '5 +1', note: '5\nb.example/*' });
  });

  it('skips bindings whose shape it cannot read', () => {
    const part = wranglerPart(
      { name: 'w', queues: [1], durable_objects: 'x', triggers: 'x', route: 'one.example/*' },
      'x',
    );
    if (!part.ok) throw new Error('expected a part');
    expect(part.part.skipped).toEqual([
      { key: 'queues', count: 1 },
      { key: 'durable_objects', count: 1 },
      { key: 'triggers', count: 1 },
    ]);
    expect(part.part.nodes.find((n) => n.id === 'route-w')?.label).toBe('one.example/*');
  });
});
