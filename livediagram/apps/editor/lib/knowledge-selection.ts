// Send to Knowledge Base's capture (docs/specs/013-workspace/send-to-knowledge.md "What it sends"): the selected
// elements as the summary and the fallback read them, in reading order (top to bottom, then left to right), a picked
// frame or lane gathering everything inside it; arrows as links between their ends, an end outside the selection sent
// as null and never named. The platform's reader caps the result (readKnowledgeSendSelection), marking it `cut`.
import {
  KNOWLEDGE_SEND_PICTURE_BYTES_MAX,
  KNOWLEDGE_SEND_PICTURE_SIDE_MAX,
  readKnowledgeSendSelection,
  type KnowledgeSendItem,
  type KnowledgeSendLink,
  type KnowledgeSendPicture,
  type KnowledgeSendSelection,
} from '@liveworkspace/index-client';
import { elementKindLabel, isBoxed, type Element, type Tab } from '@livediagram/document';

// Each picture scale tried in turn until the PNG fits the platform's size (2x first, for a crisp page).
export const KNOWLEDGE_PICTURE_SCALES = [2, 1.5, 1, 0.75, 0.5] as const;

type Box = { x: number; y: number; width: number; height: number };

const isContainer = (el: Element): boolean =>
  el.type === 'shape' && (el.shape === 'frame' || el.shape === 'lane');

const inside = (el: Box, frame: Box): boolean =>
  el.x >= frame.x &&
  el.y >= frame.y &&
  el.x + el.width <= frame.x + frame.width &&
  el.y + el.height <= frame.y + frame.height;

/** The selected elements and everything inside a picked frame or lane, each with the frame it was gathered by. */
export function gatherSelection(
  elements: readonly Element[],
  selected: ReadonlySet<string>,
): { el: Element; in?: string }[] {
  const picked = elements.filter((el) => selected.has(el.id));
  const frames = picked.filter(isContainer).filter(isBoxed);
  const out: { el: Element; in?: string }[] = picked.map((el) => ({ el }));
  const taken = new Set(picked.map((el) => el.id));
  for (const el of elements) {
    if (taken.has(el.id) || !isBoxed(el)) continue;
    const frame = frames.find((f) => inside(el, f));
    if (!frame) continue;
    taken.add(el.id);
    out.push({ el, in: frame.id });
  }
  // An arrow between two gathered elements belongs to the part too.
  for (const el of elements) {
    if (taken.has(el.id) || el.type !== 'arrow') continue;
    const from = el.from.kind === 'pinned' ? el.from.elementId : null;
    const to = el.to.kind === 'pinned' ? el.to.elementId : null;
    if (from && to && taken.has(from) && taken.has(to)) {
      taken.add(el.id);
      out.push({ el });
    }
  }
  return out;
}

const textOf = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// The words an element shows: its label, an image's alt text, a table's cells row by row.
function wordsOf(el: Element): string {
  const label = textOf((el as { label?: unknown }).label);
  if (label) return label;
  if (el.type === 'image') return textOf(el.alt);
  if (el.type === 'table') {
    const cells = (el as { cells?: unknown }).cells;
    if (!Array.isArray(cells)) return '';
    return cells
      .map((row) => (Array.isArray(row) ? row.map(textOf).filter(Boolean).join(' | ') : ''))
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

const topLeft = (el: Element): { x: number; y: number } =>
  isBoxed(el) ? { x: el.x, y: el.y } : { x: 0, y: 0 };

/** The selection as the summary reads it, capped by the platform's reader. */
export function captureKnowledgeSelection(
  elements: readonly Element[],
  selected: ReadonlySet<string>,
): { selection: KnowledgeSendSelection; elementIds: string[]; heading: string } {
  const gathered = gatherSelection(elements, selected);
  const boxes = gathered
    .filter((g) => isBoxed(g.el))
    .sort((a, b) => topLeft(a.el).y - topLeft(b.el).y || topLeft(a.el).x - topLeft(b.el).x);
  const ids = new Set(boxes.map((g) => g.el.id));
  const items: KnowledgeSendItem[] = boxes.map(({ el, in: frame }) => {
    const note = textOf((el as { note?: unknown }).note);
    return {
      id: el.id,
      kind: elementKindLabel(el),
      label: wordsOf(el),
      ...(note ? { note } : {}),
      ...(frame ? { in: frame } : {}),
    };
  });
  const links: KnowledgeSendLink[] = [];
  for (const { el } of gathered) {
    if (el.type !== 'arrow') continue;
    const end = (e: typeof el.from) =>
      e.kind === 'pinned' && ids.has(e.elementId) ? e.elementId : null;
    const label = wordsOf(el);
    links.push({ from: end(el.from), to: end(el.to), ...(label ? { label } : {}) });
  }
  const selection = readKnowledgeSendSelection({ items, links }) ?? { items: [], links: [] };
  const first = boxes[0]?.el;
  const heading =
    boxes.find((g) => isContainer(g.el) && wordsOf(g.el))?.el ??
    boxes.find((g) => wordsOf(g.el))?.el;
  return {
    selection,
    // The boxed elements first (the link back opens at the first), then the arrows.
    elementIds: [
      ...(first ? boxes.map((g) => g.el.id) : []),
      ...gathered.filter((g) => !isBoxed(g.el)).map((g) => g.el.id),
    ],
    heading: heading ? wordsOf(heading).split('\n')[0]!.slice(0, 200) : '',
  };
}

/** The selection's tab: the tab with only the gathered elements, for the picture. */
export function selectionTab(tab: Tab, selected: ReadonlySet<string>): Tab {
  const keep = new Set(gatherSelection(tab.elements, selected).map((g) => g.el.id));
  return { ...tab, elements: tab.elements.filter((el) => keep.has(el.id)) };
}

/** A PNG's bytes from a data URL's base64, without decoding it. */
export const base64Bytes = (b64: string): number =>
  Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

/** The picture at the first scale whose PNG fits the platform's size, or null when none does. */
export async function pictureWithin(
  draw: (scale: number) => Promise<HTMLCanvasElement>,
): Promise<KnowledgeSendPicture | null> {
  for (const scale of KNOWLEDGE_PICTURE_SCALES) {
    const canvas = await draw(scale);
    if (canvas.width > KNOWLEDGE_SEND_PICTURE_SIDE_MAX) continue;
    if (canvas.height > KNOWLEDGE_SEND_PICTURE_SIDE_MAX) continue;
    const url = canvas.toDataURL('image/png');
    const png = url.slice(url.indexOf(',') + 1);
    if (base64Bytes(png) <= KNOWLEDGE_SEND_PICTURE_BYTES_MAX)
      return { png, width: canvas.width, height: canvas.height };
  }
  return null;
}
