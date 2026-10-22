// An article's writing laid out without a browser (docs/specs/015-api/mcp-server.md §5, docs/specs/007-editor/
// article-pages.md "Everywhere a page goes"): what an agent's preview draws of an article page, and how many pages
// the writing reaches. The editor lays the writing out in the browser and reads the words off where they land
// (apps/live/lib/article/article-snapshot.ts); here every block is set as app/article-pages.css sets it (its size,
// weight, face, line height and margins, from the article's resolved style), its words wrapped at an estimated width
// and flowed down the article's pages, a page break starting the next. An estimate: a line may break a word earlier
// or later than the browser would, so a long article can end a few lines off. Pure.
import { articleListMarkers, articlesOf, type ArticleBlock, type ArticleRun } from './article-flow';
import type { ArticleDrawOp } from './article-draw-ops';
import {
  ARTICLE_LINE_HEIGHT,
  ARTICLE_PARAGRAPH_SPACE,
  ARTICLE_TEXT_SIZE_PX,
  articleMarginPx,
  articleTopMarginPx,
  resolveArticleStyle,
} from './article-style';
import { isLightColor } from './colors';
import { resolveFontStack } from './fonts';
import { legibleOn, pageFillTone } from './page-content';
import type { LaidOutPage } from './page';

// An average glyph's advance as a share of the font size (a bold one a little wider), as the headless renders
// estimate a label (svg-render-primitives' LABEL_ESTIMATE_CHAR_EM).
const CHAR_EM = 0.52;
export const BOLD_EM = 1.06;
const MONO = 'Roboto Mono, ui-monospace, monospace';

// How a block is set (app/article-pages.css): its size as a share of the body size, weight, face, line height (null:
// the body's), margins above and below in body lines, its left indent in px, and its colour.
type Set = {
  scale: number;
  weight: string;
  italic?: boolean;
  heading?: boolean;
  mono?: boolean;
  leading: number | null;
  above: number;
  below: number;
  indent: number;
  muted?: boolean;
  ruled?: boolean;
};

function setOf(b: ArticleBlock, para: number, rules: 'none' | 'title' | 'headings'): Set {
  const head = (
    scale: number,
    weight: string,
    above: number,
    below: number,
    leading = 1.25,
  ): Set => ({
    scale,
    weight,
    heading: true,
    leading,
    above,
    below,
    indent: 0,
  });
  if (b.type === 'list')
    return {
      scale: 1,
      weight: '400',
      leading: null,
      above: 0,
      below: 0.25,
      indent: 28 * ((b.level ?? 0) + 1),
    };
  if (b.type === 'code')
    return {
      scale: 14 / 16,
      weight: '400',
      mono: true,
      leading: 1.55,
      above: 0.5,
      below: 0.75,
      indent: 14,
    };
  if (b.type !== 'paragraph')
    return { scale: 1, weight: '400', leading: null, above: 0, below: 0, indent: 0 };
  switch (b.style) {
    case 'title':
      return { ...head(36 / 16, '700', 0, 0.5, 1.15), ruled: rules !== 'none' };
    case 'subtitle':
      return {
        scale: 20 / 16,
        weight: '400',
        leading: null,
        above: 0,
        below: 1,
        indent: 0,
        muted: true,
      };
    case 'h1':
      return { ...head(28 / 16, '700', 1.2, 0.4), ruled: rules === 'headings' };
    case 'h2':
      return { ...head(22 / 16, '650', 1, 0.3), ruled: rules === 'headings' };
    case 'h3':
      return { ...head(18 / 16, '650', 0.8, 0.2), ruled: rules === 'headings' };
    case 'quote':
      return {
        scale: 18 / 16,
        weight: '400',
        italic: true,
        leading: null,
        above: 0.5,
        below: 0.75,
        indent: 16,
      };
    default:
      return { scale: 1, weight: '400', leading: null, above: 0, below: para, indent: 0 };
  }
}

const runsText = (runs: readonly ArticleRun[]) => runs.map((r) => r.text).join('');

// A stretch of a line in one style.
type Style = { b: boolean; i: boolean };
type Segment = Style & { text: string };

// Each character's style, from the runs it is in (a block set bold, a heading, bolds every character).
function charStyles(runs: readonly ArticleRun[], bold: boolean, italic: boolean): Style[] {
  return runs.flatMap((r) => Array.from(r.text, () => ({ b: bold || !!r.b, i: italic || !!r.i })));
}

// A wrapped line cut where its style changes, found in the block's text from `from`; the end it reached.
function segmentsOf(
  text: string,
  styles: readonly Style[],
  line: string,
  from: number,
): { segments: Segment[]; end: number } {
  const at = line ? text.indexOf(line, from) : from;
  const start = at < 0 ? from : at;
  const segments: Segment[] = [];
  for (let k = 0; k < line.length; k++) {
    const s = styles[start + k] ?? { b: false, i: false };
    const last = segments[segments.length - 1];
    if (last && last.b === s.b && last.i === s.i) last.text += line[k];
    else segments.push({ ...s, text: line[k]! });
  }
  return { segments, end: start + line.length };
}

// The lines a text breaks into at `width` px, words kept whole unless one alone is wider.
export function wrapEstimated(text: string, width: number, px: number, bold: boolean): string[] {
  const advance = px * CHAR_EM * (bold ? BOLD_EM : 1);
  const fits = Math.max(1, Math.floor(width / advance));
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= fits) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      let rest = word;
      while (rest.length > fits) {
        out.push(rest.slice(0, fits));
        rest = rest.slice(fits);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

type EstimatedArticle = {
  // Each page's operations, by page id.
  ops: Map<string, ArticleDrawOp[]>;
  // How many pages the writing reaches: its own, and those the editor would add after its last.
  pagesUsed: number;
  // The pages it would add (the editor grows an article to the pages its writing reaches): each like the article's
  // last page, its id that page's with `~n`, set far off the canvas so no element is on it.
  added: LaidOutPage[];
  // Whether it runs past ARTICLE_ESTIMATE_PAGES_MAX pages even so.
  overflows: boolean;
};

// The most pages an estimate grows an article to (a preview, never the article itself).
export const ARTICLE_ESTIMATE_PAGES_MAX = 30;
// Where an added page sits: far above the canvas, clear of every element.
const ADDED_PAGE_Y = -1_000_000;

// The article `flow`'s writing set on its pages (`pages`, every laid-out page of the tab, in order), in the tab
// theme's accent `accent`.
export function estimateArticle(
  tab: object,
  flow: string,
  pages: readonly LaidOutPage[],
  accent: string,
): EstimatedArticle {
  const ops = new Map<string, ArticleDrawOp[]>();
  const doc = articlesOf(tab)[flow];
  const own = pages.filter((p) => p.flow === flow);
  if (!doc || own.length === 0) return { ops, pagesUsed: 0, added: [], overflows: false };
  const added: LaidOutPage[] = [];
  const lastOwn = own[own.length - 1]!;
  // The next page: the article's own, else one added like its last.
  const nextPage = (): boolean => {
    if (at + 1 < own.length) return true;
    if (own.length >= ARTICLE_ESTIMATE_PAGES_MAX) return false;
    const n = added.length + 1;
    const page: LaidOutPage = {
      ...lastOwn,
      id: `${lastOwn.id}~${n}`,
      index: lastOwn.index + n,
      rect: { ...lastOwn.rect, x: n * (lastOwn.rect.width + 48), y: ADDED_PAGE_Y },
    };
    own.push(page);
    added.push(page);
    return true;
  };
  const style = resolveArticleStyle(doc.style);
  const size = ARTICLE_TEXT_SIZE_PX[style.textSize];
  const leading = ARTICLE_LINE_HEIGHT[style.lineSpacing];
  const line = size * leading;
  const margin = articleMarginPx(doc.style);
  const top = articleTopMarginPx(doc.style);
  const markers = articleListMarkers(doc.blocks);
  const body = resolveFontStack(style.bodyFont) ?? 'system-ui, sans-serif';
  const headingFace = resolveFontStack(style.headingFont) ?? body;
  let at = 0;
  let y = own[0]!.rect.y + top;
  let first = true;
  let overflows = false;
  const page = () => own[at]!;
  const inkOf = (p: LaidOutPage) => {
    const tone = p.background?.fill ? pageFillTone(p.background.fill) : '#ffffff';
    const dark = !isLightColor(tone);
    const a = legibleOn(style.accent ?? accent, tone);
    return {
      text: dark ? '#e2e8f0' : '#1e293b',
      muted: dark ? '#94a3b8' : '#64748b',
      rule: dark ? 'rgb(255 255 255 / 0.22)' : 'rgb(15 23 42 / 0.16)',
      code: dark ? 'rgb(255 255 255 / 0.08)' : 'rgb(15 23 42 / 0.05)',
      accent: a,
    };
  };
  const push = (op: ArticleDrawOp) => {
    const list = ops.get(page().id) ?? [];
    list.push(op);
    ops.set(page().id, list);
  };
  // Room for `h` more px on this page, else the next page; false past the last.
  const room = (h: number): boolean => {
    const p = page();
    if (y + h <= p.rect.y + p.rect.height - margin) return true;
    if (!nextPage()) {
      overflows = true;
      return false;
    }
    at += 1;
    y = own[at]!.rect.y + top;
    first = true;
    return true;
  };
  for (const b of doc.blocks) {
    if (overflows) break;
    if (b.type === 'pageBreak') {
      if (!nextPage()) {
        overflows = true;
        break;
      }
      at += 1;
      y = own[at]!.rect.y + top;
      first = true;
      continue;
    }
    const set = setOf(b, ARTICLE_PARAGRAPH_SPACE[style.paragraphSpacing], style.rules);
    if (!first) y += set.above * line;
    const p = page();
    const ink = inkOf(p);
    const width = p.rect.width - margin * 2;
    if (b.type === 'divider') {
      const pad = 0.6 * line;
      if (!room(pad * 2)) break;
      const at0 = page().rect.x + margin;
      push({
        k: 'line',
        x1: at0,
        y1: y + pad,
        x2: at0 + width,
        y2: y + pad,
        stroke: ink.rule,
        width: 1,
      });
      y += pad * 2;
      first = false;
      continue;
    }
    if (b.type === 'zone') {
      // A zone keeps its room in the writing (its elements are drawn as elements).
      if (!room(b.height)) break;
      y += b.height + 0.6 * line;
      first = false;
      continue;
    }
    const px = size * set.scale;
    const lh = px * (set.leading ?? leading);
    const text = b.type === 'code' ? b.text : runsText(b.runs);
    // Wrapped as bold when every word of it is (a bold line runs wider).
    const bold =
      set.weight !== '400' || (b.type !== 'code' && b.runs.length > 0 && b.runs.every((r) => r.b));
    const lines = wrapEstimated(text, width - set.indent * (b.type === 'code' ? 2 : 1), px, bold);
    const styles =
      b.type === 'code'
        ? Array.from(text, () => ({ b: false, i: false }))
        : charStyles(b.runs, set.weight !== '400', !!set.italic);
    let cursor = 0;
    const color =
      set.heading && style.accentHeadings ? ink.accent : set.muted ? ink.muted : ink.text;
    const align = b.type === 'paragraph' || b.type === 'list' ? (b.align ?? 'left') : 'left';
    const anchor: 'start' | 'middle' | 'end' =
      align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    // From the page's left edge, so a line that breaks onto the next page lands on it.
    const dx = margin + (align === 'center' ? width / 2 : align === 'right' ? width : set.indent);
    if (b.type === 'code' && room(lines.length * lh + 20))
      push({
        k: 'rect',
        x: page().rect.x + margin,
        y,
        w: width,
        h: lines.length * lh + 20,
        fill: ink.code,
        r: 6,
      });
    // A heading keeps with what follows it (the stylesheet's break-after: avoid): with no room for it and a line
    // after it, it starts the next page.
    if (set.heading && !room(lines.length * lh + set.below * line + line)) break;
    const codePad = b.type === 'code' ? 10 : 0;
    lines.forEach((t, i) => {
      if (!room(lh) || overflows) return;
      const baseline = y + codePad + (lh - px) / 2 + px * 0.8;
      const x = page().rect.x + dx;
      if (i === 0 && b.type === 'list') {
        const marker = markers.get(b.id) ?? '';
        if (b.list === 'todo')
          push({
            k: 'check',
            x: x - 24,
            y: baseline - px * 0.8,
            size: px,
            stroke: ink.accent,
            done: !!b.checked,
          });
        else if (marker)
          push({
            k: 'text',
            x: x - 8,
            y: baseline,
            text: marker,
            family: body,
            size: px,
            weight: '400',
            style: 'normal',
            color: ink.text,
            anchor: 'end',
          });
      }
      // The line in its runs' styles: one text, its stretches following each other, so the renderer spaces them.
      const cut = segmentsOf(text, styles, t, cursor);
      cursor = cut.end;
      const weightOf = (sg: Style) => (sg.b ? (set.weight === '400' ? '700' : set.weight) : '400');
      const one = cut.segments.length <= 1 ? (cut.segments[0] ?? { b: false, i: false }) : null;
      push({
        k: 'text',
        x,
        y: baseline,
        text: t,
        family: b.type === 'code' ? MONO : set.heading ? headingFace : body,
        size: px,
        weight: one ? weightOf(one) : '400',
        style: one?.i ? 'italic' : 'normal',
        color: b.type === 'paragraph' && b.style === 'quote' ? ink.text : color,
        anchor,
        ...(one
          ? {}
          : {
              runs: cut.segments.map((sg) => ({
                text: sg.text,
                weight: weightOf(sg),
                style: sg.i ? 'italic' : 'normal',
              })),
            }),
      });
      y += lh;
    });
    const end = page().rect.x + margin;
    if (b.type === 'paragraph' && b.style === 'quote')
      push({
        k: 'rect',
        x: end,
        y: y - lines.length * lh,
        w: 3,
        h: lines.length * lh,
        fill: ink.accent,
      });
    if (set.ruled)
      push({
        k: 'line',
        x1: end,
        y1: y + 2,
        x2: end + width,
        y2: y + 2,
        stroke: ink.accent,
        width: 1.5,
      });
    y += codePad * 2 + set.below * line;
    first = false;
  }
  return { ops, pagesUsed: at + 1, added, overflows };
}
