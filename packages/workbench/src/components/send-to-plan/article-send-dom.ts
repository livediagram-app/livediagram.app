// Send to Plan in an article's writing (livedocuments' and liveknowledge's docs/specs/013-workspace/send-to-plan.md
// "What it sends", "The chip"): the pieces drawn outside React, since the writing is a ProseMirror view. A sent
// block's chip at the end of its text (a decoration widget each app's article-sent-plugin places), and, for someone
// who reads the writing but cannot write in it (a Viewer, a locked page), a Send to Plan pill over the words picked.
// Both are plain buttons: never editable, never taking the caret, opening the card or the picker.
import type { IconPrim } from '@liveworkspace/icons';
import { lucideCircleCheck } from '@liveworkspace/icons/lucide';
import { brandMarkSvg, type BrandApp } from '@liveworkspace/brand/svg';
import type { PlanSend } from '@liveworkspace/index-client';
import { parseInert } from '@liveworkspace/trusted-types';
import { canSendHere, sendFromHere } from './send-to-plan-entry';
import { canSendDiagramHere, sendWordsToDiagram } from '../send-to-diagram/send-to-diagram-entry';
import { chipWords, openSentCard } from './SentChip';
import { PRESS_HOLD_MS } from './press-hold';

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

// The one pill on screen, over the words a reader picked, and Send to Diagram's beside it when the app drafts diagrams.
let pill: HTMLButtonElement | null = null;
let diagramPill: HTMLButtonElement | null = null;
// When a press on a pill began (send-to-plan.md "On a touch screen"): a tap clears the words picked before its click
// lands, and the pills, which go with the words, must stay for it. -Infinity while none is under way.
let pressedAt = Number.NEGATIVE_INFINITY;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/** Screen px between the words and the pills: past the selection's drag handle on a touch screen, close on a mouse. */
export const READ_PILL_GAP_PX = { coarse: 24, fine: 8 } as const;
// The pills' height on a coarse pointer (h-11), for the flip above the words at the screen's foot.
const PILL_TALL_PX = 44;

const coarsePointer = () =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const PILL =
  'fixed z-[var(--z-toolbar)] inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-lg shadow-slate-900/10 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 pointer-coarse:h-11';

// A pill button: its logo and words. Pressing it keeps the words picked until it reads them (a mouse), and holds the
// pills through a tap that clears them (a finger).
function pillButton(app: BrandApp, words: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = PILL;
  button.setAttribute('aria-label', label);
  button.appendChild(brandMarkDom(app, 14));
  button.appendChild(document.createTextNode(words));
  button.addEventListener('mousedown', (e) => e.preventDefault());
  button.addEventListener('pointerdown', () => {
    pressedAt = Date.now();
  });
  document.body.appendChild(button);
  return button;
}

/** Where the pills' top sits: under the words, clear of the touch handles, or above them at the screen's foot. */
export function readPillTop(at: { top?: number; bottom: number }, coarse: boolean): number {
  const gap = coarse ? READ_PILL_GAP_PX.coarse : READ_PILL_GAP_PX.fine;
  const below = at.bottom + gap;
  if (at.top === undefined || below + PILL_TALL_PX <= window.innerHeight - 8) return below;
  return Math.max(8, at.top - gap - PILL_TALL_PX);
}

/**
 * Shows Send to Plan under the words a reader picked (a screen rect), or hides it (null, or a session that may not
 * send). One pill at a time; it sends what `pick` answers when pressed, then goes.
 */
export function showReadSendPill(
  at: { left: number; bottom: number; top?: number } | null,
  pick: () => ArticlePick | null,
): void {
  if (!at || !canSendHere()) {
    hideReadSendPill();
    return;
  }
  clearRelease();
  if (!pill) {
    pill = pillButton('liveplanner', 'Send to Plan', 'Send the words to a plan');
    pill.dataset.readSendPill = '';
  }
  pill.onclick = () => {
    const picked = pick();
    hideReadSendPill();
    sendArticleWords(picked);
  };
  const top = `${readPillTop(at, coarsePointer())}px`;
  pill.style.left = `${Math.max(8, at.left)}px`;
  pill.style.top = top;
  if (!canSendDiagramHere()) {
    diagramPill?.remove();
    diagramPill = null;
    return;
  }
  if (!diagramPill) {
    diagramPill = pillButton('livediagram', 'Send to Diagram', 'Send the words to a diagram');
    diagramPill.dataset.readDiagramPill = '';
  }
  diagramPill.onclick = () => {
    const picked = pick();
    hideReadSendPill();
    sendArticleWordsToDiagram(picked);
  };
  diagramPill.style.left = `${Math.max(8, at.left) + pill.offsetWidth + 6}px`;
  diagramPill.style.top = top;
}

function clearRelease(): void {
  if (releaseTimer !== null) clearTimeout(releaseTimer);
  releaseTimer = null;
}

/** Takes the pills away. */
export function hideReadSendPill(): void {
  clearRelease();
  pressedAt = Number.NEGATIVE_INFINITY;
  pill?.remove();
  pill = null;
  diagramPill?.remove();
  diagramPill = null;
}

/**
 * The words picked went: the pills go too, unless a press on one is under way (a tap clears the words before its click
 * lands). Then they stay until its click sends, or until the hold runs out (a press let go elsewhere).
 */
export function releaseReadSendPill(): void {
  const left = pressedAt + PRESS_HOLD_MS - Date.now();
  if (!pill || left <= 0) return hideReadSendPill();
  clearRelease();
  releaseTimer = setTimeout(hideReadSendPill, left);
}
