// What every template carries on top of its drawing (docs/specs/008-canvas/canvas-and-palette.md "What a template
// shows"): its note on its title, and for a Workshop template whose board lacks them, the session kit, a column to the
// right of the board, top-aligned with it, holding a Timer and (where the board ends in a choice) a Vote session
// button, each beside the line saying when to press it. The note and the kit's lines are data (template-notes.ts).
//
// Pure: takes a template's built elements and returns them with the note set and the kit appended.

import { createText, type Element } from '@livediagram/document';
import { BUTTON_H, kitRow, sessionButton } from './template-session-parts';
import { TEMPLATE_CONTENT_LAYER_ID, templateLayers } from './template-layers';
import { templateNote, type TemplateKit } from './template-notes';
import type { TemplateKind } from './templates';

// The kit's place: this far right of the board, this wide, its rows this far apart.
export const KIT_GAP = 56;
export const KIT_W = 400;
const KIT_HEAD_H = 36;
const KIT_ROW_GAP = 16;

// Larger first, so a title outranks a caption under it.
const SIZE_RANK: Readonly<Record<string, number>> = { xl: 4, lg: 3, md: 2, sm: 1 };
type Text = Extract<Element, { type: 'text' }>;
const rankOf = (el: Text) => SIZE_RANK[el.textSize ?? ''] ?? 0;

/** The element a template's note goes on: its largest, then topmost, then leftmost text; else its first element. */
export function templateTitleIndex(elements: readonly Element[]): number {
  let best = -1;
  elements.forEach((el, i) => {
    if (el.type !== 'text') return;
    if (best < 0) {
      best = i;
      return;
    }
    const b = elements[best] as Text;
    const r = rankOf(el) - rankOf(b);
    if (r > 0 || (r === 0 && (el.y < b.y || (el.y === b.y && el.x < b.x)))) best = i;
  });
  return best < 0 ? (elements.length > 0 ? 0 : -1) : best;
}

type Box = { x: number; y: number; width: number; height: number };
const isBox = (el: Element): el is Element & Box =>
  'width' in el && typeof el.width === 'number' && typeof el.height === 'number';

// The tools a board already has, so the kit only adds what is missing.
function toolsOf(elements: readonly Element[]): Set<string> {
  const tools = new Set<string>();
  for (const el of elements) {
    if (el.type === 'shape' && el.shape === 'session-button')
      tools.add(el.session?.tool ?? 'timer');
  }
  return tools;
}

/** The session kit for a board whose right edge is `right` and top is `top`: only the tools it does not have. */
export function sessionKit(
  kit: TemplateKit,
  right: number,
  top: number,
  has: ReadonlySet<string>,
): Element[] {
  const rows: Element[][] = [];
  const x = right + KIT_GAP;
  let y = top + KIT_HEAD_H + 12;
  if (!has.has('timer')) {
    rows.push(
      kitRow(x, y, KIT_W, sessionButton({ tool: 'timer', minutes: kit.minutes }), kit.timer),
    );
    y += BUTTON_H + KIT_ROW_GAP;
  }
  if (kit.dots && kit.vote && !has.has('vote')) {
    rows.push(kitRow(x, y, KIT_W, sessionButton({ tool: 'vote', dots: kit.dots }), kit.vote));
  }
  if (rows.length === 0) return [];
  return [
    {
      ...createText(x, top),
      width: KIT_W,
      height: KIT_HEAD_H,
      label: 'Run the session',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
    },
    ...rows.flat(),
  ];
}

/** A template's elements with its note on its title and its session kit beside the board. */
export function withTemplateNote(kind: TemplateKind, elements: Element[]): Element[] {
  const said = templateNote(kind);
  if (!said || elements.length === 0) return elements;
  const out = [...elements];
  const at = templateTitleIndex(out);
  const host = out[at];
  if (host && host.type !== 'arrow' && !host.note)
    out[at] = { ...host, note: said.note } as Element;
  if (!said.kit) return out;
  const boxes = out.filter(isBox);
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const top = Math.min(...boxes.map((b) => b.y));
  const kit = sessionKit(said.kit, right, top, toolsOf(out));
  const layered = templateLayers(kind) ? { layerId: TEMPLATE_CONTENT_LAYER_ID } : {};
  return [...out, ...kit.map((el) => ({ ...el, ...layered }))];
}
