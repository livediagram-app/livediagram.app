// One page of an Illustrate tab, captured for the animated GIF export (docs/specs/020-import-export/blueprints/
// animated-gif-export.md "The snapshot"): the canvas's own rendering of the page, cloned once, with every CSS
// animation on it recorded so a frame can pin each one at any moment of the page's clock. A frame is then an SVG
// whose <foreignObject> holds the clone, drawn into a canvas (page-frames.ts).
import { debugLog } from '@/lib/debug-log';
import { GifExportError } from './gif-export-error';
import { GIF_OMIT_SELECTOR } from './gif-omit';
import { inlineMedia, type ImageInliner } from './snapshot-media';
import { pinRules, REDUCE_MOTION_CLASS, withFullMotion, type AnimatedNode } from './snapshot-css';

export type PageSnapshot = {
  /** Something on the page moves (a still page is one frame). */
  animated: boolean;
  /** The frame's size in pixels. */
  width: number;
  height: number;
  /** The page `t` ms after it came in, as a `data:` URL of an SVG image. */
  urlAt(t: number): string;
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const SVG_URL = 'data:image/svg+xml;charset=utf-8,';
const PSEUDOS = ['', '::before', '::after'] as const;
// What the clone inherits from the canvas around it (the <html> and <body> rules do not reach it in the image).
const INHERITED = [
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  '-webkit-font-smoothing',
  'text-rendering',
];
// The page's own animation markers.
const PAGE_SELECTOR = '[data-illustrate-page-id]';
const ELEMENT_SELECTOR = '[data-element-id]';
const TAG = 'data-gif-id';

export type SnapshotOptions = {
  width: number;
  height: number;
  // The tab's fonts as @font-face rules with data: URLs (embeddedFontFaceCss).
  fontCss: string;
  images: ImageInliner;
  // The CSS of the page's stylesheets, collected once per export (collectCss(document.styleSheets)).
  css: string;
};

/** Capture the page `pageId` as the canvas shows it now. */
export async function snapshotPage(
  pageId: string,
  { width, height, fontCss, images, css }: SnapshotOptions,
  doc: Document = document,
): Promise<PageSnapshot> {
  const node = doc.querySelector<HTMLElement>(`[data-illustrate-page-id="${CSS.escape(pageId)}"]`);
  const root = node?.closest<HTMLElement>('[data-canvas-root]');
  const content = root?.querySelector<HTMLElement>('[data-canvas-content]');
  if (!node || !root || !content) throw new GifExportError('page-missing');
  const view = doc.defaultView ?? window;
  const pageBox = node.getBoundingClientRect();
  const rootBox = root.getBoundingClientRect();

  const clone = content.cloneNode(true) as HTMLElement;
  // The live node and its twin in the clone share an index: the clone has the same tree.
  const live = [content, ...content.querySelectorAll<HTMLElement>('*')];
  const twins = [clone, ...clone.querySelectorAll<HTMLElement>('*')];
  // Left out: other pages, elements off this one and the editor's own marks (gif-omit.ts), with everything inside
  // them (document order: a parent comes first).
  const gone = new Set<Element>();
  for (let i = 1; i < live.length; i += 1) {
    const el = live[i]!;
    const parent = el.parentElement;
    if (
      (parent && gone.has(parent)) ||
      el.matches(GIF_OMIT_SELECTOR) ||
      offPage(el, node, pageBox, content)
    )
      gone.add(el);
  }

  // Every CSS animation left on the page, by its node in the clone (one tag a node, a row a pseudo-element), read
  // in full motion: Reduce Motion never stills a GIF.
  const animated: AnimatedNode[] = withFullMotion(doc.styleSheets, doc.documentElement, () => {
    const rows: AnimatedNode[] = [];
    for (let i = 0; i < live.length; i += 1) {
      const el = live[i]!;
      if (gone.has(el)) continue;
      let id = -1;
      for (const pseudo of PSEUDOS) {
        const style = view.getComputedStyle(el, pseudo || null);
        if (!style.animationName || style.animationName === 'none') continue;
        if (id < 0) {
          id = i;
          twins[i]!.setAttribute(TAG, String(id));
        }
        rows.push({ id, pseudo, delaysMs: parseDelays(style.animationDelay) });
      }
    }
    return rows;
  });

  // Media first, while the twins still line up with the live tree.
  await inlineMedia(live, twins, images, (el) => gone.has(el));
  for (let i = 0; i < live.length; i += 1) {
    const parent = live[i]!.parentElement;
    if (gone.has(live[i]!) && !(parent && gone.has(parent))) twins[i]!.remove();
  }
  debugLog(
    `[gif-export] page ${pageId} ${animated.length ? 'animated' : 'still'} nodes=${animated.length}`,
  );

  // Every page of a GIF shares the picked page's frame size, so a page of another shape (a 4:3 slide in a 16:9 deck,
  // a portrait infographic) is fitted inside it and centred on the paper, never cropped.
  const scale = Math.min(width / pageBox.width, height / pageBox.height);
  const inset = {
    x: (width - pageBox.width * scale) / 2,
    y: (height - pageBox.height * scale) / 2,
  };
  const html = doc.documentElement;
  const classes = [...html.classList].filter((c) => c !== REDUCE_MOTION_CLASS).join(' ');
  const htmlStyle = html.getAttribute('style') ?? '';
  const rootStyle = view.getComputedStyle(root);
  const inherited = INHERITED.map((p) => `${p}:${rootStyle.getPropertyValue(p)}`).join(';');
  const body = new XMLSerializer().serializeToString(clone);

  const head =
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" class="${attr(classes)}" style="${attr(htmlStyle)}">` +
    `<style><![CDATA[${cdata(fontCss)}\n${cdata(css)}\n`;
  const tail =
    `]]></style><foreignObject x="0" y="0" width="${width}" height="${height}">` +
    `<div xmlns="${XHTML_NS}" class="${attr(classes)}" style="${attr(`${htmlStyle};${inherited}`)};position:relative;width:${width}px;height:${height}px;overflow:hidden">` +
    `<div style="position:absolute;left:0;top:0;width:${rootBox.width}px;height:${rootBox.height}px;` +
    `transform:${cropTransform(pageBox, rootBox, scale, inset)};transform-origin:0 0">${body}</div></div></foreignObject></svg>`;
  // Encoded once: a frame encodes only its pinning rules (a URL-encoding of parts is the encoding of the whole).
  return heldSnapshot(
    SVG_URL + encodeURIComponent(head),
    encodeURIComponent(tail),
    animated,
    width,
    height,
  );
}

/** The snapshot a GIF holds while its frames are drawn: the encoded markup and the animations, nothing else. Built
 *  outside snapshotPage on purpose: a closure made in there would share its scope with the clone and the live nodes
 *  (an engine keeps one context for every closure of a scope), and keep the whole cloned page alive per page. */
function heldSnapshot(
  headUrl: string,
  tailUrl: string,
  animated: readonly AnimatedNode[],
  width: number,
  height: number,
): PageSnapshot {
  return {
    animated: animated.length > 0,
    width,
    height,
    urlAt: (t) => headUrl + encodeURIComponent(pinRules(animated, t)) + tailUrl,
  };
}

/** Where the canvas's box sits in the frame: the page's top-left at `inset` (the letterbox of a page fitted into a
 *  frame of another shape; none by default), scaled to fit. */
export function cropTransform(
  page: { left: number; top: number },
  root: { left: number; top: number },
  scale: number,
  inset: { x: number; y: number } = { x: 0, y: 0 },
): string {
  const x = (root.left - page.left) * scale + inset.x;
  const y = (root.top - page.top) * scale + inset.y;
  return `translate(${round(x)}px,${round(y)}px) scale(${round(scale)})`;
}

/** A computed `animation-delay` list ("0s, -1.5s, 200ms") in milliseconds. */
export function parseDelays(value: string): number[] {
  return value.split(',').map((part) => {
    const s = part.trim();
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return 0;
    return s.endsWith('ms') ? n : n * 1000;
  });
}

// Another page, or an element (outermost) that does not touch this page: left out of this page's frames, so a
// frame draws one page's DOM rather than the whole deck's.
function offPage(el: HTMLElement, page: HTMLElement, box: DOMRect, content: HTMLElement): boolean {
  if (el.matches(PAGE_SELECTOR)) return el !== page;
  if (!el.matches(ELEMENT_SELECTOR)) return false;
  const outer = el.parentElement?.closest(ELEMENT_SELECTOR);
  if (outer && content.contains(outer)) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  return r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const cdata = (s: string) => s.replace(/\]\]>/g, ']]]]><![CDATA[>');
