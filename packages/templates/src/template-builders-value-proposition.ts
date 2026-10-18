// The Value Proposition Canvas template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Osterwalder's
// fit between what FreshBox (the Business Model Canvas's meal-kit business) offers and what one of its segments,
// busy professionals cooking for two, needs.
//
// On the left the Value Map: a square of three sections (Products & Services the left half, Gain Creators top right,
// Pain Relievers bottom right). On the right the Customer Profile: a circle split by two chords into Gains (top
// left), Pains (bottom left) and Customer Jobs (the right third). Each section has its glyph, name and prompt, and
// sticky notes in its own hue; the profile's are ranked most important first. Dashed fit lines run from each
// reliever or creator to the pain or gain it answers. A left rail runs it as a session: the three steps, a timer, a
// dot vote and a fit rating (so it opens in Facilitate, templates-by-mode.md).
//
// Layers: "Canvas" holds the square, circle, chords, section headings and rail labels; "Notes" the stickies, fit
// lines, ranks, the title and the session tools.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  runsPlainText,
  type Element,
  type StickyElement,
  type TextRun,
} from '@livediagram/document';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';
import { CONTENT, INK, PAPER, SCAFFOLD } from './template-report-kit';

const TITLE = 'FreshBox meal kits · Value Proposition Canvas';
const CAPTION =
  'Profile the customer on the right first, then map what you offer on the left. A fit line joins each pain reliever and gain creator to what it answers.';
const SEGMENT = 'Customer Profile: busy professionals cooking for two';

const RAIL_W = 300;
const RAIL_GAP = 64;
const SIDE = 820; // the square's side and the circle's diameter
const MID_GAP = 220;
const TOP = 56; // the two titles over the shapes
const NOTE_W = 170;
const NOTE_H = 100;

const HUE = {
  products: { note: '#c7d2fe', deep: '#3730a3', tint: '#eef2ff' },
  gains: { note: '#bbf7d0', deep: '#166534', tint: '#f0fdf4' },
  pains: { note: '#fecdd3', deep: '#9f1239', tint: '#fff1f2' },
  jobs: { note: '#fde68a', deep: '#92400e', tint: '#fffbeb' },
} as const;

const PRODUCTS = [
  'Weekly box: 3 dinners for two, £39',
  'App with one-tap swaps',
  'Chef chat, 7 days a week',
  'Gift boxes and add-ons',
];
const RELIEVERS = [
  'A menu chosen for you each week',
  'Portioned to the gram: nothing goes off',
  'Every ingredient is in the box',
];
const CREATORS = [
  '20-minute recipes, one pan',
  'A new cuisine every week',
  'Cost and calories shown per portion',
];
const JOBS = [
  'Get a healthy dinner on the table on a weeknight',
  'Skip the weekly supermarket run',
  'Cook something new together',
  'Feel on top of the week',
];
// Ranked most important first, two by two (row by row), so ranks 1 and 3 sit in the column nearest the Value Map.
const PAINS = [
  'No time to plan meals',
  'Takeaway guilt: the cost and the salt',
  'Food goes off in the fridge',
  'Recipes need things we never have',
];
const GAINS = [
  'On the table in under 30 minutes',
  'Something to look forward to midweek',
  'Learn a dish we can make again',
  'Less waste, less spend',
];
// The fit drawn in so far: [reliever, pain] and [creator, gain], by index, each to a note in the near column so no
// line crosses another note. The third reliever is left for the team to join up.
const RELIEVES: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 2],
];
const CREATES: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 2],
];

export function buildValuePropositionCanvas(cx: number, cy: number): Element[] {
  const width = RAIL_W + RAIL_GAP + SIDE + MID_GAP + SIDE;
  const height = TECH_HEADER_H + 24 + TOP + SIDE;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const top = y0 + TECH_HEADER_H + 24;
  const sqX = x0 + RAIL_W + RAIL_GAP;
  const shapesY = top + TOP;
  const ciX = sqX + SIDE + MID_GAP;

  const out: Element[] = [
    ...techHeader(x0, y0, width, TITLE, CAPTION, {
      title: CONTENT.layerId,
      caption: SCAFFOLD.layerId,
    }),
    title(sqX, top, 'Value Map'),
    title(ciX, top, SEGMENT),
  ];
  const vm = valueMap(sqX, shapesY);
  const cp = profile(ciX, shapesY);
  out.push(...vm.elements, ...cp.elements);
  for (const [r, p] of RELIEVES) out.push(fit(vm.relievers[r]!, cp.pains[p]!, HUE.pains.deep));
  for (const [c, g] of CREATES) out.push(fit(vm.creators[c]!, cp.gains[g]!, HUE.gains.deep));
  out.push(...rail(x0, top));
  return out;
}

function title(x: number, y: number, label: string): Element {
  return {
    ...createText(x, y),
    width: SIDE,
    height: 40,
    label,
    textSize: 'md',
    textBold: true,
    ...SCAFFOLD,
  };
}

// A section's heading: glyph, bold name and its prompt under it, inked for the section's own paper.
function heading(
  x: number,
  y: number,
  w: number,
  iconId: string,
  name: string,
  prompt: string,
  deep: string,
): Element[] {
  return [
    {
      ...createShape('icon', x, y + 2),
      width: 26,
      height: 26,
      iconId,
      strokeColor: deep,
      ...SCAFFOLD,
    },
    {
      ...createText(x + 34, y),
      width: w - 34,
      height: 30,
      label: name,
      textSize: 'md',
      textBold: true,
      textColor: deep,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createText(x, y + 30),
      width: w,
      height: 24,
      label: prompt,
      textSize: 'sm',
      textColor: '#475569',
      textAlignX: 'left',
      ...SCAFFOLD,
    },
  ];
}

function note(
  x: number,
  y: number,
  text: string,
  fill: string,
  w = NOTE_W,
  h = NOTE_H,
): StickyElement {
  return {
    ...createSticky(Math.round(x), Math.round(y)),
    width: w,
    height: h,
    label: text,
    textSize: 'sm',
    fillColor: fill,
    textColor: INK,
    ...CONTENT,
  };
}

// The square: Products & Services the left half; Gain Creators over Pain Relievers on the right.
function valueMap(x: number, y: number) {
  const half = SIDE / 2;
  const section = (sx: number, sy: number, w: number, h: number, tint: string) => ({
    ...createShape('square', sx, sy),
    width: w,
    height: h,
    label: '',
    fillColor: tint,
    // Slate rather than ink, so the square's edge shows on a dark canvas too.
    strokeColor: '#475569',
    strokeWidth: 'thick' as const,
    themeLockFill: true,
    ...SCAFFOLD,
  });
  const elements: Element[] = [
    section(x, y, half, SIDE, HUE.products.tint),
    section(x + half, y, half, half, HUE.gains.tint),
    section(x + half, y + half, half, half, HUE.pains.tint),
    ...heading(
      x + 22,
      y + 20,
      half - 44,
      'package',
      'Products & Services',
      'What do we offer them?',
      HUE.products.deep,
    ),
    ...heading(
      x + half + 22,
      y + 20,
      half - 44,
      'trending-up',
      'Gain Creators',
      'How do we create their gains?',
      HUE.gains.deep,
    ),
    ...heading(
      x + half + 22,
      y + half + 20,
      half - 44,
      'shield',
      'Pain Relievers',
      'How do we relieve their pains?',
      HUE.pains.deep,
    ),
  ];
  const products = PRODUCTS.map((t, i) =>
    note(x + (half - 220) / 2, y + 110 + i * (NOTE_H + 24), t, HUE.products.note, 220),
  );
  // Two across, then one, under each right-hand heading.
  const at = (i: number, top: number) => ({
    x: x + half + 22 + (i % 2) * (NOTE_W + 26),
    y: top + 96 + Math.floor(i / 2) * (NOTE_H + 18),
  });
  const creators = CREATORS.map((t, i) => {
    const p = at(i, y);
    return note(p.x, p.y, t, HUE.gains.note);
  });
  const relievers = RELIEVERS.map((t, i) => {
    const p = at(i, y + half);
    return note(p.x, p.y, t, HUE.pains.note);
  });
  elements.push(...products, ...creators, ...relievers);
  return { elements, creators, relievers };
}

// The circle: two chords make Gains (top left), Pains (bottom left) and Customer Jobs (the right third).
function profile(x: number, y: number) {
  const r = SIDE / 2;
  const chordX = x + 560; // the jobs' chord, 150 right of centre
  const half = Math.sqrt(r * r - (chordX - x - r) ** 2);
  const elements: Element[] = [
    {
      ...createShape('circle', x, y),
      width: SIDE,
      height: SIDE,
      label: '',
      fillColor: PAPER,
      strokeColor: '#475569',
      strokeWidth: 'thick',
      themeLockFill: true,
      ...SCAFFOLD,
    },
    {
      ...createArrow(chordX, y + r - half, chordX, y + r + half),
      arrowEnds: 'none',
      strokeColor: '#475569',
      strokeWidth: 3,
      ...SCAFFOLD,
    },
    {
      ...createArrow(x, y + r, chordX, y + r),
      arrowEnds: 'none',
      strokeColor: '#475569',
      strokeWidth: 3,
      ...SCAFFOLD,
    },
    ...heading(x + 190, y + 86, 300, 'star', 'Gains', 'What would delight them?', HUE.gains.deep),
    ...heading(
      x + 190,
      y + SIDE - 140,
      300,
      'alert-triangle',
      'Pains',
      'What annoys or worries them?',
      HUE.pains.deep,
    ),
    ...heading(chordX + 18, y + 140, 150, 'target', 'Jobs', 'What they need done', HUE.jobs.deep),
  ];
  // Gains and Pains two by two either side of the horizontal chord; the Jobs stacked in the right third.
  const grid = (i: number, top: number) => ({
    x: x + 110 + (i % 2) * (NOTE_W + 20),
    y: top + Math.floor(i / 2) * (NOTE_H + 15),
  });
  const gains = GAINS.map((t, i) => {
    const p = grid(i, y + 178);
    return note(p.x, p.y, t, HUE.gains.note);
  });
  const pains = PAINS.map((t, i) => {
    const p = grid(i, y + r + 20);
    return note(p.x, p.y, t, HUE.pains.note);
  });
  const jobs = JOBS.map((t, i) =>
    note(chordX + 16, y + 200 + i * (NOTE_H + 12), t, HUE.jobs.note, NOTE_W, NOTE_H),
  );
  elements.push(...gains, ...pains, ...jobs);
  // Ranks on the profile's notes: most important first.
  for (const group of [gains, pains, jobs])
    group.forEach((n, i) =>
      elements.push({
        ...createShape('step', n.x - 12, n.y - 12),
        width: 26,
        height: 26,
        label: String(i + 1),
        textBold: true,
        chipLook: 'quiet',
        fillColor: PAPER,
        strokeColor: '#94a3b8',
        textColor: INK,
        themeLockFill: true,
        attachedTo: n.id,
        attachAt: 'top-left',
        ...CONTENT,
      }),
    );
  return { elements, gains, pains, jobs };
}

// A fit line: dashed, curving from what the business offers to what it answers, a dot at each end.
function fit(from: StickyElement, to: StickyElement, colour: string): Element {
  return {
    ...createPinnedArrow(from.id, 'e', to.id, 'w'),
    arrowEnds: 'both',
    arrowheadShape: 'circle',
    arrowStyle: 'curved',
    strokeColor: colour,
    strokeWidth: 2.5,
    strokeStyle: 'dashed',
    routeBehind: false,
    ...CONTENT,
  };
}

// The session rail: how it runs, a timer, a vote on the pains and the team's read of the fit.
function rail(x: number, y: number): Element[] {
  const steps: TextRun[] = [
    { text: 'How it runs', bold: true },
    { text: '\n1. Profile the customer: jobs, then pains, then gains', size: 'sm' },
    { text: '\n2. Map the value: products, then relievers and creators', size: 'sm' },
    {
      text: '\n3. Check the fit: a line from each reliever or creator to what it answers',
      size: 'sm',
    },
    { text: '\nOne idea per sticky; rank the most important first.', size: 'sm', color: '#64748b' },
  ];
  let top = y + TOP;
  const out: Element[] = [
    {
      ...createShape('square', x, top),
      width: RAIL_W,
      height: 300,
      label: runsPlainText(steps),
      richText: steps,
      textSize: 'md',
      textColor: INK,
      textAlignX: 'left',
      textAlignY: 'top',
      fillColor: '#f8fafc',
      strokeColor: '#cbd5e1',
      borderRadius: 'md',
      themeLockFill: true,
      ...CONTENT,
    },
  ];
  top += 324;
  const label = (text: string, at: number): Element => ({
    ...createText(x, at),
    width: RAIL_W,
    height: 28,
    label: text,
    textSize: 'sm',
    textBold: true,
    textAlignX: 'left',
    ...SCAFFOLD,
  });
  out.push(
    label('10 minutes a side', top),
    {
      ...createShape('session-button', x, top + 32),
      width: RAIL_W,
      height: 64,
      session: { tool: 'timer', minutes: 10 },
      ...CONTENT,
    },
    label('Which pain matters most?', top + 124),
    {
      ...createShape('session-button', x, top + 156),
      width: RAIL_W,
      height: 64,
      session: { tool: 'vote', dots: 3 },
      ...CONTENT,
    },
    label('How strong is the fit?', top + 248),
    {
      ...createShape('rating', x, top + 280),
      width: 220,
      height: 40,
      rating: 3,
      strokeColor: '#f59e0b',
      ...CONTENT,
    },
  );
  return out;
}
