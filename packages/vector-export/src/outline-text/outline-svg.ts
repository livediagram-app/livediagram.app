// The Logo Kit's text as letter outlines (livedesign/docs/specs/007-editor/logo-pages.md "Outlined text"). The SVG is
// mounted off screen with its embedded faces registered, so the browser lays its text out exactly as it paints it;
// each `<text>` is drawn as paths by outline-element.ts. The file that comes out holds no <text>, no @font-face and no
// @import. Loaded only when a kit is made, with fontkit.
import { parseInert } from '@liveworkspace/trusted-types';
import { bytesOf, defaultFontkit, registerFaces, type OutlineDeps } from './faces';
import { parseFontFaces } from './font-face-css';
import {
  FALLBACK_FAMILY,
  faceOpener,
  outlineTextElement,
  stackFamilies,
  type OutlinedPath,
} from './outline-element';

export { stackFamilies } from './outline-element';
export type { OutlineDeps } from './faces';

const SVG_NS = 'http://www.w3.org/2000/svg';
// What a <text> carries over to the group of outlines that replaces it.
const KEPT_ATTRS = ['transform', 'opacity', 'filter', 'clip-path', 'mask'];

function pathEl(doc: Document, p: OutlinedPath): Element {
  const el = doc.createElementNS(SVG_NS, 'path');
  el.setAttribute('d', p.d);
  el.setAttribute('fill', p.fill);
  if (p.fillOpacity) el.setAttribute('fill-opacity', p.fillOpacity);
  if (p.stroke) {
    el.setAttribute('stroke', p.stroke);
    el.setAttribute('stroke-width', String(p.strokeWidth));
    if (p.miterJoin) {
      el.setAttribute('stroke-linejoin', 'miter');
      el.setAttribute('stroke-miterlimit', '4');
    }
    if (p.strokeOpacity) el.setAttribute('stroke-opacity', p.strokeOpacity);
  }
  return el;
}

/** `svg` with every `<text>` drawn as outlines in the faces `fontCss` embeds. Throws `OutlineError`. */
export async function outlineSvgText(
  svg: string,
  fontCss: string,
  deps: OutlineDeps = {},
): Promise<string> {
  const parsed = parseInert(svg, 'image/svg+xml').documentElement;
  // The embedded faces go whether or not there is text: a logo of shapes alone needs none.
  let stripped = false;
  for (const style of [...parsed.querySelectorAll('style')]) {
    if (!style.textContent?.includes('@font-face')) continue;
    const defs = style.parentElement;
    style.remove();
    stripped = true;
    if (defs?.localName === 'defs' && defs.childElementCount === 0) defs.remove();
  }
  if (!parsed.querySelector('text')) {
    return stripped ? new XMLSerializer().serializeToString(parsed) : svg;
  }
  const faces = parseFontFaces(fontCss);
  const fontkit = await (deps.loadFontkit ?? defaultFontkit)();
  const root = document.importNode(parsed, true) as unknown as SVGSVGElement;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  host.appendChild(root);
  let release = () => {};
  try {
    release = await registerFaces(faces);
    document.body.appendChild(host);
    const families = new Set(faces.map((f) => f.family.toLowerCase()));
    const texts = [...root.querySelectorAll('text')] as SVGTextContentElement[];
    // A text in a stack the kit embeds no face of is set in the fallback face before it is measured.
    for (const t of texts) {
      for (const el of [t, ...t.querySelectorAll('*')]) {
        const stack = stackFamilies(getComputedStyle(el).fontFamily);
        if (!stack.some((f) => families.has(f.toLowerCase())))
          (el as SVGElement).style.fontFamily = FALLBACK_FAMILY;
      }
    }
    await document.fonts.ready;
    const open = faceOpener(fontkit, bytesOf);
    for (const t of texts) {
      const g = document.createElementNS(SVG_NS, 'g');
      for (const name of KEPT_ATTRS) {
        const v = t.getAttribute(name);
        if (v !== null) g.setAttribute(name, v);
      }
      for (const p of outlineTextElement(t, faces, open)) g.appendChild(pathEl(document, p));
      t.replaceWith(g);
    }
    root.remove();
    return new XMLSerializer().serializeToString(root);
  } finally {
    host.remove();
    release();
  }
}
