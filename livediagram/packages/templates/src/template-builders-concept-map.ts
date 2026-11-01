// The concept map (docs/specs/008-canvas/canvas-and-palette.md "Templates", the use-case batch): how plants make
// their food, as a Novak concept map. Concepts are boxes in rows, the most general at the top; every link is a pinned
// arrow labelled with its linking words, so each reads as a sentence ("Photosynthesis needs sunlight"); two dashed
// cross-links join branches, and a key names the two kinds of line. Beside the map, three propositions spelled out
// and a sticky that asks the reader to add a concept of their own.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  diagramKeyHeight,
  keyRowsOf,
  type Anchor,
  type Element,
} from '@livediagram/document';
import { TECH_HEADER_H, techHeader } from './template-builders-technical-kit';

const INK = '#0f172a';

// What a concept is, by its colour: the topic and the process solid green, what the process needs blue, what it
// produces amber, and the parts and uses they lead to plain.
type Tone = 'topic' | 'need' | 'product' | 'plain';
const TONES: Record<Tone, { fill: string; stroke: string; ink: string; lock?: boolean }> = {
  topic: { fill: '#15803d', stroke: '#14532d', ink: '#ffffff', lock: true },
  need: { fill: '#e0f2fe', stroke: '#38bdf8', ink: '#0c4a6e' },
  product: { fill: '#fef3c7', stroke: '#f59e0b', ink: '#78350f' },
  plain: { fill: '#ffffff', stroke: '#94a3b8', ink: INK },
};

type Concept = { id: string; label: string; col: number; row: number; tone: Tone; wide?: boolean };

// Columns are centre offsets from the map's middle; rows run down the page.
const COLS = [-560, -300, -40, 260, 520];
const MIDDLE = -20;
const CONCEPTS: readonly Concept[] = [
  { id: 'plants', label: 'Plants', col: MIDDLE, row: 0, tone: 'topic', wide: true },
  { id: 'photo', label: 'Photosynthesis', col: MIDDLE, row: 1, tone: 'topic', wide: true },
  { id: 'water', label: 'Water', col: COLS[0]!, row: 2, tone: 'need' },
  { id: 'co2', label: 'Carbon dioxide', col: COLS[1]!, row: 2, tone: 'need' },
  { id: 'sun', label: 'Sunlight', col: COLS[2]!, row: 2, tone: 'need' },
  { id: 'glucose', label: 'Glucose', col: COLS[3]!, row: 2, tone: 'product' },
  { id: 'oxygen', label: 'Oxygen', col: COLS[4]!, row: 2, tone: 'product' },
  { id: 'roots', label: 'Roots', col: COLS[0]!, row: 3, tone: 'plain' },
  { id: 'leaves', label: 'Leaves', col: COLS[1]!, row: 3, tone: 'plain' },
  { id: 'chlorophyll', label: 'Chlorophyll', col: COLS[2]!, row: 3, tone: 'plain' },
  { id: 'growth', label: 'Growth and energy', col: COLS[3]!, row: 3, tone: 'plain' },
  { id: 'animals', label: 'Animals and people', col: COLS[4]!, row: 3, tone: 'plain' },
];

// Every link: from, to, the linking words, and whether it is a cross-link between branches.
type Link = { from: string; to: string; words: string; cross?: true; anchors?: [Anchor, Anchor] };
const LINKS: readonly Link[] = [
  { from: 'plants', to: 'photo', words: 'make food by' },
  { from: 'photo', to: 'water', words: 'needs' },
  { from: 'photo', to: 'co2', words: 'needs' },
  { from: 'photo', to: 'sun', words: 'needs' },
  { from: 'photo', to: 'glucose', words: 'produces' },
  { from: 'photo', to: 'oxygen', words: 'produces' },
  { from: 'water', to: 'roots', words: 'is taken in by' },
  { from: 'co2', to: 'leaves', words: 'enters through' },
  { from: 'sun', to: 'chlorophyll', words: 'is captured by' },
  { from: 'glucose', to: 'growth', words: 'is used for' },
  { from: 'oxygen', to: 'animals', words: 'is breathed by' },
  { from: 'leaves', to: 'chlorophyll', words: 'contain', cross: true, anchors: ['e', 'w'] },
  { from: 'water', to: 'leaves', words: 'travels up to', cross: true, anchors: ['se', 'nw'] },
];

const PROPOSITIONS = [
  'Plants make food by photosynthesis.',
  'Photosynthesis needs sunlight.',
  'Leaves contain chlorophyll.',
];

export function buildConceptMap(cx: number, cy: number): Element[] {
  const boxW = 200;
  const boxH = 64;
  const wideW = 300;
  const wideH = 72;
  const rowPitch = 200;
  const mapLeft = COLS[0]! - boxW / 2;
  const mapRight = COLS[4]! + boxW / 2;
  const mapW = mapRight - mapLeft;
  const sideGap = 64;
  const sideW = 320;
  const questionH = 56;
  const questionGap = 40;
  const mapH = 3 * rowPitch + boxH;
  const totalW = mapW + sideGap + sideW;
  const totalH = TECH_HEADER_H + 24 + questionH + questionGap + mapH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const mapTop = y0 + TECH_HEADER_H + 24 + questionH + questionGap;
  // The map's middle, the origin the column offsets are measured from.
  const midX = x0 - mapLeft;

  const elements: Element[] = [
    ...techHeader(
      x0,
      y0,
      totalW,
      'Photosynthesis · concept map',
      'Read every arrow as a sentence: a concept, the linking words, then the next concept. Add a concept, then link it to two others.',
    ),
    {
      ...createShape('square', x0, y0 + TECH_HEADER_H + 24),
      width: mapW,
      height: questionH,
      label: 'Focus question: how do plants make their food?',
      textSize: 'md',
      textBold: true,
      textColor: '#14532d',
      fillColor: '#f0fdf4',
      strokeColor: '#86efac',
    },
  ];

  const nodes = new Map<string, Element>();
  for (const c of CONCEPTS) {
    const tone = TONES[c.tone];
    const w = c.wide ? wideW : boxW;
    const h = c.wide ? wideH : boxH;
    const node: Element = {
      ...createShape('square', midX + c.col - w / 2, mapTop + c.row * rowPitch + (boxH - h) / 2),
      width: w,
      height: h,
      label: c.label,
      textSize: c.wide ? 'lg' : 'md',
      textBold: c.tone === 'topic',
      fillColor: tone.fill,
      strokeColor: tone.stroke,
      textColor: tone.ink,
      ...(tone.lock ? { themeLockFill: true } : {}),
    };
    nodes.set(c.id, node);
    elements.push(node);
  }

  const arrows: Element[] = LINKS.map((link) => {
    const [fromA, toA] = link.anchors ?? ['s', 'n'];
    return {
      ...createPinnedArrow(nodes.get(link.from)!.id, fromA, nodes.get(link.to)!.id, toA),
      label: link.words,
      // The linking words are half of every sentence, so they read a size up from a plain arrow label.
      textSize: 'md',
      textColor: link.cross ? '#7c3aed' : '#334155',
      ...(link.cross ? { strokeStyle: 'dashed' as const, strokeColor: '#8b5cf6' } : {}),
    };
  });
  elements.push(...arrows);

  // The side column: the propositions read out, one strip each, the reader's turn, then the key.
  const sideX = x0 + mapW + sideGap;
  const stripH = 48;
  const stripGap = 12;
  const readH = PROPOSITIONS.length * (stripH + stripGap) - stripGap;
  const turnY = mapTop + readH + 32;
  const turnH = 150;
  const keyRows = keyRowsOf(arrows);
  elements.push(
    {
      ...createText(sideX, mapTop - 44),
      width: sideW,
      height: 36,
      label: 'Read it as sentences',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
    },
    ...PROPOSITIONS.map((sentence, i): Element => ({
      ...createShape('square', sideX, mapTop + i * (stripH + stripGap)),
      width: sideW,
      height: stripH,
      label: sentence,
      textSize: 'sm',
      textColor: '#14532d',
      fillColor: '#f0fdf4',
      strokeColor: '#86efac',
    })),
    {
      ...createSticky(sideX, turnY),
      width: sideW,
      height: turnH,
      label: 'Your turn: where would Stomata go? Add the concept, then link it to two others.',
      textSize: 'md',
      fillColor: '#fde68a',
      textColor: '#451a03',
    },
    {
      ...createShape('diagram-key', sideX, turnY + turnH + 32),
      width: sideW,
      height: diagramKeyHeight(keyRows.length),
      keyRows,
      keyMeanings: {
        'line:solid': 'Link: read it as a sentence',
        'line:dashed': 'Cross-link: joins two branches',
      },
    },
  );
  return elements;
}
