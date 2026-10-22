import { describe, expect, it } from 'vitest';
import { isDefaultMindConnectorLook, layoutMindTree, type Element } from '@livepages/document';
import { buildTemplate } from './template-builders';

// Structure pins for the hierarchy starters redesigned together
// (docs/specs/008-canvas/canvas-and-palette.md "Templates", docs/specs/009-elements/mind-node.md
// "Templates"): mind map, bubble map, org chart, flowchart, decision tree,
// OKR tree and sitemap. Each test maps to a sentence of those specs.

type Shape = Extract<Element, { type: 'shape' }>;
type Arrow = Extract<Element, { type: 'arrow' }>;

const shapes = (els: Element[], kind?: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && (!kind || el.shape === kind));
const arrows = (els: Element[]) => els.filter((el): el is Arrow => el.type === 'arrow');
const texts = (els: Element[]) =>
  els.filter((el) => el.type === 'text').map((el) => (el as { label?: string }).label ?? '');
const byLabel = (els: Element[], start: string) =>
  shapes(els).find((s) => (s.label ?? '').startsWith(start))!;
const pinnedTo = (a: Arrow, end: 'from' | 'to') =>
  a[end].kind === 'pinned' ? (a[end] as { elementId: string }).elementId : undefined;
const overlaps = (a: Shape, b: Shape) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('mind map template', () => {
  const els = buildTemplate('mindmap', 0, 0);
  const nodes = shapes(els, 'mind-node');
  const root = nodes.find((n) => !n.mindParentId)!;
  const branches = nodes.filter((n) => n.mindParentId === root.id);

  it('names a real topic and its dates on a bold round nucleus', () => {
    expect(root.label).toBe('Team offsite\nLake District · 12-14 June');
    expect(root.colorPreset).toBe('bold');
    expect(root.borderRadius).toBe('full');
  });

  it('radiates five branches, each in its own hue with a glyph, border and connector alike', () => {
    expect(branches.map((b) => b.label)).toEqual(['Venue', 'Agenda', 'Travel', 'Budget', 'Fun']);
    expect(branches.every((b) => b.iconId)).toBe(true);
    expect(new Set(branches.map((b) => b.strokeColor)).size).toBe(5);
    for (const b of branches) {
      const into = arrows(els).find((a) => pinnedTo(a, 'to') === b.id)!;
      expect(into.strokeColor).toBe(b.strokeColor);
      // Leaves are white cards edged in their branch's family, not its exact ink.
      const leaves = nodes.filter((n) => n.mindParentId === b.id);
      expect(leaves.length).toBeGreaterThanOrEqual(2);
      expect(leaves.every((l) => l.fillColor === '#ffffff')).toBe(true);
    }
  });

  it('is a tidy mind map in the bubble flow, so Tab and Enter keep it tidy', () => {
    expect(root.mindFlow).toBe('bubble');
    const layout = layoutMindTree(nodes, root.id, 'bubble');
    const dx = root.x - layout.get(root.id)!.x;
    const dy = root.y - layout.get(root.id)!.y;
    for (const n of nodes) {
      expect(layout.get(n.id)!.x + dx).toBeCloseTo(n.x, 0);
      expect(layout.get(n.id)!.y + dy).toBeCloseTo(n.y, 0);
    }
  });

  it('teaches the growth keys in a muted line under the map', () => {
    const line = els.find((el) => el.type === 'text')!;
    expect(line.label).toContain('Tab');
    expect(line.label).toContain('Enter');
    expect(line.y).toBeGreaterThan(Math.max(...nodes.map((n) => n.y + n.height)));
  });
});

describe('bubble map template', () => {
  const els = buildTemplate('mindmap-bubble', 0, 0);
  const nodes = shapes(els, 'mind-node');
  const root = nodes.find((n) => !n.mindParentId)!;
  const bubbles = nodes.filter((n) => n.mindParentId === root.id);

  it('rings a brand voice with six round adjective bubbles, each in its own hue', () => {
    expect(root.label).toBe('Our brand voice\nHow we sound');
    expect(bubbles.map((b) => b.label!.split('\n')[0])).toEqual([
      'Warm',
      'Clear',
      'Playful',
      'Honest',
      'Curious',
      'Calm',
    ]);
    expect(bubbles.every((b) => b.borderRadius === 'full' && b.width === b.height)).toBe(true);
    expect(new Set(bubbles.map((b) => b.fillColor)).size).toBe(6);
  });

  it('gives each adjective a bold word over a two-line quoted proof', () => {
    for (const b of bubbles) {
      expect(b.richText![0]!.bold).toBe(true);
      // Word, then the proof broken by hand onto two lines.
      expect(b.label!.split('\n')).toHaveLength(3);
      expect(b.label!.split('\n')[1]!.startsWith('"')).toBe(true);
    }
  });

  it('stays one level deep in the bubble flow, so Tab on the centre adds a bubble', () => {
    expect(root.mindFlow).toBe('bubble');
    expect(nodes).toHaveLength(7);
  });
});

describe('org chart template', () => {
  const els = buildTemplate('orgchart', 0, 0);
  const ceo = byLabel(els, 'Maya Chen');
  const lines = arrows(els);

  it('draws every card as a person: name in bold over role, with a person glyph', () => {
    const people = shapes(els, 'square').filter((s) => s.richText);
    expect(people).toHaveLength(14);
    for (const p of people) {
      expect(p.richText![0]!.bold).toBe(true);
      expect(['user', 'user-plus']).toContain(p.iconId);
    }
    expect(ceo.colorPreset).toBe('bold');
  });

  it('puts the Chief of Staff beside the CEO on a staff line', () => {
    const staff = byLabel(els, 'Leo Park');
    expect(staff.y + staff.height / 2).toBe(ceo.y + ceo.height / 2);
    const line = lines.find((a) => pinnedTo(a, 'to') === staff.id)!;
    expect(pinnedTo(line, 'from')).toBe(ceo.id);
  });

  it('bands each team in its own tint with a headcount, VP spanning it and reports on a spine', () => {
    for (const [team, vpName] of [
      ['Product', 'Ana Souza'],
      ['Engineering', 'Omar Haddad'],
      ['Sales', 'Grace Liu'],
    ] as const) {
      expect(texts(els)).toContain(team);
      const vp = byLabel(els, vpName);
      const reports = lines.filter((a) => pinnedTo(a, 'from') === vp.id);
      expect(reports).toHaveLength(3);
      expect(reports.every((a) => a.from.kind === 'pinned' && a.from.anchor === 'ssw')).toBe(true);
    }
    expect(texts(els).filter((t) => t.endsWith('people'))).toHaveLength(3);
  });

  it('rakes the CEO lines from three separate points onto the VPs, without arrowheads', () => {
    const fromCeo = lines.filter(
      (a) => pinnedTo(a, 'from') === ceo.id && a.from.kind === 'pinned' && a.from.anchor !== 'e',
    );
    expect(fromCeo.map((a) => (a.from as { anchor: string }).anchor)).toEqual(['ssw', 's', 'sse']);
    expect(fromCeo.every((a) => a.curvePoints?.length === 2)).toBe(true);
    expect(lines.every((a) => a.arrowEnds === 'none')).toBe(true);
  });

  it('shows a dashed dotted-line report and a dashed open-role card', () => {
    const priya = byLabel(els, 'Priya Nair');
    const dotted = lines.find((a) => pinnedTo(a, 'from') === priya.id)!;
    expect(pinnedTo(dotted, 'to')).toBe(byLabel(els, 'Grace Liu').id);
    expect(dotted.strokeStyle).toBe('dashed');
    const open = byLabel(els, 'Open role');
    expect(open.strokeStyle).toBe('dashed');
    expect(open.iconId).toBe('user-plus');
  });

  it('keys the line and card treatments underneath', () => {
    for (const t of ['Key', 'Reports to', 'Dotted-line report', 'Open role, hiring now'])
      expect(texts(els)).toContain(t);
  });
});

describe('flowchart template', () => {
  const els = buildTemplate('flowchart', 0, 0);
  const node = (label: string) => shapes(els).find((s) => s.label === label)!;

  it('draws a checkout with the five ISO symbols', () => {
    expect(node('Checkout').shape).toBe('stadium');
    expect(node('Order placed').shape).toBe('stadium');
    expect(node('Enter card details').shape).toBe('parallelogram');
    expect(node('Charge card').shape).toBe('square');
    expect(node('Payment OK?').shape).toBe('diamond');
    expect(node('In stock?').shape).toBe('diamond');
    expect(node('Email receipt').shape).toBe('document');
  });

  it('runs the happy path down the page, one rank per step', () => {
    const spine = [
      'Checkout',
      'Enter card details',
      'Charge card',
      'Payment OK?',
      'In stock?',
      'Email receipt',
      'Order placed',
    ].map(node);
    // The flowchart layout ranks the steps; a Yes sits left of its No, so the column steps aside at each
    // decision (docs/specs/009-elements/flowchart.md "The layout").
    for (let i = 1; i < spine.length; i++)
      expect(spine[i]!.y).toBeGreaterThan(spine[i - 1]!.y + spine[i - 1]!.height);
  });

  it('labels both exits of every decision Yes / No', () => {
    for (const gate of ['Payment OK?', 'In stock?']) {
      const out = arrows(els).filter((a) => pinnedTo(a, 'from') === node(gate).id);
      expect(out.map((a) => a.label).sort()).toEqual(['No', 'Yes']);
    }
  });

  it('loops a declined card back to the form and rejoins a back-order at the receipt', () => {
    const retry = arrows(els).find((a) => pinnedTo(a, 'from') === node('Show card error').id)!;
    expect(pinnedTo(retry, 'to')).toBe(node('Enter card details').id);
    expect(retry.arrowStyle).toBe('angled');
    expect(node('Show card error').colorPreset).toBe('outline');
    const rejoin = arrows(els).find((a) => pinnedTo(a, 'from') === node('Back-order item').id)!;
    expect(pinnedTo(rejoin, 'to')).toBe(node('Email receipt').id);
  });

  it('keys one miniature of each symbol beside the flow', () => {
    for (const t of [
      'Key',
      'Start or end',
      'Process step',
      'Decision (yes / no)',
      'Input or output',
      'Document',
    ])
      expect(texts(els)).toContain(t);
    const minis = shapes(els).filter((s) => s.label === '' && s.width === 56);
    expect(minis.map((m) => m.shape)).toEqual([
      'stadium',
      'square',
      'diamond',
      'parallelogram',
      'document',
    ]);
  });
});

describe('decision tree template', () => {
  const els = buildTemplate('decision-tree', 0, 0);
  const diamonds = shapes(els, 'diamond');
  const outcomes = shapes(els, 'square').filter((s) => s.richText);

  it('asks three questions as diamonds, the root bold and the follow-ups soft', () => {
    expect(diamonds.map((d) => d.label)).toEqual([
      'Tests all green?',
      'Only a flaky test?',
      'Weekend on-call covered?',
    ]);
    expect(diamonds.map((d) => d.colorPreset)).toEqual(['bold', 'soft', 'soft']);
  });

  it('branches No to the left and Yes to the right, as elbows out of a corner or the bottom', () => {
    const branches = arrows(els);
    expect(branches).toHaveLength(6);
    const centreX = (id: string | undefined) => {
      const s = els.find((el) => el.id === id) as Shape;
      return s.x + s.width / 2;
    };
    for (const a of branches) {
      expect(a.arrowStyle).toBe('angled');
      // A Decision's exit leaves by the side corner its step lies beyond, else by the bottom.
      expect(['s', a.label === 'Yes' ? 'e' : 'w']).toContain(
        a.from.kind === 'pinned' && a.from.anchor,
      );
    }
    for (const d of diamonds) {
      const out = branches.filter((a) => pinnedTo(a, 'from') === d.id);
      const target = (label: string) =>
        centreX(
          pinnedTo(
            out.find((a) => a.label === label)!,
            'to',
          ),
        );
      expect(target('No')).toBeLessThan(target('Yes'));
    }
  });

  it('colours the outcomes worst to best with the status presets, each with a sticker', () => {
    const sorted = [...outcomes].sort((a, b) => a.x - b.x);
    expect(sorted.map((o) => o.colorPreset)).toEqual(['danger', 'warning', 'warning', 'success']);
    expect(sorted[3]!.label!.startsWith('Ship it')).toBe(true);
    const stickers = shapes(els, 'sticker');
    expect(stickers).toHaveLength(4);
    for (const s of stickers) expect(outcomes.some((o) => overlaps(o, s))).toBe(true);
  });

  it('keys the three outcome colours', () => {
    for (const t of ['Go', 'Wait', 'Stop']) expect(texts(els)).toContain(t);
  });
});

describe('OKR tree template', () => {
  const els = buildTemplate('okr-tree', 0, 0);
  const rings = shapes(els, 'progress-ring');

  it('tops the tree with a bold objective that names its owner', () => {
    const objective = byLabel(els, 'Make self-serve customers successful');
    expect(objective.colorPreset).toBe('bold');
    expect(objective.iconId).toBe('target');
    expect(objective.label).toContain('Owner');
  });

  it('gives every key result a progress ring and baseline → target numbers', () => {
    expect(rings).toHaveLength(3);
    const krs = texts(els).filter((t) => /^KR\d/.test(t));
    expect(krs).toHaveLength(3);
    expect(krs.every((t) => t.includes('→') && t.includes('Owner'))).toBe(true);
  });

  it('colours key-result health with the status presets, card and ring alike', () => {
    expect(rings.map((r) => r.colorPreset)).toEqual(['success', 'warning', 'success']);
    const cards = shapes(els, 'square').filter((s) => s.label === '');
    expect(cards.map((c) => c.colorPreset)).toEqual(['success', 'warning', 'success']);
  });

  it('hangs two badged initiatives off each key result on straight drops', () => {
    expect(shapes(els, 'sticker').map((s) => s.stickerId)).toEqual([
      'badge-done',
      'badge-wip',
      'badge-wip',
      'badge-todo',
      'badge-done',
      'badge-wip',
    ]);
    const lines = arrows(els);
    expect(lines).toHaveLength(9);
    expect(lines.every((a) => a.arrowEnds === 'none' && a.curvePoints?.length === 2)).toBe(true);
    // The six KR-to-initiative drops are straight: both waypoints share one x.
    const cardIds = new Set(
      shapes(els, 'square')
        .filter((s) => s.label === '')
        .map((s) => s.id),
    );
    const drops = lines.filter((a) => cardIds.has(pinnedTo(a, 'from') ?? ''));
    expect(drops).toHaveLength(6);
    expect(drops.every((a) => a.curvePoints![0]!.dx === a.curvePoints![1]!.dx)).toBe(true);
  });
});

describe('sitemap template', () => {
  const els = buildTemplate('sitemap', 0, 0);
  const lines = arrows(els);
  const home = byLabel(els, 'Home');
  const nodes = shapes(els, 'mind-node');

  it('is a live mind map: every card a mind node, Home its downward root', () => {
    expect(shapes(els).every((s) => s.shape === 'mind-node')).toBe(true);
    expect(home.mindParentId).toBeUndefined();
    expect(home.mindFlow).toBe('downward');
    expect(nodes.filter((n) => !n.mindParentId)).toHaveLength(1);
    // Every node but Home hangs off a parent through one connector.
    expect(lines).toHaveLength(nodes.length - 1);
  });

  it('puts a bold Home over three hued nav sections, each with a glyph', () => {
    expect(home.colorPreset).toBe('bold');
    expect(home.iconId).toBe('home');
    const sections = ['Product', 'Pricing', 'Resources'].map((l) => byLabel(els, l));
    expect(sections.every((s) => s.mindParentId === home.id)).toBe(true);
    expect(new Set(sections.map((s) => s.fillColor)).size).toBe(3);
    expect(sections.every((s) => s.iconId)).toBe(true);
  });

  it('gives every page a type glyph and its route on its own second line', () => {
    for (const [page, route] of [
      ['Features', '/product/features'],
      ['FAQ', '/pricing/faq'],
      ['Changelog', '/changelog'],
      ['About us', '/about'],
      ['Sign up', '/signup'],
    ] as const) {
      const node = byLabel(els, page);
      expect(node.iconId).toBeTruthy();
      expect(node.label).toBe(`${page}\n${route}`);
    }
  });

  it('hangs the footer pages far left and the utility pages far right, on dashed lines', () => {
    const footer = byLabel(els, 'Footer');
    const utility = byLabel(els, 'Utility');
    const xs = nodes.filter((n) => n.mindParentId === home.id).map((n) => n.x);
    expect(footer.x).toBe(Math.min(...xs));
    expect(utility.x).toBe(Math.max(...xs));
    const dashed = lines.filter((a) => a.strokeStyle === 'dashed');
    expect(dashed).toHaveLength(6);
  });

  it('draws square buses with no arrowheads, whatever the tab finish', () => {
    expect(lines.every((a) => a.arrowEnds === 'none' && a.finish === 'professional')).toBe(true);
    // In the mind map's default look, so the Professional finish routes them as one bus per parent.
    expect(lines.every((a) => isDefaultMindConnectorLook(a))).toBe(true);
  });

  it('is exactly the tidy layout, so it grows tidily', () => {
    const layout = layoutMindTree(nodes, home.id, 'downward');
    const dx = home.x - layout.get(home.id)!.x;
    const dy = home.y - layout.get(home.id)!.y;
    for (const n of nodes) {
      expect(n.x).toBe(layout.get(n.id)!.x + dx);
      expect(n.y).toBe(layout.get(n.id)!.y + dy);
    }
  });

  it('keeps every card clear of every other', () => {
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) expect(overlaps(nodes[i]!, nodes[j]!)).toBe(false);
  });
});
