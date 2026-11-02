import { describe, expect, it } from 'vitest';
import { type Element } from '@livehuddle/document';
import { buildTemplate } from './template-builders';

// Structure pins for the five technical starters redesigned together around
// one fictional app, Plateful (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): database schema, sequence diagram, cloud architecture, class
// diagram and state machine. Each test maps to a sentence of that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Arrow = Extract<Element, { type: 'arrow' }>;

const shapesOf = (els: Element[], shape: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && el.shape === shape);
const arrowsOf = (els: Element[]) => els.filter((el): el is Arrow => el.type === 'arrow');
const byLabel = (els: Element[], label: string) =>
  els.find((el) => el.type === 'shape' && el.label === label) as Shape;
const inside = (
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const pinnedIds = (a: Arrow) => [
  a.from.kind === 'pinned' ? a.from.elementId : null,
  a.to.kind === 'pinned' ? a.to.elementId : null,
];

describe('cloud architecture', () => {
  const els = buildTemplate('cloud-architecture', 0, 0);
  const tiles = shapesOf(els, 'icon');
  const frames = shapesOf(els, 'boundary');
  const frame = (prefix: string) => frames.filter((f) => f.label!.startsWith(prefix));
  const tile = (role: string) => tiles.find((t) => t.label!.startsWith(`${role}\n`))!;

  it('draws every managed service as its AWS tile, captioned role over product', () => {
    expect(tiles).toHaveLength(11);
    for (const t of tiles) {
      expect(t.iconId).toMatch(/^aws-/);
      expect(t.label!.split('\n')).toHaveLength(2);
    }
  });

  it('nests edge, region, VPC and two private subnets as boundaries, the nested ones titled inside', () => {
    const [edge] = frame('Edge');
    const [region] = frame('AWS Cloud');
    const [vpc] = frame('VPC');
    const subnets = frame('Private subnet');
    expect([edge, region, vpc].every(Boolean)).toBe(true);
    expect(subnets).toHaveLength(2);
    // A wash of each one's own colour, never a fill of its own, so nested groups stack deeper.
    for (const f of frames) expect(f.fillColor).toBeUndefined();
    expect(vpc!.boundaryStyle).toBe('inset');
    expect(vpc!.pageSubtitle).toBe('10.0.0.0/16');
    for (const s of subnets) expect(s.boundaryStyle).toBe('inset');
    expect(inside(vpc!, region!)).toBe(true);
    for (const s of subnets) expect(inside(s, vpc!)).toBe(true);
    expect(inside(tile('Orders service'), subnets[0]!)).toBe(true);
    expect(inside(tile('Orders DB'), subnets[1]!)).toBe(true);
    for (const role of ['DNS', 'CDN']) {
      expect(inside(tile(role), edge!)).toBe(true);
      expect(inside(tile(role), region!)).toBe(false);
    }
    for (const role of ['Public API', 'Menu photos', 'order-events', 'Dispatch', 'Push']) {
      expect(inside(tile(role), region!)).toBe(true);
      expect(inside(tile(role), vpc!)).toBe(false);
    }
  });

  it('keeps the three apps outside the cloud as line-art cards', () => {
    const cards = shapesOf(els, 'card');
    expect(cards.map((c) => c.pageTitle).sort()).toEqual([
      'Courier app',
      'Customer app',
      'Kitchen tablet',
    ]);
    for (const c of cards) {
      expect(c.iconId).not.toMatch(/^aws-/);
      expect(inside(c, frame('AWS Cloud')[0]!)).toBe(false);
    }
  });

  it('runs the request path left to right along one row and forks to the partner apps', () => {
    const path = ['CDN', 'Public API', 'Orders service', 'order-events', 'Dispatch', 'Push'].map(
      tile,
    );
    for (const t of path) expect(t.y).toBeCloseTo(path[0]!.y, 5);
    const xs = path.map((t) => t.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const arrows = arrowsOf(els);
    const push = tile('Push');
    const fork = arrows.filter((a) => a.from.kind === 'pinned' && a.from.elementId === push.id);
    expect(fork.map((a) => a.label).sort()).toEqual(['job offer', 'new order']);
  });

  it('dashes the control plane apart from traffic', () => {
    const dashed = arrowsOf(els).filter((a) => a.strokeStyle === 'dashed');
    expect(dashed.map((a) => a.label).sort()).toEqual(['alias', 'logs', 'queue depth']);
    expect(arrowsOf(els).every((a) => a.from.kind === 'pinned' && a.to.kind === 'pinned')).toBe(
      true,
    );
  });
});

describe('state machine', () => {
  const els = buildTemplate('state-machine', 0, 0);
  const arrows = arrowsOf(els);
  const state = (label: string) => byLabel(els, label);
  const labels = arrows.map((a) => a.label ?? '');

  it('runs the happy path along one row into a composite kitchen state', () => {
    const path = ['Placed', 'Accepted', 'Preparing', 'Ready', 'Out for delivery', 'Delivered'].map(
      state,
    );
    for (const s of path) expect(s.y).toBe(path[0]!.y);
    const kitchen = shapesOf(els, 'frame').find((f) => f.label === 'In the kitchen')!;
    for (const s of ['Accepted', 'Preparing', 'Ready'])
      expect(inside(state(s), kitchen)).toBe(true);
    for (const s of ['Placed', 'Out for delivery']) expect(inside(state(s), kitchen)).toBe(false);
  });

  it('draws one initial dot and a bullseye per final state, ink locked', () => {
    const locked = els.filter((el) => (el as { themeLockFill?: boolean }).themeLockFill);
    // Initial dot + three bullseyes (ring + core).
    expect(locked).toHaveLength(7);
    expect(shapesOf(els, 'circle')).toHaveLength(7);
  });

  it('labels transitions as event [guard] / action, with a time event and two triggers', () => {
    expect(labels).toContain('pickup [PIN ok]');
    expect(labels.some((l) => l.includes('after(5 min)') && l.includes('decline,'))).toBe(true);
    expect(labels.some((l) => l.includes('[not accepted]') && l.includes('/ refund'))).toBe(true);
  });

  it('loops a self-transition on Out for delivery', () => {
    const self = arrows.find((a) => a.label === 'location ping / update ETA')!;
    const ids = pinnedIds(self);
    expect(ids[0]).toBe(state('Out for delivery').id);
    expect(ids[1]).toBe(ids[0]);
  });

  it('leaves the composite border once for out of stock', () => {
    const kitchen = shapesOf(els, 'frame').find((f) => f.label === 'In the kitchen')!;
    const exit = arrows.find((a) => a.label === 'out of stock / refund')!;
    expect(pinnedIds(exit)).toEqual([kitchen.id, state('Cancelled').id]);
  });
});
