import { describe, expect, it } from 'vitest';
import { entityHeight, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from '@livediagram/templates';
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
const texts = (els: Element[]) =>
  els.filter((el) => el.type === 'text').map((el) => (el as { label?: string }).label ?? '');
const byLabel = (els: Element[], label: string) =>
  els.find((el) => el.type === 'shape' && el.label === label) as Shape;
const centre = (el: { x: number; y: number; width: number; height: number }) => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
});
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

describe('database schema (er-diagram)', () => {
  const els = buildTemplate('er-diagram', 0, 0);
  const tables = shapesOf(els, 'entity');
  const table = (name: string) => tables.find((t) => t.label === name)!;

  it('titles the Plateful orders schema with a how-to caption', () => {
    expect(texts(els)[0]).toBe('Plateful · orders schema');
    expect(texts(els)[1]).toMatch(/one side to the many side/);
  });

  it('lays six tables in a plus around the orders hub', () => {
    expect(tables.map((t) => t.label).sort()).toEqual(
      ['couriers', 'customers', 'menu_items', 'order_items', 'orders', 'restaurants'].sort(),
    );
    const o = centre(table('orders'));
    expect(centre(table('customers')).x).toBeCloseTo(o.x, 5);
    expect(centre(table('customers')).y).toBeLessThan(o.y);
    expect(centre(table('order_items')).x).toBeCloseTo(o.x, 5);
    expect(centre(table('order_items')).y).toBeGreaterThan(o.y);
    expect(centre(table('restaurants')).y).toBeCloseTo(o.y, 5);
    expect(centre(table('restaurants')).x).toBeLessThan(o.x);
    expect(centre(table('couriers')).y).toBeCloseTo(o.y, 5);
    expect(centre(table('couriers')).x).toBeGreaterThan(o.x);
    expect(centre(table('menu_items')).x).toBeCloseTo(centre(table('restaurants')).x, 5);
  });

  it('writes the key role into the type column and sizes each box to its rows', () => {
    for (const t of tables) {
      expect(t.entityFields!.every((f) => f.type)).toBe(true);
      expect(t.entityFields!.some((f) => /PK/.test(f.type ?? ''))).toBe(true);
      expect(t.height).toBe(entityHeight(t.entityFields!.length, t.textSize));
    }
    expect(table('customers').entityFields).toContainEqual({ name: 'email', type: 'text UK' });
    expect(table('order_items').entityFields!.filter((f) => f.type === 'uuid PK FK')).toHaveLength(
      2,
    );
  });

  it('runs every relationship one side to many side, straight, labelled with multiplicities', () => {
    const rels = arrowsOf(els);
    expect(rels).toHaveLength(6);
    const opposite: Record<string, string> = { n: 's', s: 'n', e: 'w', w: 'e' };
    for (const r of rels) {
      expect(r.from.kind).toBe('pinned');
      expect(r.to.kind).toBe('pinned');
      if (r.from.kind === 'pinned' && r.to.kind === 'pinned') {
        expect(opposite[r.from.anchor]).toBe(r.to.anchor);
      }
      expect(r.arrowheadShape).toBe('line');
      expect(r.label).toMatch(/^[a-z ]+ · [0-9.*]+ : [0-9.*]+$/);
    }
    // The courier is the one optional parent.
    expect(rels.filter((r) => r.label?.includes('0..1 :'))).toHaveLength(1);
    // Many ends: every FK-holding table is at the head of a line.
    const heads = new Set(rels.map((r) => (r.to.kind === 'pinned' ? r.to.elementId : '')));
    for (const name of ['orders', 'order_items', 'menu_items']) {
      expect(heads.has(table(name).id)).toBe(true);
    }
  });

  it('fills the free corners with the status enum and a flagged review note', () => {
    const code = shapesOf(els, 'code-block');
    expect(code).toHaveLength(1);
    expect(code[0]!.codeLanguage).toBe('sql');
    expect(code[0]!.code).toMatch(/CREATE TYPE order_status AS ENUM/);
    expect(els.filter((el) => el.type === 'sticky')).toHaveLength(1);
    expect(shapesOf(els, 'sticker').map((s) => s.stickerId)).toEqual(['badge-in-review']);
  });
});

describe('sequence diagram', () => {
  const els = buildTemplate('sequence-diagram', 0, 0);
  const arrows = arrowsOf(els);
  // Numbered straight messages; 3 is the self-call loop, pinned separately.
  const messages = arrows.filter((a) => /^\d+: /.test(a.label ?? '') && a.arrowStyle !== 'angled');
  const numbered = (n: number) => messages.find((m) => m.label!.startsWith(`${n}: `))!;
  const lifelines = arrows.filter(
    (a) =>
      !a.label &&
      a.arrowEnds === 'none' &&
      a.from.kind === 'free' &&
      a.to.kind === 'free' &&
      a.from.x === a.to.x,
  );

  it('heads the checkout with an actor and four boxed participants over dashed lifelines', () => {
    expect(shapesOf(els, 'actor')).toHaveLength(1);
    expect(texts(els)).toContain('Customer');
    const boxes = ['Plateful app', 'Orders API', 'Payments', 'Kitchen tablet'].map((l) =>
      byLabel(els, l),
    );
    for (const b of boxes) expect(b.iconId).toBeTruthy();
    expect(lifelines).toHaveLength(5);
    expect(lifelines.every((l) => l.strokeStyle === 'dashed')).toBe(true);
  });

  it('shows activation bars, including a nested one for the self-call', () => {
    const bars = shapesOf(els, 'square').filter((s) => s.width === 14);
    expect(bars).toHaveLength(5);
    expect(bars.every((b) => b.borderRadius === 'none')).toBe(true);
  });

  it('reads the three message kinds apart and numbers them', () => {
    expect(messages.map((m) => Number(m.label!.split(':')[0]))).toEqual([
      1, 2, 4, 5, 6, 7, 8, 9, 10,
    ]);
    const calls = [1, 2, 4].map(numbered);
    for (const c of calls) {
      expect(c.arrowheadShape).toBe('triangle');
      expect(c.strokeStyle).toBeUndefined();
    }
    const event = numbered(6);
    expect(event.label).toBe('6: OrderPlaced');
    expect(event.arrowheadShape).toBe('line');
    expect(event.strokeStyle).toBeUndefined();
    for (const n of [5, 7, 8, 9, 10]) {
      expect(numbered(n).strokeStyle).toBe('dashed');
      expect(numbered(n).arrowheadShape).toBe('line');
    }
    // Every message is a horizontal free arrow: the geometry is the point.
    for (const m of messages) {
      expect(m.from.kind).toBe('free');
      if (m.from.kind === 'free' && m.to.kind === 'free') expect(m.from.y).toBe(m.to.y);
    }
  });

  it('validates the basket with a self-call loop', () => {
    const self = arrows.find((a) => a.label === '3: validate basket')!;
    expect(self.arrowStyle).toBe('angled');
    expect(self.curvePoints).toHaveLength(2);
  });

  it('splits on the payment result in an alt fragment with two guards and a divider', () => {
    const alt = shapesOf(els, 'frame').find((f) => f.label === 'alt')!;
    expect(alt).toBeTruthy();
    expect(texts(els)).toEqual(expect.arrayContaining(['[payment authorised]', '[declined]']));
    const divider = arrows.find(
      (a) =>
        a.strokeStyle === 'dashed' &&
        a.arrowEnds === 'none' &&
        a.from.kind === 'free' &&
        a.to.kind === 'free' &&
        a.from.y === a.to.y,
    )!;
    expect(divider).toBeTruthy();
    // Messages 6-10 sit inside the fragment, 1-5 above it.
    for (const n of [6, 7, 8, 9, 10]) {
      const m = numbered(n);
      if (m.from.kind === 'free') expect(m.from.y).toBeGreaterThan(alt.y);
    }
    for (const n of [1, 2, 4, 5]) {
      const m = numbered(n);
      if (m.from.kind === 'free') expect(m.from.y).toBeLessThan(alt.y);
    }
  });

  it('ties a note to the Payments activation with a dashed anchor', () => {
    const note = els.find((el) => el.type === 'sticky')!;
    const anchor = arrows.find((a) => pinnedIds(a).includes(note.id))!;
    expect(anchor.strokeStyle).toBe('dashed');
    expect(anchor.arrowEnds).toBe('none');
  });

  it('keeps participants and lifelines on the scaffold, everything else on messages', () => {
    for (const el of els)
      expect([TEMPLATE_SCAFFOLD_LAYER_ID, TEMPLATE_CONTENT_LAYER_ID]).toContain(el.layerId);
    for (const l of lifelines) expect(l.layerId).toBe(TEMPLATE_SCAFFOLD_LAYER_ID);
    for (const m of messages) expect(m.layerId).toBe(TEMPLATE_CONTENT_LAYER_ID);
  });
});

describe('cloud architecture', () => {
  const els = buildTemplate('cloud-architecture', 0, 0);
  const tiles = shapesOf(els, 'icon');
  const frames = shapesOf(els, 'frame');
  const frame = (prefix: string) => frames.filter((f) => f.label!.startsWith(prefix));
  const tile = (role: string) => tiles.find((t) => t.label!.startsWith(`${role}\n`))!;

  it('draws every managed service as its AWS tile, captioned role over product', () => {
    expect(tiles).toHaveLength(11);
    for (const t of tiles) {
      expect(t.iconId).toMatch(/^aws-/);
      expect(t.label!.split('\n')).toHaveLength(2);
    }
  });

  it('nests edge, region, VPC and two private subnets, labels top-left, unfilled', () => {
    const [edge] = frame('Edge');
    const [region] = frame('AWS Cloud');
    const [vpc] = frame('VPC');
    const subnets = frame('Private subnet');
    expect([edge, region, vpc].every(Boolean)).toBe(true);
    expect(subnets).toHaveLength(2);
    for (const f of frames) {
      expect(f.textAlignX).toBe('left');
      expect(f.fillColor).toBeUndefined();
    }
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
    const cards = shapesOf(els, 'square');
    expect(cards.map((c) => c.label).sort()).toEqual([
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

describe('class diagram (uml-class)', () => {
  const els = buildTemplate('uml-class', 0, 0);
  const classes = shapesOf(els, 'entity');
  const cls = (name: string) => classes.find((c) => c.label === name)!;
  const links = arrowsOf(els).filter((a) => a.from.kind === 'pinned');

  it('models the Plateful order domain as nine entity classes', () => {
    expect(classes).toHaveLength(9);
    for (const name of ['Customer', 'Order', 'OrderLine', 'MenuItem', 'Restaurant']) {
      expect(cls(name)).toBeTruthy();
    }
  });

  it('gives every member a visibility and a type, operations their return type', () => {
    for (const c of classes.filter((c) => !c.label!.includes('enumeration'))) {
      for (const m of c.entityFields!) {
        expect(m.name).toMatch(/^[+\-#] /);
        expect(m.type).toBeTruthy();
      }
    }
    expect(cls('Order').entityFields).toContainEqual({ name: '+ total()', type: 'Money' });
  });

  it('italicises the abstract Payment and lists the order states in the enumeration', () => {
    expect(cls('«abstract» Payment').textItalic).toBe(true);
    const literals = cls('«enumeration» OrderStatus').entityFields!.map((f) => f.name);
    expect(literals).toHaveLength(8);
  });

  it('tells the four relationship kinds apart by their heads', () => {
    const into = (name: string, head: string) =>
      links.filter(
        (a) =>
          a.to.kind === 'pinned' && a.to.elementId === cls(name).id && a.arrowheadShape === head,
      );
    expect(into('«abstract» Payment', 'triangle-hollow')).toHaveLength(2);
    expect(into('Order', 'diamond')).toHaveLength(1);
    expect(into('Restaurant', 'diamond-hollow')).toHaveLength(1);
    expect(links.filter((a) => a.arrowheadShape === 'line')).toHaveLength(4);
    // Every non-generalisation line names its role and both multiplicities.
    for (const a of links.filter((a) => a.arrowheadShape !== 'triangle-hollow')) {
      expect(a.label).toMatch(/ · [0-9.*]+ : [0-9.*]+$/);
    }
  });

  it('keys the four line ends in the free corner', () => {
    const key = arrowsOf(els).filter((a) => a.from.kind === 'free');
    expect(key.map((a) => a.arrowheadShape)).toEqual([
      'triangle-hollow',
      'diamond',
      'diamond-hollow',
      'line',
    ]);
    expect(texts(els)).toContain('Reading the lines');
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

describe('the five tell one story', () => {
  it('shares the order states across the schema enum, the class enum and the state machine', () => {
    const sql = shapesOf(buildTemplate('er-diagram', 0, 0), 'code-block')[0]!.code!;
    const fromSql = [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!.toUpperCase());
    const fromUml = shapesOf(buildTemplate('uml-class', 0, 0), 'entity')
      .find((c) => c.label === '«enumeration» OrderStatus')!
      .entityFields!.map((f) => f.name);
    const fromStates = shapesOf(buildTemplate('state-machine', 0, 0), 'stadium').map((s) =>
      s.label!.toUpperCase().replace(/ /g, '_'),
    );
    expect(fromUml).toEqual(fromSql);
    expect([...fromStates].sort()).toEqual([...fromSql].sort());
  });
});
