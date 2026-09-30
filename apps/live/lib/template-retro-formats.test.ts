import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import {
  TEMPLATE_CONTENT_LAYER_ID,
  TEMPLATE_SCAFFOLD_LAYER_ID,
  templateCanvasOverrides,
  templateLayers,
} from '@livediagram/templates';
import { buildTemplate, buildTemplatedTab } from './template-builders';

// Structure pins for the retro formats (docs/specs/008-canvas/canvas-and-palette.md "Templates"):
// Start / Stop / Continue, Mad / Sad / Glad, 4Ls and Sailboat. They share the
// Retrospective's ritual (the retro kit): a mood check, a writing timer, a dot
// vote and owned actions. Each test maps to a sentence of the spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Text = Extract<Element, { type: 'text' }>;
type Sticky = Extract<Element, { type: 'sticky' }>;
type Box = { x: number; y: number; width: number; height: number };

const shapesOf = (els: Element[], shape: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && el.shape === shape);
const textsOf = (els: Element[]) => els.filter((el): el is Text => el.type === 'text');
const stickiesOf = (els: Element[]) => els.filter((el): el is Sticky => el.type === 'sticky');
const text = (els: Element[], label: string) => {
  const found = textsOf(els).find((t) => t.label === label);
  if (!found) throw new Error(`no text "${label}"`);
  return found;
};
const inside = (a: Box, b: Box) =>
  a.x >= b.x - 0.5 &&
  a.y >= b.y - 0.5 &&
  a.x + a.width <= b.x + b.width + 0.5 &&
  a.y + a.height <= b.y + b.height + 0.5;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
// The tinted container a header text sits in.
const panelOf = (els: Element[], label: string) => {
  const t = text(els, label);
  const panel = shapesOf(els, 'square')
    .filter((s) => inside(t, s))
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];
  if (!panel) throw new Error(`no panel around "${label}"`);
  return panel;
};
const notesIn = (els: Element[], box: Box) => stickiesOf(els).filter((s) => inside(s, box));

// The ritual every format shares: a fist-of-five, a timer, a dot vote and a
// checklist whose every line reads "what · who · when".
function expectRitual(els: Element[], question: string, minutes: number) {
  expect(shapesOf(els, 'temperature').map((t) => t.label)).toEqual([question]);
  expect(shapesOf(els, 'session-button').map((b) => b.session)).toEqual([
    { tool: 'timer', minutes },
    { tool: 'vote', dots: 3 },
  ]);
  const lines = shapesOf(els, 'checklist').flatMap((c) => c.checklistItems ?? []);
  expect(lines.length).toBeGreaterThanOrEqual(4);
  for (const line of lines) expect(line.text.split(' · ')).toHaveLength(3);
}

describe('every retro format', () => {
  const kinds = ['start-stop-continue', 'mad-sad-glad', 'four-ls', 'sailboat'] as const;

  it('ships Board under Stickies, every element on one of the two', () => {
    for (const kind of kinds) {
      expect(templateLayers(kind)!.map((l) => l.name)).toEqual(['Board', 'Stickies']);
      for (const el of buildTemplate(kind, 0, 0)) {
        expect([TEMPLATE_SCAFFOLD_LAYER_ID, TEMPLATE_CONTENT_LAYER_ID]).toContain(el.layerId);
      }
    }
  });

  it('keeps notes, tools and checklists on the content layer', () => {
    for (const kind of kinds) {
      const els = buildTemplate(kind, 0, 0);
      const live = els.filter(
        (el) =>
          el.type === 'sticky' ||
          (el.type === 'shape' &&
            ['temperature', 'session-button', 'checklist', 'idea-box', 'agenda'].includes(
              el.shape,
            )),
      );
      expect(live.length).toBeGreaterThan(0);
      for (const el of live) expect(el.layerId).toBe(TEMPLATE_CONTENT_LAYER_ID);
    }
  });

  it('keeps each column hue’s notes apart under a non-brand theme', () => {
    for (const kind of kinds) {
      const tab = buildTemplatedTab(kind, 'slate', `tab-${kind}`, kind);
      const hues = new Set(stickiesOf(tab.elements).map((s) => s.fillColor));
      expect(hues.size, kind).toBeGreaterThanOrEqual(3);
    }
  });

  it('never overlaps two notes', () => {
    for (const kind of kinds) {
      const notes = stickiesOf(buildTemplate(kind, 0, 0));
      for (let i = 0; i < notes.length; i++) {
        for (let j = i + 1; j < notes.length; j++) {
          expect(overlaps(notes[i]!, notes[j]!), `${kind}: ${notes[i]!.label}`).toBe(false);
        }
      }
    }
  });
});

describe('start, stop, continue template', () => {
  const els = buildTemplate('start-stop-continue', 0, 0);

  it('runs the shared ritual under its sprint title', () => {
    expect(text(els, 'Sprint 22 · Start, Stop, Continue').textBold).toBe(true);
    expectRitual(els, 'How did Sprint 22 feel?', 5);
  });

  it('reads like a traffic light: green Start, rose Stop, sky Continue, left to right', () => {
    const cols = ['Start', 'Stop', 'Continue'].map((l) => panelOf(els, l));
    expect(cols.map((c) => c.fillColor)).toEqual(['#dcfce7', '#ffe4e6', '#e0f2fe']);
    expect(cols[0]!.x).toBeLessThan(cols[1]!.x);
    expect(cols[1]!.x).toBeLessThan(cols[2]!.x);
    for (const col of cols) expect(notesIn(els, col)).toHaveLength(3);
    expect(text(els, 'What’s getting in our way?')).toBeTruthy();
  });

  it('leads each column with a theme-locked lamp: play, stop and repeat', () => {
    const lamps = shapesOf(els, 'circle').filter((c) => c.themeLockFill);
    expect(lamps.map((l) => l.fillColor)).toEqual(['#16a34a', '#e11d48', '#0284c7']);
    const play = shapesOf(els, 'triangle')[0]!;
    expect(play.rotation).toBe(90);
    expect(inside(play, lamps[0]!)).toBe(true);
    expect(shapesOf(els, 'icon').some((i) => i.iconId === 'refresh-cw')).toBe(true);
  });

  it('closes on owned actions and checks in on last sprint’s', () => {
    const actions = panelOf(els, 'Action items');
    const [now, last] = shapesOf(els, 'checklist');
    expect(inside(now!, actions) && inside(last!, actions)).toBe(true);
    expect(text(els, 'From Sprint 21')).toBeTruthy();
    expect(last!.checklistItems!.map((i) => i.done)).toEqual([true, true, false]);
    expect(now!.checklistItems!.every((i) => !i.done)).toBe(true);
  });
});

describe('mad, sad, glad template', () => {
  const els = buildTemplate('mad-sad-glad', 0, 0);

  it('opens on honesty: how are you, really, and an anonymous idea box', () => {
    expectRitual(els, 'How are you, really?', 6);
    const box = shapesOf(els, 'idea-box')[0]!;
    expect(box.label).toBe('Say it anonymously');
    // Two cards already in, still sealed until the facilitator opens it.
    expect(box.ideaCards).toHaveLength(2);
    expect(box.ideasRevealed).toBeFalsy();
    // Sits in the rail, between the mood check and the tools.
    const mood = shapesOf(els, 'temperature')[0]!;
    expect(box.x).toBe(mood.x);
    expect(box.y).toBeGreaterThan(mood.y + mood.height);
    expect(shapesOf(els, 'session-button')[0]!.y).toBeGreaterThan(box.y + box.height);
  });

  it('leads each feeling with a big emoji, then first-person notes in its hue', () => {
    const cols = [
      { label: 'Mad', sticker: 'emoji-angry', fill: '#ffedd5' },
      { label: 'Sad', sticker: 'emoji-sad', fill: '#dbeafe' },
      { label: 'Glad', sticker: 'emoji-smile', fill: '#ecfccb' },
    ];
    for (const c of cols) {
      const panel = panelOf(els, c.label);
      expect(panel.fillColor).toBe(c.fill);
      const sticker = shapesOf(els, 'sticker').find((s) => s.stickerId === c.sticker)!;
      expect(inside(sticker, panel)).toBe(true);
      expect(sticker.width).toBeGreaterThanOrEqual(64);
      const notes = notesIn(els, panel);
      expect(notes).toHaveLength(4);
      for (const n of notes) expect(n.label).toMatch(/^I[ ’]/);
      // The emoji leads: above every note.
      for (const n of notes) expect(sticker.y + sticker.height).toBeLessThan(n.y);
    }
  });

  it('asks what would help, and ends on kind words', () => {
    const actions = panelOf(els, 'What would help?');
    expect(inside(shapesOf(els, 'checklist')[0]!, actions)).toBe(true);
    expect(inside(text(els, 'Kind words'), actions)).toBe(true);
    expect(shapesOf(els, 'sticker').some((s) => s.stickerId === 'emoji-heart')).toBe(true);
  });
});

describe('4Ls template', () => {
  const els = buildTemplate('four-ls', 0, 0);

  it('frames it as after a milestone, with a rocket and the launch in numbers', () => {
    expect(text(els, 'Checkout launch · 4Ls')).toBeTruthy();
    expect(shapesOf(els, 'sticker').map((s) => s.stickerId)).toEqual(['emoji-rocket']);
    expectRitual(els, 'How did the launch feel?', 7);
    expect(shapesOf(els, 'stat-row')[0]!.stats).toHaveLength(3);
  });

  it('lays the four Ls out as a 2x2, each with its glyph and three notes', () => {
    const [liked, learned, lacked, longed] = ['Liked', 'Learned', 'Lacked', 'Longed for'].map((l) =>
      panelOf(els, l),
    );
    expect(liked!.y).toBe(learned!.y);
    expect(lacked!.y).toBe(longed!.y);
    expect(liked!.x).toBe(lacked!.x);
    expect(learned!.x).toBe(longed!.x);
    expect(liked!.x).toBeLessThan(learned!.x);
    expect(liked!.y).toBeLessThan(lacked!.y);
    const icons = shapesOf(els, 'icon');
    for (const [panel, icon] of [
      [liked, 'heart'],
      [learned, 'book'],
      [lacked, 'battery'],
      [longed, 'star'],
    ] as const) {
      expect(icons.some((i) => i.iconId === icon && inside(i, panel!))).toBe(true);
      expect(notesIn(els, panel!)).toHaveLength(3);
    }
  });

  it('puts the rail on the left and the actions strip under the grid', () => {
    const liked = panelOf(els, 'Liked');
    const longed = panelOf(els, 'Longed for');
    const mood = shapesOf(els, 'temperature')[0]!;
    expect(mood.x + mood.width).toBeLessThan(liked.x);
    const strip = panelOf(els, 'Action items');
    expect(strip.y).toBeGreaterThan(longed.y + longed.height);
    expect(strip.x).toBe(liked.x);
    expect(strip.x + strip.width).toBe(longed.x + longed.width);
    const lists = shapesOf(els, 'checklist');
    expect(lists).toHaveLength(2);
    for (const l of lists) expect(inside(l, strip)).toBe(true);
  });
});

describe('sailboat template', () => {
  const els = buildTemplate('sailboat', 0, 0);
  const zone = (label: string) => panelOf(els, label);
  const sea = els.find(
    (el): el is Extract<Element, { type: 'freehand' }> =>
      el.type === 'freehand' && el.closed && el.fillColor === '#7dd3fc',
  )!;
  const waterline = sea.y + 8;

  it('runs the ritual round a drawn scene on a blank canvas', () => {
    expect(templateCanvasOverrides('sailboat').backgroundPattern).toBe('blank');
    expectRitual(els, 'How’s the voyage feeling?', 8);
    expect(shapesOf(els, 'agenda')[0]!.agendaItems!.map((i) => i.label)).toContain('Anchors');
    // The picture is locked against the theme so the sea stays blue.
    // (FreehandElement does not declare the flag; the theme reads it generically.)
    expect((sea as { themeLockFill?: boolean }).themeLockFill).toBe(true);
    const tab = buildTemplatedTab('sailboat', 'slate', 'tab-s', 'sailboat');
    expect(tab.elements.some((el) => el.type === 'freehand' && el.fillColor === '#7dd3fc')).toBe(
      true,
    );
  });

  type Sketch = Extract<Element, { type: 'freehand' }>;
  const sketches = els.filter((el): el is Sketch => el.type === 'freehand');
  const hull = sketches.find((el) => el.fillColor === '#b45309')!;

  it('draws a boat with a hull on the waterline, sails and a mast', () => {
    expect(hull.y).toBeLessThan(waterline);
    expect(hull.y + hull.height).toBeGreaterThan(waterline);
    const sails = sketches.filter((el) => el.fillColor === '#ffffff');
    expect(sails).toHaveLength(2);
    for (const s of sails) expect(s.y + s.height).toBeLessThan(waterline);
  });

  it('puts each zone where the metaphor does', () => {
    const wind = zone('Wind');
    const island = zone('Island');
    const anchors = zone('Anchors');
    const rocks = zone('Rocks');
    // Wind blows from the left, in the sky.
    expect(wind.x + wind.width).toBeLessThan(hull.x + hull.width / 2);
    expect(wind.y + wind.height).toBeLessThan(waterline);
    // The island is on the horizon, ahead of the boat.
    expect(island.x).toBeGreaterThan(hull.x + hull.width);
    expect(island.y + island.height).toBeLessThan(waterline);
    // Anchors hang under the hull; rocks lie ahead in the water.
    expect(anchors.y).toBeGreaterThan(hull.y + hull.height);
    expect(anchors.x).toBeLessThan(hull.x + hull.width / 2);
    expect(anchors.x + anchors.width).toBeGreaterThan(hull.x + hull.width / 2);
    expect(rocks.y).toBeGreaterThan(waterline);
    expect(rocks.x).toBeGreaterThan(anchors.x + anchors.width);
    for (const [z, n] of [
      [wind, 4],
      [island, 2],
      [anchors, 4],
      [rocks, 4],
    ] as const) {
      expect(notesIn(els, z)).toHaveLength(n);
    }
  });

  it('blows three gusts from the Wind zone into the sails', () => {
    const wind = zone('Wind');
    const gusts = els.filter(
      (el): el is Extract<Element, { type: 'arrow' }> => el.type === 'arrow',
    );
    expect(gusts).toHaveLength(3);
    for (const g of gusts) {
      if (g.from.kind !== 'free' || g.to.kind !== 'free') throw new Error('pinned gust');
      expect(g.from.x).toBeGreaterThanOrEqual(wind.x + wind.width);
      expect(g.to.x).toBeGreaterThan(g.from.x);
      expect(g.flow).toBe('dashes');
    }
  });

  it('opens with the rail on the left and closes with actions on the right', () => {
    const scene = shapesOf(els, 'square').find((s) => s.fillColor === '#f0f9ff')!;
    const mood = shapesOf(els, 'temperature')[0]!;
    const actions = panelOf(els, 'Action items');
    expect(mood.x + mood.width).toBeLessThan(scene.x);
    expect(actions.x).toBeGreaterThan(scene.x + scene.width);
    expect(inside(shapesOf(els, 'progress-bar')[0]!, actions)).toBe(true);
  });
});
