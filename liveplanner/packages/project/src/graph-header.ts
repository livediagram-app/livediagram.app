// A graph's title, caption and key (docs/specs/015-api/mcp-server.md §4.7 "The graph look"), as every template
// has them: a bold heading and a muted caption above the drawing, left aligned, and on request a key beside it
// naming what each shape kind the graph uses means, drawn in the diagram's own tones.

import { unionRects } from './geometry-primitives';
import { glyphWidth } from './graph-authoring';
import { TONE_PRESET } from './graph-look';
import { isBoxed, type BoxedElement, type Element, type ShapeElement } from './index';

// The template's muted caption grey (template-builders-flowchart.ts MUTED).
export const GRAPH_MUTED = '#64748b';
// Header geometry, the flowchart template's: title band, caption line, the gap down to the drawing.
const TITLE_H = 44;
const CAPTION_LINE_H = 22;
const HEADER_GAP = 32;
// The narrowest the header runs, so a tall thin flowchart's caption doesn't wrap word by word.
const HEADER_MIN_W = 560;
// The key card (the template's), and how far it sits right of the drawing.
const KEY_W = 250;
const KEY_GAP = 72;
const KEY_PAD = 20;
const KEY_ROW_H = 52;
const KEY_ICON_W = 56;

// What each shape kind means in a key, in the order a key lists them, with its miniature's height: a flowchart's
// ISO 5807 meanings, and the plainer ones a diagram of systems reads by. A graph's own `key` names override either.
const KEY_MEANING: readonly (readonly [string, string, number])[] = [
  ['stadium', 'Start or end', 24],
  ['square', 'Step', 30],
  ['diamond', 'Decision', 34],
  ['parallelogram', 'Input or output', 28],
  ['document', 'Document', 32],
  ['cylinder', 'Data store', 36],
  ['hexagon', 'Preparation', 30],
  ['circle', 'Connector', 30],
  ['cloud', 'External system', 32],
  ['actor', 'Person', 40],
];
const SYSTEM_MEANING: Readonly<Record<string, string>> = {
  stadium: 'Entry point',
  square: 'Component',
  hexagon: 'Hub or bus',
  circle: 'Node',
};

// A key: every shape's meaning as given, else the defaults (flowchart or system).
export type GraphKey = boolean | Readonly<Record<string, string>>;

let nextId = 0;
const idOf = (makeId: (() => string) | undefined, base: string) =>
  makeId ? makeId() : `${base}-${(nextId++).toString(36)}`;

// The title and caption above the drawing, and the key beside it when asked. `elements` are laid out; the header
// sits above their top-left corner, so nothing moves.
export function withHeaderAndKey(
  elements: Element[],
  opts: {
    title?: string;
    subtitle?: string;
    key?: GraphKey;
    // Whether the drawing is a flowchart, which picks the default meanings.
    flowchart?: boolean;
    makeId?: () => string;
  },
): Element[] {
  const boxes = elements.filter(isBoxed);
  const block = unionRects(boxes);
  if (!block) return elements;
  const added: Element[] = [];
  const title = opts.title?.trim();
  const subtitle = opts.subtitle?.trim();
  if (opts.key) {
    const given = typeof opts.key === 'object' ? opts.key : {};
    const meaning = (kind: string, fallback: string) =>
      given[kind]?.trim() || (opts.flowchart ? fallback : (SYSTEM_MEANING[kind] ?? fallback));
    added.push(...keyCard(boxes, block, meaning, opts.makeId));
  }
  const right = Math.max(block.x + block.width, ...added.filter(isBoxed).map((b) => b.x + b.width));
  const width = Math.max(HEADER_MIN_W, right - block.x);
  if (title || subtitle) {
    const captionLines = subtitle ? Math.max(1, Math.ceil(glyphWidth(subtitle, 14) / width)) : 0;
    const captionH = captionLines * CAPTION_LINE_H + (captionLines ? 6 : 0);
    const top = block.y - HEADER_GAP - captionH - (title ? TITLE_H : 0);
    if (title)
      added.push({
        id: idOf(opts.makeId, 'title'),
        type: 'text',
        x: block.x,
        y: top,
        width,
        height: TITLE_H,
        label: title,
        textSize: 'lg',
        textBold: true,
        textAlignX: 'left',
      });
    if (subtitle)
      added.push({
        id: idOf(opts.makeId, 'caption'),
        type: 'text',
        x: block.x,
        y: top + (title ? TITLE_H : 0),
        width,
        height: captionH,
        label: subtitle,
        textSize: 'sm',
        textColor: GRAPH_MUTED,
        textAlignX: 'left',
        textAlignY: 'top',
      });
  }
  return [...added, ...elements];
}

// The key: a frame level with the drawing's top, one row per shape kind the drawing uses, each a miniature
// in the tone the drawing gives that kind most.
function keyCard(
  boxes: BoxedElement[],
  block: { x: number; y: number; width: number },
  meaning: (kind: string, fallback: string) => string,
  makeId?: () => string,
): Element[] {
  const shapes = boxes.filter(
    (b): b is ShapeElement => b.type === 'shape' && b.shape !== 'frame' && b.shape !== 'lane',
  );
  const rows = KEY_MEANING.filter(([kind]) => shapes.some((s) => s.shape === kind));
  // The muted tone is a meaning of its own where it marks some boxes and not others: a row for it, in the shape most
  // of the muted wear (a dashed error step had no row saying what dashed meant).
  // Only where a kind's row shows its ordinary look: a kind all muted already shows the muted look in its own row.
  const muted = shapes.filter(
    (s) =>
      s.colorPreset === TONE_PRESET.muted &&
      shapes.some((o) => o.shape === s.shape && o.colorPreset !== TONE_PRESET.muted),
  );
  const mutedKind =
    muted.length > 0
      ? ([...KEY_MEANING]
          .map((row) => ({ row, n: muted.filter((s) => s.shape === row[0]).length }))
          .filter(({ n }) => n > 0)
          .sort((a, b) => b.n - a.n)[0]?.row ?? null)
      : null;
  if (rows.length + (mutedKind ? 1 : 0) < 2) return [];
  const x = block.x + block.width + KEY_GAP;
  const top = block.y;
  const height = KEY_PAD + 40 + (rows.length + (mutedKind ? 1 : 0)) * KEY_ROW_H + KEY_PAD - 12;
  // A frame titled "Key", so the key moves as one (a frame carries its members), in the editor or by an edit.
  const out: Element[] = [
    {
      id: idOf(makeId, 'key'),
      type: 'shape',
      shape: 'frame',
      x,
      y: top,
      width: KEY_W,
      height,
      label: 'Key',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'top',
      padding: 'lg',
    },
  ];
  rows.forEach(([kind, fallback, iconH], i) => {
    const y = top + KEY_PAD + 40 + i * KEY_ROW_H;
    const sample = mostCommonPreset(shapes.filter((s) => s.shape === kind));
    out.push(
      {
        id: idOf(makeId, `key-${kind}`),
        type: 'shape',
        shape: kind as ShapeElement['shape'],
        x: x + KEY_PAD,
        y: y + (36 - iconH) / 2,
        width: KEY_ICON_W,
        height: iconH,
        label: '',
        ...(sample ? { colorPreset: sample } : {}),
      },
      {
        id: idOf(makeId, `key-${kind}-label`),
        type: 'text',
        x: x + KEY_PAD + KEY_ICON_W + 14,
        y: y + 4,
        width: KEY_W - KEY_PAD * 2 - KEY_ICON_W - 14,
        height: 28,
        label: meaning(kind, fallback),
        textSize: 'sm',
        textColor: GRAPH_MUTED,
        textAlignX: 'left',
      },
    );
  });
  if (mutedKind) {
    const [kind, , iconH] = mutedKind;
    const y = top + KEY_PAD + 40 + rows.length * KEY_ROW_H;
    out.push(
      {
        id: idOf(makeId, 'key-muted'),
        type: 'shape',
        shape: kind as ShapeElement['shape'],
        x: x + KEY_PAD,
        y: y + (36 - iconH) / 2,
        width: KEY_ICON_W,
        height: iconH,
        label: '',
        colorPreset: TONE_PRESET.muted,
      },
      {
        id: idOf(makeId, 'key-muted-label'),
        type: 'text',
        x: x + KEY_PAD + KEY_ICON_W + 14,
        y: y + 4,
        width: KEY_W - KEY_PAD * 2 - KEY_ICON_W - 14,
        height: 28,
        label: meaning('muted', KEY_MUTED_MEANING),
        textSize: 'sm',
        textColor: GRAPH_MUTED,
        textAlignX: 'left',
      },
    );
  }
  return out;
}

// What the muted tone means by default (its tone description: an exception or an optional step).
const KEY_MUTED_MEANING = 'Exception or optional';

// The preset most of these shapes wear, or undefined when most wear none.
function mostCommonPreset(shapes: ShapeElement[]): string | undefined {
  // A muted node is the exception, drawn quiet and dashed: the key shows a kind's ordinary look unless every one of
  // its kind is muted.
  const ordinary = shapes.filter((s) => s.colorPreset !== TONE_PRESET.muted);
  const counts = new Map<string, number>();
  for (const s of ordinary.length ? ordinary : shapes)
    counts.set(s.colorPreset ?? '', (counts.get(s.colorPreset ?? '') ?? 0) + 1);
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [''];
  return best || undefined;
}
