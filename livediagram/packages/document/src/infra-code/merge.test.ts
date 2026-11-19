import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { remapSourceIds } from '../diagram-sources';
import { isBoxed, type BoxedElement } from '../element-union';
import { layoutGraph } from '../graph-input';
import type { ArrowElement, Element } from '../index';
import { infraGraph } from './graph';
import { mergeSourceGraph } from './merge';
import { grownFrame } from './placement';
import { drawnRecord, nodeRecord } from './sources';
import type { InfraFile } from './types';

// The fresh drawing of some files: what an import lays out, with arrow ids that say their ends.
function drawn(files: InfraFile[]) {
  const result = infraGraph(files);
  if (!result.ok) throw new Error(result.error.message);
  let n = 0;
  const elements = layoutGraph(result.graph, { makeEdgeId: () => `arrow-${++n}` });
  return { graph: result.graph, elements };
}

// A first import: the tab and its record.
function imported(files: InfraFile[]) {
  const { graph, elements } = drawn(files);
  return { tab: elements, record: drawnRecord(elements, graph) };
}

// An update of `tab` (with `record`) from `files`.
function update(tab: Element[], record: ReturnType<typeof drawnRecord> | null, files: InfraFile[]) {
  const { graph, elements } = drawn(files);
  return mergeSourceGraph({ tab, record, fresh: elements, graph });
}

const compose = (text: string): InfraFile[] => [{ name: 'compose.yml', text }];
const byId = (els: readonly Element[], id: string) => els.find((e) => e.id === id);
const box = (els: readonly Element[], id: string) => byId(els, id) as BoxedElement;
const pinsOf = (els: readonly Element[]) =>
  els
    .filter((e): e is ArrowElement => e.type === 'arrow')
    .map((a) =>
      a.from.kind === 'pinned' && a.to.kind === 'pinned'
        ? `${a.from.elementId}>${a.to.elementId}`
        : '?',
    );
const overlap = (a: BoxedElement, b: BoxedElement) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const V1 = `
services:
  web:
    image: nginx
    depends_on: [api, old]
  api:
    image: acme/api
    depends_on: [db, cache]
  db:
    image: postgres
  cache:
    image: redis
  old:
    image: acme/old
`;

const V2 = `
services:
  web:
    image: nginx
    depends_on: [api]
  api:
    image: acme/api
    depends_on: [db, cache, queue]
  db:
    image: mysql
  cache:
    image: redis
  queue:
    image: rabbitmq
`;

// A first import of V1 as a person then left it: web moved, api recoloured, db renamed, cache deleted, a sticky of
// their own with a line to web and one to old, and the web>api line deleted.
function edited() {
  const { tab, record } = imported(compose(V1));
  const webApi = record.edges['svc-web>svc-api']!;
  // Deleting a box on the canvas takes the lines pinned to it.
  const apiCache = record.edges['svc-api>svc-cache']!;
  const next: Element[] = tab
    .filter((e) => e.id !== 'svc-cache' && e.id !== apiCache && e.id !== webApi)
    .map((e) => {
      if (e.id === 'svc-web' && isBoxed(e)) return { ...e, x: e.x + 900, y: e.y + 40 };
      if (e.id === 'svc-api') return { ...e, fillColor: '#ff0000' } as Element;
      if (e.id === 'svc-db') return { ...e, label: 'Primary DB' };
      return e;
    });
  const sticky = {
    id: 'mine',
    type: 'sticky',
    x: -2000,
    y: -2000,
    width: 160,
    height: 120,
    label: 'ask ops',
  } as unknown as Element;
  const pin = (id: string) => ({ kind: 'pinned' as const, elementId: id, anchor: 'n' as const });
  next.push(
    sticky,
    { id: 'my-line', type: 'arrow', from: pin('mine'), to: pin('svc-web') },
    { id: 'my-old-line', type: 'arrow', from: pin('mine'), to: pin('svc-old') },
  );
  return { tab: next, record, before: tab };
}

describe('mergeSourceGraph', () => {
  it('keeps people’s layout and edits while the files change under them', () => {
    const { tab, record } = edited();
    const merged = update(tab, record, compose(V2));
    const els = merged.elements;

    // Kept: where the person put it, in their colours, under their label; the source's own fields follow the files.
    expect(box(els, 'svc-web').x).toBe(box(tab, 'svc-web').x);
    expect(box(els, 'svc-web').y).toBe(box(tab, 'svc-web').y);
    expect((byId(els, 'svc-api') as { fillColor?: string }).fillColor).toBe('#ff0000');
    expect(byId(els, 'svc-db')).toMatchObject({
      label: 'Primary DB',
      iconId: 'mysql',
      note: 'image: mysql',
    });
    // Deleted by the person while the files still name it: stays deleted.
    expect(byId(els, 'svc-cache')).toBeUndefined();
    expect(pinsOf(els)).not.toContain('svc-api>svc-cache');
    // The deleted line stays deleted; the person's own line and sticky stay.
    expect(pinsOf(els)).not.toContain('svc-web>svc-api');
    expect(byId(els, 'mine')).toBeDefined();
    expect(byId(els, 'my-line')).toBeDefined();
    // Gone from the files: removed, with every line pinned to it, the person's included.
    expect(byId(els, 'svc-old')).toBeUndefined();
    expect(byId(els, 'my-old-line')).toBeUndefined();
    expect(pinsOf(els)).not.toContain('svc-web>svc-old');
    // New: added beside api, joined to it, overlapping nothing.
    const queue = box(els, 'svc-queue');
    expect(queue).toMatchObject({ label: 'queue', iconId: 'rabbitmq' });
    expect(pinsOf(els)).toContain('svc-api>svc-queue');
    for (const other of els)
      if (other.id !== 'svc-queue' && isBoxed(other) && other.type !== 'text')
        expect(overlap(queue, other)).toBe(false);
    const api = box(els, 'svc-api');
    expect(Math.abs(queue.x - api.x)).toBeLessThan(600);

    expect(merged.counts).toEqual({
      added: 1,
      removed: 1,
      kept: 3,
      editsKept: 1,
      linesAdded: 1,
      linesRemoved: 2,
    });
    // The record: every key the files name, the deleted ones too, with the source's own values.
    expect(merged.nodes['svc-cache']!.el).toBe('svc-cache');
    expect(merged.nodes['svc-db']).toMatchObject({ el: 'svc-db', label: 'db', iconId: 'mysql' });
    expect(merged.nodes['svc-old']).toBeUndefined();
    expect(merged.edges['svc-web>svc-api']).toBe(record.edges['svc-web>svc-api']);
    expect(merged.edges['svc-api>svc-queue']).toBeDefined();
  });

  it('changes nothing when the files did not change', () => {
    const { tab, record } = edited();
    const first = update(tab, record, compose(V2));
    const again = update(first.elements, first, compose(V2));
    expect(again.elements).toEqual(first.elements);
    expect(again.counts).toMatchObject({ added: 0, removed: 0, linesAdded: 0, linesRemoved: 0 });
    // The renamed db is still the person's on every later update.
    expect(again.counts.editsKept).toBe(1);
  });

  it('follows a duplicated tab’s re-minted ids', () => {
    const { tab, record } = imported(compose(V1));
    const ids = new Map(tab.map((e) => [e.id, `copy-${e.id}`]));
    const copy = tab.map((e) => {
      const next = { ...e, id: ids.get(e.id)! };
      if (next.type === 'arrow' && next.from.kind === 'pinned' && next.to.kind === 'pinned')
        return {
          ...next,
          from: { ...next.from, elementId: ids.get(next.from.elementId)! },
          to: { ...next.to, elementId: ids.get(next.to.elementId)! },
        };
      return next;
    });
    const merged = update(
      copy,
      { ...record, ...remapSourceIds({ bridge: 'infra', files: [], readAt: 0, ...record }, ids) },
      compose(V1),
    );
    expect(merged.counts).toMatchObject({ added: 0, removed: 0, kept: 5, linesAdded: 0 });
    expect(merged.elements).toHaveLength(copy.length);
  });

  it('grows a frame round a box joining its group, and frames a new group', () => {
    const v1 = `
services:
  web: { networks: [front] }
  api: { networks: [front], depends_on: [web] }
  db: {}
`;
    const v2 = `
services:
  web: { networks: [front] }
  api: { networks: [front], depends_on: [web] }
  edge: { networks: [front], depends_on: [web] }
  db: { networks: [back] }
  jobs: { networks: [back], depends_on: [db] }
`;
    const { tab, record } = imported(compose(v1));
    const before = box(tab, 'net-front');
    const merged = update(tab, record, compose(v2));
    const frame = box(merged.elements, 'net-front');
    const edge = box(merged.elements, 'svc-edge');
    expect(frame.x).toBeLessThanOrEqual(edge.x);
    expect(frame.x + frame.width).toBeGreaterThanOrEqual(edge.x + edge.width);
    expect(frame.y + frame.height).toBeGreaterThanOrEqual(edge.y + edge.height);
    expect(frame.width * frame.height).toBeGreaterThanOrEqual(before.width * before.height);
    // A new frame holds its members, and sits below every box (first in the list).
    const back = box(merged.elements, 'net-back');
    const db = box(merged.elements, 'svc-db');
    expect(back.x).toBeLessThanOrEqual(db.x);
    expect(back.y).toBeLessThanOrEqual(db.y);
    expect(back.x + back.width).toBeGreaterThanOrEqual(db.x + db.width);
    expect(merged.elements[0]!.id).toBe('net-back');
    // db stayed where it was.
    expect(db.x).toBe(box(tab, 'svc-db').x);
  });

  it('places boxes that join nothing to the right of the drawing, clear of it', () => {
    const { tab, record } = imported(compose('services:\n  a: {}\n  b: { depends_on: [a] }'));
    const merged = update(
      tab,
      record,
      compose(
        'services:\n  a: {}\n  b: { depends_on: [a] }\n  lone: {}\n  pal: { depends_on: [lone] }',
      ),
    );
    const right = Math.max(
      ...tab.filter((e): e is BoxedElement => isBoxed(e)).map((e) => e.x + e.width),
    );
    expect(box(merged.elements, 'svc-lone').x).toBeGreaterThan(right);
    expect(box(merged.elements, 'svc-pal').x).toBeGreaterThan(right);
  });

  it('updates the heading unless a person changed it, and widens it to hold its text', () => {
    const files = [{ name: 'a/wrangler.toml', text: 'name = "a"' }];
    const { tab, record } = imported(files);
    const more = [...files, { name: 'b/wrangler.toml', text: 'name = "bee-with-a-long-name"' }];
    const merged = update(tab, record, more);
    const caption = merged.elements.find(
      (e) => e.id === record.nodes['#caption']!.el,
    ) as BoxedElement & { label: string };
    expect(caption.label).toBe('From a/wrangler.toml, b/wrangler.toml');
    const title = merged.elements.find((e) => e.id === record.nodes['#title']!.el);
    expect(title).toMatchObject({ label: 'a, bee-with-a-long-name' });
    // The heading's own fields are not boxes: counts say only boxes.
    expect(merged.counts.added).toBe(1);
    // A title a person wrote stays theirs.
    const renamed = tab.map((e) =>
      e.id === record.nodes['#title']!.el ? { ...e, label: 'Our system' } : e,
    );
    const kept = update(renamed, record, more);
    expect(kept.elements.find((e) => e.id === record.nodes['#title']!.el)).toMatchObject({
      label: 'Our system',
    });
  });

  it('adds a heading the tab never had beside its first box', () => {
    const { tab, record } = imported(compose('services:\n  a: {}'));
    const headless = { ...record, nodes: { 'svc-a': record.nodes['svc-a']! } };
    const merged = update(
      tab.filter((e) => e.type !== 'text'),
      headless,
      compose('services:\n  a: {}'),
    );
    expect(merged.elements.filter((e) => e.type === 'text')).toHaveLength(2);
  });

  it('adds everything over an empty record, renaming an id the tab already holds', () => {
    const mine = {
      id: 'svc-a',
      type: 'sticky',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    } as unknown as Element;
    const merged = update([mine], null, compose('services:\n  a: {}\n  b: { depends_on: [a] }'));
    expect(merged.counts.added).toBe(2);
    expect(merged.nodes['svc-a']!.el).not.toBe('svc-a');
    expect(byId(merged.elements, 'svc-a')).toBe(mine);
    expect(merged.counts.linesAdded).toBe(1);
  });

  it('drops a line whose end a person deleted, and a fresh arrow id the tab holds is renamed', () => {
    const { tab, record } = imported(compose('services:\n  a: {}\n  b: {}'));
    const without = tab.filter((e) => e.id !== 'svc-b');
    const merged = update(without, record, compose('services:\n  a: { depends_on: [b] }\n  b: {}'));
    expect(merged.counts.linesAdded).toBe(0);
    // An arrow id the fresh layout reuses is renamed so it never collides.
    const holder = {
      id: 'arrow-1',
      type: 'sticky',
      x: 5000,
      y: 5000,
      width: 1,
      height: 1,
    } as unknown as Element;
    const again = update(
      [...tab, holder],
      record,
      compose('services:\n  a: { depends_on: [b] }\n  b: {}'),
    );
    const added = again.elements.filter((e) => e.type === 'arrow');
    expect(added).toHaveLength(1);
    expect(added[0]!.id).not.toBe('arrow-1');
  });

  it('drops a field the files no longer give', () => {
    const { tab, record } = imported(compose('services:\n  a: { image: nginx }'));
    const merged = update(tab, record, compose('services:\n  a: {}'));
    expect((byId(merged.elements, 'svc-a') as { note?: string }).note).toBeUndefined();
    expect(byId(merged.elements, 'svc-a')).toMatchObject({ iconId: 'docker' });
  });

  it('widens a kept heading whose new text is wider', () => {
    const text = (id: string, label: string, width: number) =>
      ({ id, type: 'text', x: 0, y: 0, width, height: 20, label }) as Element;
    const merged = mergeSourceGraph({
      tab: [text('t0', 'Old', 10)],
      record: { nodes: { '#title': { el: 't0', label: 'Old' } }, edges: {} },
      fresh: [text('t', 'New title', 500)],
      graph: { title: 'New title', nodes: [], edges: [] },
    });
    expect(merged.elements).toEqual([text('t0', 'New title', 500)]);
  });

  it('leaves a frame alone when its new member already sits well inside it', () => {
    const frame = {
      id: 'f',
      type: 'shape',
      shape: 'frame',
      x: 0,
      y: 0,
      width: 400,
      height: 400,
    } as BoxedElement;
    expect(grownFrame(frame, [{ x: 100, y: 100, width: 50, height: 50 }])).toBe(frame);
    expect(
      nodeRecord({
        id: 'a',
        type: 'shape',
        shape: 'square',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      }),
    ).toEqual({
      el: 'a',
    });
  });

  it('merges 150 boxes and 1,000 lines over a tab with 300 more within budget', () => {
    const lines = ['services:'];
    for (let i = 0; i < 150; i++) {
      const deps = [1, 2, 3, 4, 5, 6, 7].map((d) => `s${(i + d) % 150}`).join(', ');
      lines.push(`  s${i}: { depends_on: [${deps}] }`);
    }
    const { tab, record } = imported(compose(lines.join('\n')));
    const extra: Element[] = [];
    for (let i = 0; i < 300; i++)
      extra.push({
        id: `x${i}`,
        type: 'sticky',
        x: i * 7,
        y: -5000 - i * 50,
        width: 40,
        height: 40,
      } as unknown as Element);
    const changed = lines.map((l, i) => (i > 0 && i % 10 === 0 ? l.replace(/^ {2}s/, '  t') : l));
    const { graph, elements } = drawn(compose(changed.join('\n')));
    const ms = cpuMsOf(() =>
      mergeSourceGraph({ tab: [...tab, ...extra], record, fresh: elements, graph }),
    );
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});
