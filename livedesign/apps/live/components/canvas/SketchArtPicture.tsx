'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { SKETCH_ART_FILTER_ID, svgSketchArtFilter } from '@livepages/document';
import { watchUntilSettled } from '@/components/canvas/settle-watch';

// An icon or sticker under Sketch in WebKit (docs/specs/008-canvas/finish.md "In WebKit"). WebKit runs a live
// `filter: url(#...)` again on every repaint, so a pan over wobbled art took 220-400 ms a frame at iPhone resolution.
// Here the art renders once, live and hidden (it keeps its layout), and over it sits a copy of it in which each
// drawing is a still picture: the drawing's own SVG wrapped in the art wobble, as an <img>. WebKit draws a picture
// once and repaints it as a bitmap, so a pan costs what it does on Flexible. The copy is re-taken once the art
// settles or resizes (settle-watch.ts). Art that animates stays live, without the wobble: a still picture would
// freeze it.

/** How far a picture reaches past its drawing's box on each side, as a share of it: the art filter's own region
 *  (`x="-15%"`), so a wobbled edge is never clipped (blueprint: the filter region's margin). */
export const SKETCH_ART_PICTURE_MARGIN = 0.15;

/** The most a picture is laid out past its size, then shrunk back: a filter inside a picture runs at one pixel per
 *  laid-out pixel, so a picture laid out at its size is blurred on a 3x screen (blueprint: 2 to 4). */
export const SKETCH_ART_PICTURE_MAX_SCALE = 4;

/** The longest side a picture is laid out at, px, so a big sticker on a 3x screen stays a few MB (blueprint: 512 to
 *  2048). */
export const SKETCH_ART_PICTURE_MAX_PX = 1024;

/** How many times its size a drawing of the longest side `sidePx` is laid out at: enough for the screen's pixels at
 *  the current zoom, at most SKETCH_ART_PICTURE_MAX_SCALE and SKETCH_ART_PICTURE_MAX_PX, never under 1. */
export function sketchArtRasterScale(sidePx: number, screenPxPerPx: number): number {
  const wanted = Math.min(SKETCH_ART_PICTURE_MAX_SCALE, Math.ceil(screenPxPerPx));
  const fits = Math.floor(
    SKETCH_ART_PICTURE_MAX_PX / (sidePx * (1 + 2 * SKETCH_ART_PICTURE_MARGIN)),
  );
  return Math.max(1, Math.min(wanted, fits));
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// A drawing's colours can come from CSS (a class, a `var(...)`, `currentColor`), which a picture cannot see: each
// painted part takes its resolved fill and stroke instead.
const RESOLVED_PAINT = ['fill', 'stroke'] as const;

function needsResolving(el: Element): boolean {
  if (el.hasAttribute('class')) return true;
  return RESOLVED_PAINT.some((name) => {
    const value = el.getAttribute(name);
    return !!value && (value.includes('var(') || value === 'currentColor');
  });
}

/** One drawing as a picture's markup: its SVG at its laid-out size inside the wobble, with a margin for the wobble
 *  to reach into; or null when it has no size yet. The wobble is in the picture's units, so it looks the same at any
 *  size the picture is laid out at. */
export function sketchArtPictureMarkup(live: SVGSVGElement): string | null {
  const w = live.clientWidth;
  const h = live.clientHeight;
  if (!w || !h) return null;
  const copy = live.cloneNode(true) as SVGSVGElement;
  const liveParts = [live, ...live.querySelectorAll('*')];
  const copyParts = [copy, ...copy.querySelectorAll('*')];
  liveParts.forEach((part, i) => {
    const twin = copyParts[i];
    if (!twin || !needsResolving(part)) return;
    const style = getComputedStyle(part);
    for (const name of RESOLVED_PAINT) twin.setAttribute(name, style.getPropertyValue(name));
  });
  copy.setAttribute('color', getComputedStyle(live).color);
  for (const name of ['class', 'style', 'id']) copy.removeAttribute(name);
  for (const part of copy.querySelectorAll('[id], [class]')) {
    part.removeAttribute('id');
    part.removeAttribute('class');
  }
  copy.setAttribute('width', String(w));
  copy.setAttribute('height', String(h));
  copy.setAttribute('overflow', 'visible');
  const dx = w * SKETCH_ART_PICTURE_MARGIN;
  const dy = h * SKETCH_ART_PICTURE_MARGIN;
  return (
    `<svg xmlns="${SVG_NS}" width="${w + 2 * dx}" height="${h + 2 * dy}" viewBox="${-dx} ${-dy} ${w + 2 * dx} ${h + 2 * dy}">` +
    `<defs>${svgSketchArtFilter()}</defs><g filter="url(#${SKETCH_ART_FILTER_ID})">` +
    `${new XMLSerializer().serializeToString(copy)}</g></svg>`
  );
}

/** The art's copy with each top-level drawing swapped for its picture: a box laid out by the drawing's own class and
 *  style, holding the picture laid out at its raster scale, past the box by the margin, and shrunk back. Null when
 *  the art animates or a drawing has no size yet. */
export function sketchArtPictureCopy(live: HTMLElement): Element | null {
  if (typeof live.getAnimations === 'function' && live.getAnimations({ subtree: true }).length > 0)
    return null;
  // Screen pixels per CSS pixel here: the device's, times the canvas zoom the art is drawn at.
  const zoom = live.offsetWidth ? live.getBoundingClientRect().width / live.offsetWidth : 1;
  const screenPxPerPx = (window.devicePixelRatio || 1) * (zoom || 1);
  const copy = live.cloneNode(true) as Element;
  const drawings = [...live.querySelectorAll('svg')].filter(
    (svg) => !svg.parentElement?.closest('svg'),
  );
  const slots = [...copy.querySelectorAll('svg')].filter(
    (svg) => !svg.parentElement?.closest('svg'),
  );
  for (const [i, drawing] of drawings.entries()) {
    const scale = sketchArtRasterScale(
      Math.max(drawing.clientWidth, drawing.clientHeight),
      screenPxPerPx,
    );
    const markup = sketchArtPictureMarkup(drawing);
    const slot = slots[i];
    if (!markup || !slot) return null;
    const box = document.createElement('span');
    const cls = drawing.getAttribute('class');
    if (cls) box.setAttribute('class', cls);
    box.setAttribute(
      'style',
      `${drawing.getAttribute('style') ?? ''};display:block;position:relative`,
    );
    const picture = document.createElement('img');
    picture.alt = '';
    picture.draggable = false;
    picture.decoding = 'sync';
    picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    const reach = 100 * (1 + 2 * SKETCH_ART_PICTURE_MARGIN) * scale;
    picture.setAttribute(
      'style',
      `position:absolute;left:${-100 * SKETCH_ART_PICTURE_MARGIN}%;top:${-100 * SKETCH_ART_PICTURE_MARGIN}%;` +
        `width:${reach}%;height:${reach}%;max-width:none;transform:scale(${1 / scale});transform-origin:0 0`,
    );
    box.append(picture);
    slot.replaceWith(box);
  }
  for (const named of copy.querySelectorAll('[id]')) named.removeAttribute('id');
  return copy;
}

export function SketchArtPicture({ children }: { children: ReactNode }) {
  const pictureRef = useRef<HTMLDivElement>(null);
  const hiderRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const picture = pictureRef.current;
    const hider = hiderRef.current;
    const live = liveRef.current;
    if (!picture || !hider || !live) return;
    let drawn = '';
    const take = () => {
      const copy = sketchArtPictureCopy(live);
      // Unchanged art keeps its pictures: a new <img> would decode them again.
      const next = copy?.innerHTML ?? '';
      if (next === drawn) return;
      drawn = next;
      picture.replaceChildren(...(copy?.childNodes ?? []));
      // Hidden from outside what is watched, so hiding it is not a change to re-take.
      hider.style.visibility = copy ? 'hidden' : '';
    };
    take();
    const stop = watchUntilSettled(live, take, { resize: true });
    return () => {
      stop();
      picture.replaceChildren();
      hider.style.visibility = '';
    };
  }, []);

  // Both fill the art's box, as the filtered wrapper this replaces did, so the copy lines up with the live art.
  return (
    <div className="relative h-full w-full">
      <div
        ref={pictureRef}
        data-sketch-art-picture=""
        aria-hidden
        inert
        className="pointer-events-none absolute inset-0"
      />
      <div ref={hiderRef} className="absolute inset-0">
        <div ref={liveRef} className="absolute inset-0">
          {children}
        </div>
      </div>
    </div>
  );
}
