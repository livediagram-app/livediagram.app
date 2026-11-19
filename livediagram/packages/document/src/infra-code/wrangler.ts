// A wrangler.toml as a drawing (docs/specs/020-import-export/infrastructure-import.md "Wrangler", blueprint
// "wranglerPart"): the Worker, each binding a box joined to it, service bindings to other Workers' boxes.

import { asString, PartBuilder, slug } from './part';
import { isTable, type Table } from './parse';
import type { InfraError, InfraPart } from './types';

// A list binding: the key, the id part and label of each entry's box, and how it is drawn.
type ListBinding = {
  key: string;
  kind: string;
  id: (t: Table) => string | undefined;
  label: (t: Table) => string | undefined;
  icon?: string;
  shape?: 'cylinder' | 'square';
};

const first =
  (...keys: string[]) =>
  (t: Table): string | undefined => {
    for (const k of keys) {
      const v = asString(t[k]);
      if (v !== undefined) return v;
    }
    return undefined;
  };

const LIST_BINDINGS: readonly ListBinding[] = [
  {
    key: 'kv_namespaces',
    kind: 'kv',
    id: first('id', 'binding'),
    label: first('binding', 'id'),
    icon: 'cf-kv',
  },
  {
    key: 'r2_buckets',
    kind: 'r2',
    id: first('bucket_name', 'binding'),
    label: first('bucket_name', 'binding'),
    icon: 'cf-r2',
  },
  {
    key: 'd1_databases',
    kind: 'd1',
    id: first('database_name', 'binding'),
    label: first('database_name', 'binding'),
    icon: 'cf-d1',
  },
  {
    key: 'vectorize',
    kind: 'vectorize',
    id: first('index_name', 'binding'),
    label: first('index_name', 'binding'),
    shape: 'cylinder',
  },
  {
    key: 'hyperdrive',
    kind: 'hyperdrive',
    id: first('binding'),
    // Only called once `id` has found the binding.
    label: (t) => `Hyperdrive ${asString(t.binding)}`,
    shape: 'cylinder',
  },
  {
    key: 'analytics_engine_datasets',
    kind: 'ae',
    id: first('dataset', 'binding'),
    label: first('dataset', 'binding'),
    shape: 'cylinder',
  },
  {
    key: 'workflows',
    kind: 'workflow',
    id: first('name', 'binding'),
    label: first('name', 'binding'),
    shape: 'square',
  },
];

// A single-table binding: one shared box, the same in every file (one Workers AI, one Images).
const TABLE_BINDINGS: Readonly<Record<string, { id: string; label: string; icon?: string }>> = {
  ai: { id: 'ai', label: 'Workers AI', icon: 'cf-workers-ai' },
  images: { id: 'images', label: 'Images', icon: 'cf-images' },
  browser: { id: 'browser', label: 'Browser Rendering' },
};

// Settings that are never architecture: read past without a word.
const SILENT = new Set([
  'name',
  'main',
  'compatibility_date',
  'compatibility_flags',
  'account_id',
  '$schema',
  'workers_dev',
  'preview_urls',
]);

// The top-level keys an environment inherits (Wrangler's "inheritable keys"); every other key, each binding and
// `vars` among them, belongs to the top level alone.
const INHERITABLE = [
  'name',
  'main',
  'compatibility_date',
  'compatibility_flags',
  'account_id',
  'workers_dev',
  'preview_urls',
  'route',
  'routes',
  'triggers',
  'assets',
  'build',
  'rules',
  'observability',
  'limits',
  'placement',
  'logpush',
  'minify',
  'tsconfig',
] as const;

// A list key's entries: an array's items, or one value on its own.
const entriesOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);

const stringsOf = (v: unknown): string[] =>
  entriesOf(v).flatMap((x) => {
    const s = asString(x) ?? (isTable(x) ? asString(x.pattern) : undefined);
    return s === undefined ? [] : [s];
  });

export function wranglerPart(
  config: Table,
  fallbackName: string,
  env?: string,
): { ok: true; part: InfraPart } | { ok: false; error: InfraError } {
  let source = config;
  if (env !== undefined) {
    const envs = isTable(config.env) ? config.env : {};
    const chosen = envs[env];
    if (!isTable(chosen)) {
      const names = Object.keys(envs);
      return {
        ok: false,
        error: {
          code: 'unknown-env',
          message: `No environment "${env}" in this wrangler.toml${names.length ? `; it has: ${names.join(', ')}` : '; it has none'}.`,
        },
      };
    }
    // Only the top level's inheritable keys carry into an environment, as Wrangler deploys it: bindings and vars
    // never do, so the top level's D1 is not the environment's. An unnamed environment is `<name>-<env>`.
    const inherited: Table = {};
    for (const key of INHERITABLE) if (key in config) inherited[key] = config[key];
    const topName = asString(config.name);
    source = {
      ...inherited,
      ...(topName !== undefined && chosen.name === undefined ? { name: `${topName}-${env}` } : {}),
      ...chosen,
    };
  }
  const b = new PartBuilder();
  const name = asString(source.name) ?? fallbackName;
  const worker = b.node({ id: `worker-${slug(name)}`, label: name, icon: 'cf-workers' });
  const workerSlug = slug(name);
  const into = (id: string) => b.edge({ from: worker, to: id });

  for (const [key, value] of Object.entries(source)) {
    if (SILENT.has(key)) continue;
    if (key === 'env') {
      // The environments left out, by name; none is said when one was chosen.
      if (env === undefined && isTable(value))
        for (const e of Object.keys(value)) b.skip(`env.${e}`);
      continue;
    }
    const list = LIST_BINDINGS.find((l) => l.key === key);
    if (list) {
      for (const entry of entriesOf(value)) {
        const id = isTable(entry) ? list.id(entry) : undefined;
        if (!isTable(entry) || id === undefined) {
          b.skip(key);
          continue;
        }
        into(
          b.node({
            id: `${list.kind}-${slug(id)}`,
            // Each label reads the keys its id does, so it is found whenever the id is.
            label: list.label(entry)!,
            ...(list.icon ? { icon: list.icon } : { shape: list.shape }),
          }),
        );
      }
      continue;
    }
    // Own keys only: a key named `constructor` is no binding.
    const single = Object.hasOwn(TABLE_BINDINGS, key) ? TABLE_BINDINGS[key] : undefined;
    if (single) {
      if (!isTable(value)) b.skip(key);
      else
        into(
          b.node({
            id: single.id,
            label: single.label,
            ...(single.icon ? { icon: single.icon } : {}),
          }),
        );
      continue;
    }
    if (key === 'assets') {
      if (!isTable(value)) b.skip(key);
      else
        into(
          b.node({
            id: `assets-${workerSlug}`,
            label: 'Static assets',
            icon: 'cf-pages',
            ...(asString(value.directory)
              ? { note: `directory: ${asString(value.directory)}` }
              : {}),
          }),
        );
      continue;
    }
    if (key === 'services') {
      for (const t of entriesOf(value)) {
        const service = isTable(t) ? asString(t.service) : undefined;
        if (service === undefined) b.skip(key);
        else into(b.node({ id: `worker-${slug(service)}`, label: service, icon: 'cf-workers' }));
      }
      continue;
    }
    if (key === 'queues') {
      if (!isTable(value)) {
        b.skip(key);
        continue;
      }
      for (const [sub, list] of Object.entries(value)) {
        if (sub !== 'producers' && sub !== 'consumers') {
          b.skip(`queues.${sub}`);
          continue;
        }
        for (const t of entriesOf(list)) {
          const queue = isTable(t) ? asString(t.queue) : undefined;
          if (queue === undefined) {
            b.skip(`queues.${sub}`);
            continue;
          }
          const id = b.node({ id: `queue-${slug(queue)}`, label: queue, icon: 'cf-queues' });
          b.edge(sub === 'producers' ? { from: worker, to: id } : { from: id, to: worker });
        }
      }
      continue;
    }
    if (key === 'durable_objects') {
      if (!isTable(value)) {
        b.skip(key);
        continue;
      }
      for (const t of entriesOf(value.bindings)) {
        const className = isTable(t) ? asString(t.class_name) : undefined;
        if (!isTable(t) || className === undefined) {
          b.skip(key);
          continue;
        }
        const host = asString(t.script_name);
        into(
          b.node({
            id: `do-${host ? slug(host) : workerSlug}-${slug(className)}`,
            label: className,
            icon: 'cf-durable-objects',
            ...(host ? { note: `hosted by ${host}` } : {}),
          }),
        );
      }
      continue;
    }
    if (key === 'routes' || key === 'route') {
      const patterns = stringsOf(value);
      if (patterns.length === 0) {
        b.skip(key);
        continue;
      }
      const id = b.node({
        id: `route-${workerSlug}`,
        label: patterns.length > 1 ? `${patterns[0]} +${patterns.length - 1}` : patterns[0]!,
        icon: 'cf-dns',
        note: patterns.join('\n'),
      });
      b.edge({ from: id, to: worker });
      continue;
    }
    if (key === 'triggers') {
      const crons = isTable(value) ? stringsOf(value.crons) : [];
      if (isTable(value))
        for (const sub of Object.keys(value)) if (sub !== 'crons') b.skip(`triggers.${sub}`);
      if (crons.length === 0) {
        if (!isTable(value)) b.skip(key);
        continue;
      }
      const id = b.node({
        id: `cron-${workerSlug}`,
        label: `Cron ${crons[0]}`,
        shape: 'stadium',
        note: crons.join('\n'),
      });
      b.edge({ from: id, to: worker, line: 'dashed' });
      continue;
    }
    b.skip(key);
  }
  // No name and no binding: TOML, but nothing of a Worker in it.
  if (asString(source.name) === undefined && b.size === 1)
    return {
      ok: false,
      error: {
        code: 'nothing-to-draw',
        message:
          'Found no Worker or bindings to draw. A wrangler.toml needs a name or a binding; Compose needs services.',
      },
    };
  return { ok: true, part: b.done(name) };
}
