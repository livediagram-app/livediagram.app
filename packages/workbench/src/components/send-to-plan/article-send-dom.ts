// Send to Plan in an article's writing (livedocuments' and liveknowledge's docs/specs/013-workspace/send-to-plan.md
// "What it sends", "The chip"): the pieces drawn outside React, since the writing is a ProseMirror view. A sent
// block's chip at the end of its text (a decoration widget each app's article-sent-plugin places): a plain button,
// never editable, never taking the caret, opening the card. The sends from the words picked (the selection menu's,
// the page toolbar's) go through sendArticleWords and sendArticleWordsToDiagram.
import type { IconPrim } from '@liveworkspace/icons';
import { lucideCircleCheck } from '@liveworkspace/icons/lucide';
import { brandMarkSvg, type BrandApp } from '@liveworkspace/brand/svg';
import type { PlanSend } from '@liveworkspace/index-client';
import { parseInert } from '@liveworkspace/trusted-types';
import { sendFromHere } from './send-to-plan-entry';
import { sendWordsToDiagram } from '../send-to-diagram/send-to-diagram-entry';
import { chipWords, openSentCard } from './SentChip';

const SVG = 'http://www.w3.org/2000/svg';

// The attributes each primitive draws with, as the shared Glyph does.
function primAttrs(p: IconPrim): [string, Record<string, string | number>] {
  switch (p.t) {
    case 'path':
      return ['path', { d: p.d }];
    case 'circle':
      return ['circle', { cx: p.cx, cy: p.cy, r: p.r }];
    case 'line':
      return ['line', { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 }];
    case 'rect':
      return ['rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.rx ?? 0 }];
    case 'polyline':
      return ['polyline', { points: p.points }];
    case 'polygon':
      return ['polygon', { points: p.points }];
    case 'ellipse':
      return ['ellipse', { cx: p.cx, cy: p.cy, rx: p.rx, ry: p.ry }];
    default:
      return ['g', {}];
  }
}

/** A line-art glyph as an SVG element, `size` px, in the text's colour. */
export function glyphDom(prims: readonly IconPrim[], size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  for (const [k, v] of Object.entries({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }))
    svg.setAttribute(k, String(v));
  for (const p of prims) {
    const [tag, attrs] = primAttrs(p);
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    svg.appendChild(el);
  }
  return svg;
}

// `article-chrome`: what an article's export and thumbnail leave out (the writing's own chrome).
export const CHIP =
  'article-sent-chip article-chrome ml-1.5 inline-flex h-5 max-w-48 cursor-pointer select-none items-center gap-1 rounded-full border px-1.5 align-[0.1em] font-sans text-[11px] font-medium leading-none not-italic no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300';
export const CHIP_OPEN =
  'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const CHIP_DONE =
  'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200';

/** A sent block's chip: the newest card's glyph and where it stands, +N for the rest; a press opens the card. */
export function sentChipDom(sends: readonly PlanSend[]): HTMLButtonElement {
  const newest = sends[0]!;
  const done = newest.card.done;
  const more = sends.length - 1;
  const words = chipWords(newest);
  const button = document.createElement('button');
  button.type = 'button';
  button.contentEditable = 'false';
  button.dataset.sentChip = '';
  if (done) button.dataset.done = '';
  button.className = `${CHIP} ${done ? CHIP_DONE : CHIP_OPEN}`;
  const title = newest.card.title || 'Card';
  button.setAttribute(
    'aria-label',
    `Open the card “${title}”, ${done ? 'done, ' : ''}${words}, in liveplanner`,
  );
  button.title = `${title}: ${words}${more > 0 ? `, and ${more} more` : ''}. Opens in liveplanner.`;
  button.appendChild(done ? glyphDom(lucideCircleCheck, 12) : brandMarkDom('liveplanner', 12));
  const label = document.createElement('span');
  label.className = 'truncate';
  label.textContent = words;
  button.appendChild(label);
  if (more > 0) {
    const extra = document.createElement('span');
    extra.className = 'tabular-nums opacity-70';
    extra.textContent = `+${more}`;
    button.appendChild(extra);
  }
  // A press never moves the caret or starts a selection in the writing.
  button.addEventListener('mousedown', (e) => e.preventDefault());
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSentCard(newest);
  });
  return button;
}

/** What an article send names: the block the words are in (its id, the link's place) and the words. */
export type ArticlePick = { blockId: string; text: string };

/** Opens the picker for the words picked in an article (or its block's when none are); nothing without words. */
export function sendArticleWords(pick: ArticlePick | null): void {
  if (!pick || !pick.text.trim()) return;
  sendFromHere('text', 'words', [{ elementId: pick.blockId, text: pick.text }]);
}

/** Send to Diagram's picker for the words picked (liveworkspace/docs/specs/004-index/send-to-diagram.md). */
export function sendArticleWordsToDiagram(pick: ArticlePick | null, label?: string): void {
  if (!pick || !pick.text.trim()) return;
  sendWordsToDiagram({ elementId: pick.blockId, text: pick.text, ...(label ? { label } : {}) });
}

let markCount = 0;

/** An app's logo (its prism, in the app's light or dark) as a DOM node: Send to Plan wears liveplanner's, Send to
 *  Diagram livediagram's (owner, 2026-11-23). Parsed inert, from the brand package's own markup. */
export function brandMarkDom(app: BrandApp, size: number): SVGSVGElement {
  markCount += 1;
  const svg = parseInert(
    // The scheme the app shows (its `.dark` class), fixed, so the mark carries no style sheet of its own.
    brandMarkSvg({
      app,
      scheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      idPrefix: `send-mark-${markCount}-`,
    }),
    'image/svg+xml',
  ).documentElement as unknown as SVGSVGElement;
  const node = document.importNode(svg, true);
  node.setAttribute('width', String(size));
  node.setAttribute('height', String(size));
  node.setAttribute('aria-hidden', 'true');
  return node;
}
