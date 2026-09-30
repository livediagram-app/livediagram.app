import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { buildTemplate } from './template-builders';

// Structure pins for the Crazy 8s and User persona starters
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"). Each test maps to
// a sentence of that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Box = { x: number; y: number; width: number; height: number };
const SCAFFOLD = 'layer:template:scaffold';
const CONTENT = 'layer:template:content';

const shapesOf = (els: Element[], shape: string) =>
  els.filter((el) => el.type === 'shape' && el.shape === shape) as Shape[];
const labelOf = (el: Element) => (el as { label?: string }).label ?? '';
const labels = (els: Element[]) => els.map(labelOf).filter(Boolean);
const byLabel = (els: Element[], label: string) => els.find((el) => labelOf(el) === label)!;
const inside = (a: Box, b: Box) =>
  a.x >= b.x - 0.5 &&
  a.y >= b.y - 0.5 &&
  a.x + a.width <= b.x + b.width + 0.5 &&
  a.y + a.height <= b.y + b.height + 0.5;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const NO_EM_DASH = /\u2014/;

describe('crazy 8s template', () => {
  const els = buildTemplate('crazy-eights', 0, 0);
  const frames = shapesOf(els, 'frame');
  const sheet = frames.find((f) => f.label === '')!;
  const panels = frames.filter((f) => /^Minute \d$/.test(f.label ?? ''));

  it('puts every element on the Sheet or Sketches layer', () => {
    expect(els.every((el) => el.layerId === SCAFFOLD || el.layerId === CONTENT)).toBe(true);
    expect(sheet.layerId).toBe(SCAFFOLD);
    for (const p of panels) expect(p.layerId).toBe(SCAFFOLD);
  });

  it('runs the exercise for one Plateful prompt', () => {
    expect(labels(els)).toContain('HOW MIGHT WE');
    expect(labels(els)).toContain('make reordering a favourite meal take two taps?');
  });

  it('opens with an 8-minute timer, a 3-dot vote and a done check', () => {
    const tools = shapesOf(els, 'session-button').map((b) => b.session);
    expect(tools).toEqual([
      { tool: 'timer', minutes: 8 },
      { tool: 'vote', dots: 3 },
    ]);
    const done = shapesOf(els, 'done-check');
    expect(done).toHaveLength(1);
    expect(done[0]!.label).toBe('Finished sketching?');
  });

  it('lists the four steps in running order', () => {
    const steps = ['Fold', 'Sketch', 'Present', 'Vote'].map((t) => byLabel(els, t) as Box);
    for (let i = 1; i < steps.length; i++) expect(steps[i]!.y).toBeGreaterThan(steps[i - 1]!.y);
  });

  it('folds the sheet into eight numbered panels, two rows of four, each with its minute', () => {
    expect(panels.map((p) => p.label)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `Minute ${n}`));
    expect(new Set(panels.map((p) => p.y)).size).toBe(2);
    expect(new Set(panels.map((p) => p.x)).size).toBe(4);
    for (const p of panels) expect(inside(p, sheet)).toBe(true);
    for (let i = 0; i < panels.length; i++)
      for (let j = i + 1; j < panels.length; j++)
        expect(overlaps(panels[i]!, panels[j]!)).toBe(false);
    // One number chip per panel, on its corner.
    for (const [i, p] of panels.entries()) {
      const chip = shapesOf(els, 'circle').find((c) => c.label === `${i + 1}` && inside(c, p));
      expect(chip, `chip ${i + 1}`).toBeDefined();
    }
  });

  it('sketches the first three panels and leaves five empty with a nudge', () => {
    // A sketch is drawn from plain shapes (bodies, buttons, scribbles).
    const sketchParts = (p: Box) =>
      shapesOf(els, 'square')
        .concat(shapesOf(els, 'stadium'))
        .filter((el) => el.layerId === CONTENT && inside(el, p));
    panels.slice(0, 3).forEach((p) => expect(sketchParts(p).length).toBeGreaterThanOrEqual(5));
    panels.slice(3).forEach((p) => expect(sketchParts(p)).toHaveLength(0));
    for (const caption of ['Your usual, on home', 'Friday nudge at 5pm', 'Tap it on your watch'])
      expect(labels(els)).toContain(caption);
    // Every sketch counts its taps: a "1" and a "2" marker each.
    for (const p of panels.slice(0, 3)) {
      const taps = shapesOf(els, 'circle').filter(
        (c) => c.layerId === CONTENT && overlaps(c, p) && /^[12]$/.test(c.label ?? ''),
      );
      expect(taps.map((t) => t.label).sort()).toEqual(['1', '2']);
    }
  });

  it('keeps every sketch element inside its panel', () => {
    for (const el of els) {
      if (el.layerId !== CONTENT || el.type === 'arrow' || !('x' in el)) continue;
      if (!overlaps(el as Box, sheet) || (el.type === 'shape' && el.shape === 'sticker')) continue;
      if (inside(el as Box, { ...sheet, height: 90 })) continue; // the sheet's name + status
      expect(
        panels.some((p) => inside(el as Box, p)),
        labelOf(el) || (el as Shape).shape,
      ).toBe(true);
    }
  });

  it('invites everyone to duplicate the sheet', () => {
    expect(labels(els).some((l) => /duplicate it/.test(l))).toBe(true);
  });

  it('writes no em dashes', () => {
    for (const l of labels(els)) expect(l).not.toMatch(NO_EM_DASH);
  });
});

describe('user persona template', () => {
  const els = buildTemplate('user-persona', 0, 0);
  const squares = shapesOf(els, 'square');
  const panelOf = (title: string) => squares.find((s) => inside(byLabel(els, title) as Box, s))!;

  it('puts every element on the Card or Details layer', () => {
    expect(els.every((el) => el.layerId === SCAFFOLD || el.layerId === CONTENT)).toBe(true);
    for (const s of els.filter((el) => el.type === 'sticky')) expect(s.layerId).toBe(CONTENT);
  });

  it('leads with a profile card: portrait, name, archetype, facts, quote and research', () => {
    const card = panelOf('Maya Chen');
    expect(labels(els)).toContain('The weeknight planner');
    const portrait = shapesOf(els, 'circle').find((c) => c.label === 'MC')!;
    expect(portrait).toBeDefined();
    expect(overlaps(portrait, card)).toBe(true);
    for (const fact of ['Leeds, UK', 'Partner and two kids, 6 and 9'])
      expect(inside(byLabel(els, fact) as Box, card)).toBe(true);
    expect(labels(els).some((l) => l.startsWith('34 · '))).toBe(true);
    const quote = els.find((el) => labelOf(el).startsWith('“By six'))!;
    expect(inside(quote as Box, card)).toBe(true);
    expect(inside(byLabel(els, 'Based on 12 interviews, Aug 2026') as Box, card)).toBe(true);
    expect(shapesOf(els, 'stat-row')[0]!.stats).toHaveLength(3);
  });

  it('gives Goals, Frustrations and Behaviours three notes each in their own hue', () => {
    const hues = new Set<string | undefined>();
    for (const title of ['Goals', 'Frustrations', 'Behaviours']) {
      const panel = panelOf(title);
      const notes = els.filter(
        (el): el is Extract<Element, { type: 'sticky' }> =>
          el.type === 'sticky' && inside(el, panel),
      );
      expect(notes, title).toHaveLength(3);
      expect(new Set(notes.map((n) => n.fillColor)).size).toBe(1);
      hues.add(panel.fillColor);
    }
    expect(hues.size).toBe(3);
  });

  it('places her on four spectrums with progress bars', () => {
    const panel = panelOf('Personality');
    const bars = shapesOf(els, 'progress-bar');
    expect(bars).toHaveLength(4);
    for (const b of bars) expect(inside(b, panel)).toBe(true);
    for (const pole of ['Price-first', 'Convenience-first', 'Planner', 'Spontaneous'])
      expect(inside(byLabel(els, pole) as Box, panel)).toBe(true);
  });

  it('shows where to reach her and a tech-comfort rating', () => {
    const panel = panelOf('Channels');
    const rating = shapesOf(els, 'rating')[0]!;
    expect(rating.rating).toBe(4);
    expect(inside(rating, panel)).toBe(true);
    expect(labels(els).filter((l) => /^(Plateful app|Instagram|Email) · /.test(l))).toHaveLength(3);
  });

  it('closes with How we help: three needs, each answered', () => {
    const panel = panelOf('How we help');
    for (const need of ['Decide in seconds', 'Trust the total', 'Agree it together'])
      expect(inside(byLabel(els, need) as Box, panel)).toBe(true);
  });

  it('keeps the panels apart and every panel ink fixed for dark canvases', () => {
    const panels = [
      'Maya Chen',
      'Goals',
      'Frustrations',
      'Behaviours',
      'Personality',
      'Channels',
      'How we help',
    ].map(panelOf);
    for (let i = 0; i < panels.length; i++)
      for (let j = i + 1; j < panels.length; j++)
        expect(overlaps(panels[i]!, panels[j]!)).toBe(false);
    for (const p of panels) expect(p.themeLockFill).toBe(true);
    // Text on a panel carries its own ink, so a dark theme cannot turn it white.
    for (const el of els) {
      if (el.type !== 'text' || !panels.some((p) => inside(el, p))) continue;
      expect(el.textColor, el.label).toBeDefined();
    }
  });

  it('writes no em dashes', () => {
    for (const l of labels(els)) expect(l).not.toMatch(NO_EM_DASH);
  });
});
