// The Family tree template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): three generations of the
// Okafor and Lindqvist families, meeting in the middle generation.
//
// Each generation is a tinted band named in a left rail. Every person is a card (docs/specs/009-elements/card.md)
// with an Initial monogram in their family line's hue, their name, their years and where they were born; someone who
// has died is a muted card with a dashed edge. A couple are joined through a small union dot between them, captioned
// with how and when (a dashed line for partners who did not marry); their children hang from that dot on the shared
// tree rake, an adopted child's line dashed. Beside the tree: a legend, how to add someone, and family stories pinned
// to the people they are about.
//
// Layers: "Generations" holds the bands, rail and legend; "People" the cards, lines, unions and notes.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Element,
  type ShapeElement,
} from '@liveplanner/document';
import { rake } from './template-rake';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';
import { CONTENT, INK, MUTED, PAPER, SCAFFOLD } from './template-report-kit';

const TITLE = 'The Okafor–Lindqvist family tree';
const CAPTION =
  'Three generations, two families meeting in the middle. Couples join through the dot between them; children hang from it.';

const RAIL_W = 190;
const CARD_W = 236;
const CARD_H = 100;
const BAND_H = 150;
const BAND_GAP = 70;
const UNION = 14;
const SIDE_GAP = 70;
const SIDE_W = 380;

// Family lines, by surname: the monogram's hue.
const LINE_HUE = {
  okafor: '#ea580c',
  lindqvist: '#0284c7',
  reyes: '#7c3aed',
  berg: '#0d9488',
} as const;
type Line = keyof typeof LINE_HUE;

type Person = {
  id: string;
  name: string;
  years: string;
  born: string;
  line: Line;
  gen: 0 | 1 | 2;
  // Left edge, in px from the tree's left.
  x: number;
  died?: true;
};

const PEOPLE: readonly Person[] = [
  {
    id: 'chidi',
    name: 'Chidi Okafor',
    years: '1946 – 2018',
    born: 'Enugu, Nigeria',
    line: 'okafor',
    gen: 0,
    x: 311,
    died: true,
  },
  {
    id: 'ngozi',
    name: 'Ngozi Okafor',
    years: 'b. 1950 · née Eze',
    born: 'Onitsha, Nigeria',
    line: 'okafor',
    gen: 0,
    x: 637,
  },
  {
    id: 'lars',
    name: 'Lars Lindqvist',
    years: 'b. 1948',
    born: 'Uppsala, Sweden',
    line: 'lindqvist',
    gen: 0,
    x: 933,
  },
  {
    id: 'margit',
    name: 'Margit Lindqvist',
    years: '1951 – 2021',
    born: 'Gothenburg, Sweden',
    line: 'lindqvist',
    gen: 0,
    x: 1259,
    died: true,
  },
  {
    id: 'tom',
    name: 'Tom Reyes',
    years: 'b. 1977',
    born: 'Manila, Philippines',
    line: 'reyes',
    gen: 1,
    x: 0,
  },
  {
    id: 'adaeze',
    name: 'Adaeze Okafor',
    years: 'b. 1978',
    born: 'Leeds, England',
    line: 'okafor',
    gen: 1,
    x: 326,
  },
  {
    id: 'emeka',
    name: 'Emeka Okafor',
    years: 'b. 1974',
    born: 'Lagos, Nigeria',
    line: 'okafor',
    gen: 1,
    x: 622,
  },
  {
    id: 'sofia',
    name: 'Sofia Lindqvist',
    years: 'b. 1976',
    born: 'Uppsala, Sweden',
    line: 'lindqvist',
    gen: 1,
    x: 948,
  },
  {
    id: 'erik',
    name: 'Erik Lindqvist',
    years: 'b. 1979',
    born: 'Uppsala, Sweden',
    line: 'lindqvist',
    gen: 1,
    x: 1244,
  },
  {
    id: 'jonas',
    name: 'Jonas Berg',
    years: 'b. 1980',
    born: 'Bergen, Norway',
    line: 'berg',
    gen: 1,
    x: 1570,
  },
  {
    id: 'maya',
    name: 'Maya Reyes',
    years: 'b. 2010',
    born: 'Leeds, England',
    line: 'reyes',
    gen: 2,
    x: 163,
  },
  {
    id: 'kemi',
    name: 'Kemi Okafor',
    years: 'b. 2004',
    born: 'Leeds, England',
    line: 'okafor',
    gen: 2,
    x: 637,
  },
  {
    id: 'leo',
    name: 'Leo Okafor',
    years: 'b. 2007',
    born: 'Leeds, England',
    line: 'okafor',
    gen: 2,
    x: 933,
  },
  {
    id: 'astrid',
    name: 'Astrid Berg',
    years: 'b. 2015 · adopted 2017',
    born: 'Tallinn, Estonia',
    line: 'berg',
    gen: 2,
    x: 1407,
  },
];

// The couples, left partner first: how they are joined, and their children (adopted ones marked).
const UNIONS: readonly {
  a: string;
  b: string;
  caption: string;
  married: boolean;
  children: readonly (readonly [string, boolean?])[];
}[] = [
  { a: 'chidi', b: 'ngozi', caption: 'm. 1972', married: true, children: [['adaeze'], ['emeka']] },
  { a: 'lars', b: 'margit', caption: 'm. 1974', married: true, children: [['sofia'], ['erik']] },
  { a: 'tom', b: 'adaeze', caption: 'since 2006', married: false, children: [['maya']] },
  { a: 'emeka', b: 'sofia', caption: 'm. 2002', married: true, children: [['kemi'], ['leo']] },
  { a: 'erik', b: 'jonas', caption: 'm. 2014', married: true, children: [['astrid', true]] },
];

const GENERATIONS = [
  { name: 'Grandparents', tint: '#fff7ed' },
  { name: 'Parents', tint: '#f0f9ff' },
  { name: 'Children', tint: '#f0fdf4' },
];

const STORIES: readonly { about: string; text: string; fill: string }[] = [
  {
    about: 'margit',
    text: 'Margit taught the whole family to swim in the lake at Sigtuna.',
    fill: '#bae6fd',
  },
  {
    about: 'jonas',
    text: 'Jonas built the treehouse from a 1970s Norwegian manual, in Norwegian.',
    fill: '#99f6e4',
  },
  { about: 'astrid', text: 'Astrid’s first word in English was “pancake”.', fill: '#bbf7d0' },
];

export function buildFamilyTree(cx: number, cy: number): Element[] {
  const treeW = 1570 + CARD_W; // the right-most card's left edge, and its width
  const width = RAIL_W + treeW + SIDE_GAP + SIDE_W;
  const bandsH = 3 * BAND_H + 2 * BAND_GAP;
  const height = TECH_HEADER_H + 28 + bandsH;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const treeX = x0 + RAIL_W;
  const bandY = (g: number) => y0 + TECH_HEADER_H + 28 + g * (BAND_H + BAND_GAP);

  const out: Element[] = [
    ...techHeader(x0, y0, width, TITLE, CAPTION, {
      title: CONTENT.layerId,
      caption: SCAFFOLD.layerId,
    }),
    ...GENERATIONS.flatMap((g, i): Element[] => [
      {
        ...createShape('square', x0, bandY(i)),
        width: RAIL_W + treeW + 20,
        height: BAND_H,
        label: '',
        fillColor: g.tint,
        strokeColor: g.tint,
        borderRadius: 'md',
        themeLockFill: true,
        ...SCAFFOLD,
      },
      {
        ...createText(x0 + 20, bandY(i) + BAND_H / 2 - 16),
        width: RAIL_W - 30,
        height: 32,
        label: g.name,
        textSize: 'md',
        textBold: true,
        textColor: INK,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
    ]),
  ];
  const cards = new Map<string, ShapeElement>();
  for (const p of PEOPLE) {
    const card = person(p, treeX + p.x, bandY(p.gen) + (BAND_H - CARD_H) / 2);
    cards.set(p.id, card);
    out.push(card);
  }
  for (const u of UNIONS) out.push(...union(u, cards));
  out.push(...side(x0 + RAIL_W + treeW + SIDE_GAP, bandY(0), cards));
  return out;
}

function person(p: Person, x: number, y: number): ShapeElement {
  return {
    ...createShape('card', x, y),
    width: CARD_W,
    height: CARD_H,
    cardMedia: 'initial',
    pageTitle: p.name,
    pageSubtitle: p.years,
    label: p.born,
    textSize: 'sm',
    textColor: p.died ? '#475569' : INK,
    fillColor: p.died ? '#f1f5f9' : PAPER,
    strokeColor: LINE_HUE[p.line],
    strokeWidth: 'medium',
    ...(p.died ? { strokeStyle: 'dashed' as const } : {}),
    themeLockFill: true,
    ...CONTENT,
  };
}

const LINK = { arrowEnds: 'none', strokeColor: '#64748b', strokeWidth: 2 } as const;

// A couple: a union dot between them, a line from each, its caption under it, and a line to each child.
function union(u: (typeof UNIONS)[number], cards: Map<string, ShapeElement>): Element[] {
  const a = cards.get(u.a)!;
  const b = cards.get(u.b)!;
  const dotX = (a.x + a.width + b.x) / 2;
  const dotY = a.y + a.height / 2;
  const dot: ShapeElement = {
    ...createShape('circle', Math.round(dotX - UNION / 2), Math.round(dotY - UNION / 2)),
    width: UNION,
    height: UNION,
    label: '',
    fillColor: '#64748b',
    strokeColor: '#64748b',
    themeLockFill: true,
    ...CONTENT,
  };
  const style = u.married ? {} : { strokeStyle: 'dashed' as const };
  const out: Element[] = [
    dot,
    {
      ...createPinnedArrow(a.id, 'e', dot.id, 'w'),
      ...LINK,
      strokeWidth: 3,
      ...style,
      exactStart: true,
      exactEnd: true,
      ...CONTENT,
    },
    {
      ...createPinnedArrow(b.id, 'w', dot.id, 'e'),
      ...LINK,
      strokeWidth: 3,
      ...style,
      exactStart: true,
      exactEnd: true,
      ...CONTENT,
    },
    {
      ...createText(Math.round(dotX - 50), Math.round(dotY - 36)),
      width: 100,
      height: 22,
      label: u.caption,
      textSize: 'sm',
      textColor: MUTED,
      ...CONTENT,
    },
  ];
  for (const [id, adopted] of u.children) {
    const c = cards.get(id)!;
    out.push({
      ...createPinnedArrow(dot.id, 's', c.id, 'n'),
      ...LINK,
      arrowStyle: 'angled',
      ...(adopted ? { strokeStyle: 'dashed' as const } : {}),
      curvePoints: rake({ x: dotX, y: dotY + UNION / 2 }, { x: c.x + c.width / 2, y: c.y }),
      exactStart: true,
      ...CONTENT,
    });
  }
  return out;
}

// Beside the tree: the key, how to add someone, and family stories pinned to their people.
function side(x: number, y: number, cards: Map<string, ShapeElement>): Element[] {
  const out: Element[] = [
    {
      ...createText(x, y),
      width: SIDE_W,
      height: 30,
      label: 'Key',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
  ];
  const rows: { label: string; dashed?: true; thick?: true; muted?: true }[] = [
    { label: 'Married', thick: true },
    { label: 'Partners', thick: true, dashed: true },
    { label: 'Child' },
    { label: 'Adopted', dashed: true },
  ];
  rows.forEach((r, i) => {
    const ry = y + 44 + i * 34;
    out.push(
      {
        ...createArrow(x, ry + 12, x + 80, ry + 12),
        ...LINK,
        strokeWidth: r.thick ? 3 : 2,
        ...(r.dashed ? { strokeStyle: 'dashed' as const } : {}),
        ...SCAFFOLD,
      },
      {
        ...createText(x + 100, ry),
        width: SIDE_W - 100,
        height: 24,
        label: r.label,
        textSize: 'sm',
        textAlignX: 'left',
        ...SCAFFOLD,
      },
    );
  });
  const mutedY = y + 44 + rows.length * 34 + 4;
  out.push(
    {
      ...createShape('square', x, mutedY),
      width: 80,
      height: 30,
      label: '',
      fillColor: '#f1f5f9',
      strokeColor: '#94a3b8',
      strokeStyle: 'dashed',
      borderRadius: 'md',
      themeLockFill: true,
      ...SCAFFOLD,
    },
    {
      ...createText(x + 100, mutedY + 3),
      width: SIDE_W - 100,
      height: 24,
      label: 'Has died',
      textSize: 'sm',
      textAlignX: 'left',
      ...SCAFFOLD,
    },
  );
  const howY = mutedY + 56;
  out.push({
    ...createShape('square', x, howY),
    width: SIDE_W,
    height: 104,
    label:
      'To add someone, duplicate a card (Shift + drag) and retype it, then draw a line from their parents’ dot, or from their partner to a new dot.',
    textSize: 'sm',
    textColor: INK,
    textAlignX: 'left',
    fillColor: '#f8fafc',
    strokeColor: '#cbd5e1',
    borderRadius: 'md',
    themeLockFill: true,
    ...CONTENT,
  });
  let sy = howY + 128;
  out.push({
    ...createText(x, sy),
    width: SIDE_W,
    height: 30,
    label: 'Family stories',
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    ...SCAFFOLD,
  });
  sy += 40;
  STORIES.forEach((s, i) => {
    const note = {
      ...createSticky(x + (i % 2) * 14, sy),
      width: SIDE_W - 14,
      height: 96,
      label: s.text,
      textSize: 'sm' as const,
      fillColor: s.fill,
      textColor: INK,
      rotation: i % 2 === 0 ? -1.5 : 1.5,
      ...CONTENT,
    };
    out.push(note, {
      ...createPinnedArrow(note.id, 'w', cards.get(s.about)!.id, 'e'),
      arrowStyle: 'curved',
      strokeColor: '#94a3b8',
      strokeWidth: 1.5,
      strokeStyle: 'dotted',
      arrowheadShape: 'circle',
      ...CONTENT,
    });
    sy += 112;
  });
  return out;
}
