import { describe, expect, it } from 'vitest';
import { runsPlainText, type Element } from '@livediagram/document';
import { buildTemplate } from './template-builders';

// Structure pins for the board, session and workshop starters redesigned
// together (docs/specs/008-canvas/canvas-and-palette.md "Templates", and
// docs/specs/012-collaboration/qa-board.md "Templates" for the two session
// boards): Kanban, SWOT, prioritization matrix, Lean Coffee, Town Hall Q&A,
// affinity map and user story map. Each test maps to a sentence of those specs.

type Shape = Extract<Element, { type: 'shape' }>;
type Sticky = Extract<Element, { type: 'sticky' }>;
type Arrow = Extract<Element, { type: 'arrow' }>;

const labelOf = (el: Element) => (el as { label?: string }).label ?? '';
const texts = (els: Element[]) => els.filter((el) => el.type === 'text').map(labelOf);
const shapesOf = (els: Element[], shape: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && el.shape === shape);
const stickies = (els: Element[]) => els.filter((el): el is Sticky => el.type === 'sticky');
const arrows = (els: Element[]) => els.filter((el): el is Arrow => el.type === 'arrow');
const box = (el: Element) =>
  el as unknown as { x: number; y: number; width: number; height: number };
const inside = (inner: Element, outer: Element) => {
  const a = box(inner);
  const b = box(outer);
  return (
    a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height
  );
};

describe('kanban template', () => {
  const els = buildTemplate('kanban', 0, 0);
  const lanes = shapesOf(els, 'square').filter((s) => s.height > 400);
  const tickets = els.filter((el) => Array.isArray((el as { richText?: unknown }).richText));

  it('titles the sprint and shows its goal with a progress bar', () => {
    expect(texts(els)).toContain('Sprint 12 · Checkout revamp');
    expect(texts(els).some((t) => t.startsWith('Goal:'))).toBe(true);
    expect(shapesOf(els, 'progress-bar')).toHaveLength(1);
  });

  it('runs five tinted lanes from Backlog to Done, each with a glyph', () => {
    const headers = ['Backlog', 'To do', 'In progress', 'Review', 'Done'];
    for (const h of headers) expect(texts(els)).toContain(h);
    expect(lanes).toHaveLength(5);
    expect(new Set(lanes.map((l) => l.fillColor)).size).toBe(5);
    expect(shapesOf(els, 'icon')).toHaveLength(5);
  });

  it('states the WIP limit on the two capped lanes', () => {
    const chips = shapesOf(els, 'stadium').map((s) => s.label);
    expect(chips).toContain('3 / 3');
    expect(chips).toContain('1 / 2');
    expect(texts(els).filter((t) => t.startsWith('WIP limit'))).toHaveLength(2);
  });

  it('bolds each ticket id ahead of a plain summary', () => {
    expect(tickets).toHaveLength(15);
    for (const t of tickets) {
      const runs = (t as { richText: { text: string; bold?: boolean }[] }).richText;
      expect(labelOf(t)).toBe(runsPlainText(runs));
      expect(runs[0]?.bold).toBe(true);
      expect(runs[0]?.text).toMatch(/^CHK-\d+:$/);
      expect(runs[1]?.bold).toBeUndefined();
    }
  });

  it('tags every ticket with a preset-bound chip and marks priority with a traffic light', () => {
    const tags = shapesOf(els, 'stadium').filter((s) =>
      ['Frontend', 'Backend', 'Design', 'Bug', 'Infra'].includes(s.label ?? ''),
    );
    expect(tags).toHaveLength(15);
    expect(tags.map((t) => t.colorPreset)).toContain('info');
    expect(tags.every((t) => t.colorPreset && !t.themeLockFill)).toBe(true);
    const priorities = shapesOf(els, 'stadium').filter((s) => s.marker);
    // Every ticket but the four Done ones carries a priority.
    expect(priorities).toHaveLength(11);
    for (const p of priorities) {
      expect(
        { High: 'red-circle', Medium: 'orange-circle', Low: 'green-circle' }[p.label ?? ''],
      ).toBe(p.marker);
    }
  });

  it('puts owners on theme-locked initials discs, leaving the backlog unassigned', () => {
    const owners = shapesOf(els, 'circle');
    // 15 tickets, the four in Backlog unassigned.
    expect(owners).toHaveLength(11);
    expect(owners.every((o) => o.themeLockFill && /^[A-Z]{2}$/.test(o.label ?? ''))).toBe(true);
    const backlog = lanes[0]!;
    expect(owners.some((o) => inside(o, backlog))).toBe(false);
  });

  it('flags one blocked ticket with a thick red border and a BLOCKED badge', () => {
    expect(shapesOf(els, 'sticker').filter((s) => s.stickerId === 'badge-blocked')).toHaveLength(1);
    const blocked = shapesOf(els, 'square').filter((s) => s.strokeWidth === 'thick');
    expect(blocked).toHaveLength(1);
    expect(inside(blocked[0]!, lanes[2]!)).toBe(true);
  });

  it('ends the Done lane on a trophy', () => {
    const trophy = shapesOf(els, 'sticker').find((s) => s.stickerId === 'emoji-trophy');
    expect(trophy && inside(trophy, lanes[4]!)).toBe(true);
    expect(texts(els)).toContain('4 tickets shipped');
  });
});

describe('swot template', () => {
  const els = buildTemplate('swot', 0, 0);

  it('names the decision under analysis', () => {
    expect(texts(els)).toContain('SWOT · Should Brightside Coffee open in York?');
  });

  it('labels both axes, rotating the row labels', () => {
    for (const axis of ['Helpful', 'Harmful', 'Internal', 'External'])
      expect(texts(els)).toContain(axis);
    const rows = els.filter((el) => ['Internal', 'External'].includes(labelOf(el)));
    expect(rows.every((r) => (r as { rotation?: number }).rotation === -90)).toBe(true);
  });

  it('gives each quadrant a header, a glyph, a prompt and three stickies in its hue', () => {
    for (const q of ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'])
      expect(texts(els)).toContain(q);
    expect(shapesOf(els, 'icon')).toHaveLength(5); // four quadrants + the So what? target
    // Four prompts, plus the title and the So what? heading.
    expect(texts(els).filter((t) => t.endsWith('?'))).toHaveLength(6);
    const notes = stickies(els);
    expect(notes).toHaveLength(12);
    expect(new Set(notes.map((n) => n.fillColor)).size).toBe(4);
  });

  it('turns the pairings into four moves in a So what? strip', () => {
    expect(texts(els)).toContain('So what?');
    const chips = shapesOf(els, 'stadium').map((s) => s.label);
    expect(chips).toEqual(['S + O · Grow', 'W + O · Fix', 'S + T · Defend', 'W + T · Avoid']);
  });
});

describe('prioritization matrix template', () => {
  const els = buildTemplate('prioritization-matrix', 0, 0);
  const quadrants = shapesOf(els, 'square');

  it('names the four quadrants, Quick wins top-left', () => {
    const names = ['Quick wins', 'Big bets', 'Fill-ins', 'Money pits'];
    for (const n of names) expect(texts(els)).toContain(n);
    expect(quadrants).toHaveLength(4);
    const [qw, bb, fi, mp] = quadrants;
    expect(qw!.x).toBeLessThan(bb!.x);
    expect(qw!.y).toBeLessThan(fi!.y);
    expect(mp!.x).toBe(bb!.x);
    expect(mp!.y).toBe(fi!.y);
  });

  it('arrows impact up the left and effort along the bottom', () => {
    const axes = arrows(els);
    expect(axes).toHaveLength(2);
    const [impact, effort] = axes as [Arrow, Arrow];
    if (impact.from.kind !== 'free' || impact.to.kind !== 'free') throw new Error('free axis');
    if (effort.from.kind !== 'free' || effort.to.kind !== 'free') throw new Error('free axis');
    expect(impact.to.y).toBeLessThan(impact.from.y);
    expect(effort.to.x).toBeGreaterThan(effort.from.x);
    for (const l of ['Impact', 'Effort']) expect(texts(els)).toContain(l);
  });

  it('places eight dot-voted ideas inside the quadrants', () => {
    const ideas = stickies(els);
    expect(ideas).toHaveLength(8);
    for (const idea of ideas) expect(quadrants.some((q) => inside(idea, q))).toBe(true);
    const tallies = shapesOf(els, 'circle');
    expect(tallies).toHaveLength(8);
    expect(tallies.every((t) => t.colorPreset === 'inked' && /^\d+$/.test(t.label ?? ''))).toBe(
      true,
    );
  });

  it('runs the ritual in a rail: vote, size, commit', () => {
    const vote = shapesOf(els, 'session-button');
    expect(vote.map((v) => v.session?.tool)).toEqual(['vote']);
    expect(shapesOf(els, 'estimate')[0]?.estimateScale).toBe('tshirt');
    const commit = shapesOf(els, 'checklist')[0]?.checklistItems ?? [];
    expect(commit.length).toBeGreaterThan(0);
    expect(commit.every((c) => c.text.split(' · ').length === 3)).toBe(true);
  });
});

describe('lean coffee template', () => {
  const els = buildTemplate('lean-coffee', 0, 0);

  it('draws the four-step loop as joined cards with a loop back to Discuss', () => {
    for (const s of ['Propose', 'Vote', 'Discuss', 'Keep going?']) expect(texts(els)).toContain(s);
    const links = arrows(els);
    expect(links).toHaveLength(4);
    expect(links.every((a) => a.from.kind === 'pinned' && a.to.kind === 'pinned')).toBe(true);
    expect(links.filter((a) => a.label === 'Next topic')).toHaveLength(1);
  });

  it('seats an empty Topics board in the middle', () => {
    const board = shapesOf(els, 'qa-board');
    expect(board.map((b) => b.label)).toEqual(['Topics']);
    expect(board[0]!.qaNotes).toBeUndefined();
  });

  it('lays the kit out in the order it is pressed: timebox, poll, extension', () => {
    const kit = shapesOf(els, 'session-button').sort((a, b) => a.y - b.y);
    expect(kit.map((k) => k.session)).toEqual([
      { tool: 'timer', minutes: 8 },
      { tool: 'poll', question: 'Keep going on this topic?', style: 'yesNo' },
      { tool: 'timer', minutes: 4 },
    ]);
    expect(shapesOf(els, 'checklist')).toHaveLength(1);
  });
});

describe('town hall template', () => {
  const els = buildTemplate('town-hall', 0, 0);

  it('introduces the panel with initials discs', () => {
    const discs = shapesOf(els, 'circle');
    expect(discs).toHaveLength(3);
    expect(discs.every((d) => d.themeLockFill)).toBe(true);
    expect(texts(els)).toContain('Maya Chen');
  });

  it('runs the show from an agenda whose segments name their owner', () => {
    const items = shapesOf(els, 'agenda')[0]?.agendaItems ?? [];
    expect(items.length).toBe(5);
    expect(items.every((i) => i.label.includes(' · '))).toBe(true);
    expect(items.find((i) => i.label.startsWith('Open Q&A'))?.minutes).toBe(30);
  });

  it('centres an empty questions board', () => {
    const board = shapesOf(els, 'qa-board');
    expect(board.map((b) => b.label)).toEqual(['Questions for the panel']);
    expect(board[0]!.qaNotes).toBeUndefined();
  });

  it('keeps a facilitator kit: Q&A timer, applause and a closing rating poll', () => {
    const kit = shapesOf(els, 'session-button').map((b) => b.session);
    expect(kit).toContainEqual({ tool: 'timer', minutes: 30 });
    expect(kit.find((k) => k?.tool === 'poll')?.style).toBe('rating');
    expect(shapesOf(els, 'reaction-pad')[0]?.reaction).toBe('applause');
    expect(texts(els)).toContain('Follow-ups');
  });
});

describe('affinity map template', () => {
  const els = buildTemplate('affinity-map', 0, 0);
  const notes = stickies(els);
  const byFill = (fill: string) => notes.filter((n) => n.fillColor === fill);

  it('stacks the hierarchy: yellow notes, blue insights, pink themes', () => {
    expect(byFill('#fecdd3')).toHaveLength(2);
    expect(byFill('#bae6fd')).toHaveLength(4);
    expect([...byFill('#bae6fd'), ...byFill('#fecdd3')].every((n) => n.textBold)).toBe(true);
    // Ten clustered notes plus the two still unsorted.
    expect(byFill('#fde68a')).toHaveLength(12);
  });

  it('tags every raw note with its participant', () => {
    expect(byFill('#fde68a').every((n) => / · P\d+$/.test(n.label ?? ''))).toBe(true);
  });

  it('frames each theme round its groups with a dashed boundary', () => {
    const frames = shapesOf(els, 'frame');
    expect(frames).toHaveLength(2);
    expect(frames.every((f) => f.strokeStyle === 'dashed')).toBe(true);
    for (const n of [...byFill('#fecdd3'), ...byFill('#bae6fd')])
      expect(frames.some((f) => inside(n, f))).toBe(true);
  });

  it('tallies the dot vote on each insight', () => {
    expect(shapesOf(els, 'session-button')[0]?.session?.tool).toBe('vote');
    const tallies = shapesOf(els, 'circle');
    expect(tallies).toHaveLength(4);
    expect(tallies.every((t) => t.colorPreset === 'inked')).toBe(true);
  });

  it('leaves an unsorted pile outside the frames, leaning harder', () => {
    expect(texts(els)).toContain('Unsorted');
    const frames = shapesOf(els, 'frame');
    const loose = byFill('#fde68a').filter((n) => !frames.some((f) => inside(n, f)));
    expect(loose).toHaveLength(2);
    expect(loose.every((n) => Math.abs(n.rotation ?? 0) >= 4)).toBe(true);
  });
});

describe('user story map template', () => {
  const els = buildTemplate('user-story-map', 0, 0);
  const notes = stickies(els);
  const activities = notes.filter((n) => n.fillColor === '#fed7aa');
  const tasks = notes.filter((n) => n.fillColor === '#bae6fd');
  const stories = notes.filter((n) => n.fillColor === '#fde68a');

  it('runs a journey arrow over activities that span their tasks', () => {
    expect(arrows(els)).toHaveLength(1);
    expect(activities.map((a) => a.label)).toEqual([
      'Find groceries',
      'Fill the basket',
      'Pay and receive',
    ]);
    expect(tasks).toHaveLength(6);
    for (const a of activities) {
      const under = tasks.filter((t) => t.x >= a.x && t.x + t.width <= a.x + a.width);
      expect(under).toHaveLength(2);
    }
  });

  it('cuts release lanes across the stories, each story inside one lane', () => {
    const lanes = shapesOf(els, 'lane');
    expect(lanes.map((l) => l.label)).toEqual(['MVP · Oct', 'Release 2 · Dec', 'Later']);
    expect(stories.length).toBe(20);
    for (const s of stories) expect(lanes.filter((l) => inside(s, l))).toHaveLength(1);
  });

  it('names who the journey belongs to', () => {
    expect(notes.some((n) => (n.label ?? '').startsWith('Sam, 38'))).toBe(true);
  });
});
