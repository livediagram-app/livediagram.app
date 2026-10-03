// The writing as it is drawn, for an export (docs/specs/007-editor/document-pages.md "Everywhere a
// page goes"): read off the live editor's layout, so the file matches the screen to the word. The
// browser has already broken the lines, wrapped round the zones and moved text between pages; this
// takes each word where it landed, with its font and colour, every painted background (a highlight,
// code) and border (a quote's bar, a heading's rule, a divider), each list marker and to-do box, as
// draw operations in canvas coordinates. doc-draw.ts paints them into an SVG or onto a canvas.

export type DocDrawOp =
  | {
      k: 'text';
      x: number;
      // The alphabetic baseline.
      y: number;
      text: string;
      family: string;
      size: number;
      weight: string;
      style: string;
      color: string;
      underline?: boolean;
      strike?: boolean;
      anchor?: 'start' | 'middle' | 'end';
    }
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: string; r?: number }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  | { k: 'check'; x: number; y: number; size: number; stroke: string; done: boolean };

const transparent = (c: string) =>
  !c || c === 'transparent' || /rgba?\([^)]*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);

let measureCtx: CanvasRenderingContext2D | null = null;
// The font's ascent and descent about the baseline, as the browser lays its content area out
// (fontBoundingBox), in the element's own px.
function metricsOf(cs: CSSStyleDeclaration, text: string): { ascent: number; descent: number } {
  const size = parseFloat(cs.fontSize);
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return { ascent: size * 0.8, descent: size * 0.2 };
  measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = measureCtx.measureText(text || 'x');
  return {
    ascent: m.fontBoundingBoxAscent || size * 0.8,
    descent: m.fontBoundingBoxDescent || size * 0.2,
  };
}
const ascentOf = (cs: CSSStyleDeclaration, text: string) => metricsOf(cs, text).ascent;

/**
 * The writing under `root` as draw operations. `toCanvas` maps a screen point to the canvas;
 * `scale` is screen px per canvas px. Skips the editing chrome (page break labels, placeholders).
 */
export function snapshotWriting(
  root: HTMLElement,
  toCanvas: (x: number, y: number) => { x: number; y: number },
  scale: number,
): DocDrawOp[] {
  const ops: DocDrawOp[] = [];
  const text: DocDrawOp[] = [];
  const s = (n: number) => n / scale;
  const elements = root.querySelectorAll<HTMLElement>('*');
  // Backgrounds and borders first, under the words.
  for (const el of Array.from(elements)) {
    if (el.closest('.doc-page-break, .doc-zone')) continue;
    const cs = getComputedStyle(el);
    const rects = Array.from(el.getClientRects());
    if (!transparent(cs.backgroundColor)) {
      for (const r of rects) {
        const p = toCanvas(r.left, r.top);
        ops.push({
          k: 'rect',
          x: p.x,
          y: p.y,
          w: s(r.width),
          h: s(r.height),
          fill: cs.backgroundColor,
          r: parseFloat(cs.borderTopLeftRadius) || 0,
        });
      }
    }
    const edge = (width: string, color: string, style: string) =>
      parseFloat(width) > 0 && style !== 'none' && !transparent(color);
    if (edge(cs.borderLeftWidth, cs.borderLeftColor, cs.borderLeftStyle)) {
      for (const r of rects) {
        const a = toCanvas(r.left, r.top);
        const b = toCanvas(r.left, r.bottom);
        const w = parseFloat(cs.borderLeftWidth);
        ops.push({
          k: 'line',
          x1: a.x + w / 2,
          y1: a.y,
          x2: b.x + w / 2,
          y2: b.y,
          stroke: cs.borderLeftColor,
          width: w,
        });
      }
    }
    if (edge(cs.borderBottomWidth, cs.borderBottomColor, cs.borderBottomStyle)) {
      const r = rects[rects.length - 1];
      if (r) {
        const a = toCanvas(r.left, r.bottom);
        const b = toCanvas(r.right, r.bottom);
        const w = parseFloat(cs.borderBottomWidth);
        ops.push({
          k: 'line',
          x1: a.x,
          y1: a.y - w / 2,
          x2: b.x,
          y2: b.y - w / 2,
          stroke: cs.borderBottomColor,
          width: w,
        });
      }
    }
    if (el.tagName === 'HR' && edge(cs.borderTopWidth, cs.borderTopColor, cs.borderTopStyle)) {
      const r = rects[0];
      if (r) {
        const a = toCanvas(r.left, r.top);
        const b = toCanvas(r.right, r.top);
        ops.push({
          k: 'line',
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          stroke: cs.borderTopColor,
          width: parseFloat(cs.borderTopWidth),
        });
      }
    }
    // A list item's marker (a number, a bullet) or a to-do's box, from its ::before.
    if (el.classList.contains('doc-list')) markerOps(el, toCanvas, s, ops);
  }
  // Then every word, where it landed.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || parent.closest('.doc-page-break, .doc-zone')) continue;
    const content = node.textContent ?? '';
    if (!content.trim()) continue;
    const cs = getComputedStyle(parent);
    let underline = false;
    let strike = false;
    for (let a: HTMLElement | null = parent; a && a !== root; a = a.parentElement) {
      const line = getComputedStyle(a).textDecorationLine;
      if (line.includes('underline')) underline = true;
      if (line.includes('line-through')) strike = true;
    }
    const ascent = ascentOf(cs, content);
    const flushWord = (word: string, first: DOMRect | null) => {
      if (!word.trim() || !first) return;
      const p = toCanvas(first.left, first.top);
      text.push({
        k: 'text',
        x: p.x,
        y: p.y + ascent,
        text: word,
        family: cs.fontFamily,
        size: parseFloat(cs.fontSize),
        weight: cs.fontWeight,
        style: cs.fontStyle,
        color: cs.color,
        ...(underline ? { underline: true } : {}),
        ...(strike ? { strike: true } : {}),
      });
    };
    // Word by word, each where the browser put it: a justified line's spaces, a wrapped line's
    // break and a word moved to the next page all come out as laid out.
    let word = '';
    let first: DOMRect | null = null;
    let lastTop = Number.NaN;
    for (let i = 0; i < content.length; i++) {
      const ch = content[i]!;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getClientRects()[0] ?? null;
      const newLine =
        rect && !Number.isNaN(lastTop) && Math.abs(rect.top - lastTop) > rect.height / 2;
      if (/\s/.test(ch) || newLine) {
        flushWord(word, first);
        word = '';
        first = null;
        if (/\s/.test(ch)) {
          if (rect) lastTop = rect.top;
          continue;
        }
      }
      if (!rect) continue;
      if (!first) first = rect;
      word += ch;
      lastTop = rect.top;
    }
    flushWord(word, first);
  }
  return [...ops, ...text];
}

function markerOps(
  li: HTMLElement,
  toCanvas: (x: number, y: number) => { x: number; y: number },
  s: (n: number) => number,
  ops: DocDrawOp[],
): void {
  const before = getComputedStyle(li, '::before');
  const box = li.getBoundingClientRect();
  const scale = box.width / li.offsetWidth || 1;
  const left = box.left + (parseFloat(before.left) || 0) * scale;
  const cs = getComputedStyle(li);
  const lineH = (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5) * scale;
  if (li.classList.contains('doc-list-todo')) {
    const size = 16 * scale;
    const top = box.top + (lineH - size) / 2;
    const p = toCanvas(left, top);
    ops.push({
      k: 'check',
      x: p.x,
      y: p.y,
      size: s(size),
      stroke: before.borderTopColor || cs.color,
      done: li.classList.contains('doc-done'),
    });
    return;
  }
  const marker = li.getAttribute('data-marker');
  if (!marker) return;
  const width = (parseFloat(before.width) || 22) * scale;
  // On the first line's baseline: the line's half-leading above the content area, then the ascent.
  const m = metricsOf(cs, marker);
  const content = (m.ascent + m.descent) * scale;
  const p = toCanvas(left + width, box.top + (lineH - content) / 2 + m.ascent * scale);
  ops.push({
    k: 'text',
    x: p.x,
    y: p.y,
    text: marker,
    family: cs.fontFamily,
    size: parseFloat(cs.fontSize),
    weight: '400',
    style: 'normal',
    color: before.color || cs.color,
    anchor: 'end',
  });
}

/**
 * The writing as soft bars, one per line of text (docs/specs/007-editor/document-pages.md "The Map
 * shows each page's text as soft grey lines"): what a thumbnail or the Map draws, far cheaper than
 * the words (one rect read per text node, not per character).
 */
export function snapshotBars(
  root: HTMLElement,
  toCanvas: (x: number, y: number) => { x: number; y: number },
  scale: number,
  ink: string,
): DocDrawOp[] {
  const ops: DocDrawOp[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.textContent?.trim() || node.parentElement?.closest('.doc-page-break, .doc-zone'))
      continue;
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1) continue;
      const p = toCanvas(r.left, r.top + r.height * 0.25);
      ops.push({
        k: 'rect',
        x: p.x,
        y: p.y,
        w: r.width / scale,
        h: (r.height * 0.5) / scale,
        fill: ink,
        r: 2,
      });
    }
  }
  return ops;
}
