'use client';

// Mirror While Drawing's live twins (docs/specs/007-editor/logo-pages.md "Mirror"): the drawing in
// progress, drawn again under each of its logo page's symmetry maps (a reflection across either
// centre line, both, or a turn about the centre), so the twins grow with the stroke rather than
// appearing on release. The maps are in the children's own coordinates: canvas px inside the
// canvas layer, screen px for the screen-space previews (toScreen).
import type { ReactNode } from 'react';
import {
  mirroredPageAt,
  symmetryMaps,
  symmetryMapsFor,
  type MirroredPage,
  type SymmetryMap,
} from '@livediagram/document';
import { PathDraftLayer, type PathDraftView } from './path/PathDraftLayer';

type Box = { x: number; y: number; width: number; height: number };

/** The box around some points. */
export function pointsBox(points: readonly { x: number; y: number }[]): Box | null {
  if (points.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The maps a draft in `box` repeats under while mirror is on (`pages` given): the same ones its
 *  release uses. Empty off a mirrored page. */
export function draftMirrorMaps(
  pages: readonly MirroredPage[] | null | undefined,
  box: Box | null,
): SymmetryMap[] {
  return pages && box ? symmetryMapsFor(pages, box) : [];
}

/** The maps of the mirrored page under `at`, wherever on it `at` is (a stroke that starts on an
 *  axis still grows its twins as it leaves it); empty off one. */
export function pageMirrorMaps(
  pages: readonly MirroredPage[],
  at: { x: number; y: number } | undefined,
): SymmetryMap[] {
  const page = at ? mirroredPageAt(pages, at) : null;
  return page ? symmetryMaps(page.rect, page.mirror) : [];
}

/** A canvas-px map as the same map in screen px, the canvas drawn at `origin` and `zoom`. */
export function toScreen(m: SymmetryMap, origin: { left: number; top: number }, zoom: number) {
  const { left: ox, top: oy } = origin;
  return {
    ...m,
    e: ox - (m.a * ox + m.c * oy) + zoom * m.e,
    f: oy - (m.b * ox + m.d * oy) + zoom * m.f,
  };
}

const css = (m: SymmetryMap) => `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;

/** `children` once under each of `maps`. `fixed` for screen-space children (themselves fixed, so
 *  each copy sits at the viewport's corner and above the canvas). */
export function SymmetryCopies({
  maps,
  fixed = false,
  children,
}: {
  maps: readonly SymmetryMap[];
  fixed?: boolean;
  children: ReactNode;
}) {
  return maps.map((m, i) => (
    <div
      key={i}
      aria-hidden
      data-mirror-draft=""
      className={`pointer-events-none left-0 top-0 ${fixed ? 'fixed z-[var(--z-chrome)]' : 'absolute'}`}
      style={{ transform: css(m), transformOrigin: '0 0' }}
    >
      {children}
    </div>
  ));
}

/** A draft in the canvas layer, repeated while it is on a mirrored page: placed by its `box`, or,
 *  for a stroke that redraws itself as it grows (a marker's), by the page under its start `at`. */
export function MirroredDraft({
  pages,
  box,
  at,
  children,
}: {
  pages: readonly MirroredPage[];
  box?: Box | null;
  at?: { x: number; y: number };
  children: ReactNode;
}) {
  const maps = at ? pageMirrorMaps(pages, at) : draftMirrorMaps(pages, box ?? null);
  return maps.length === 0 ? null : <SymmetryCopies maps={maps}>{children}</SymmetryCopies>;
}

/** A path being drawn, repeated: the line alone, no markers. Nothing off a mirrored page. */
export function MirroredPathDraft({
  view,
  pages,
}: {
  view: PathDraftView;
  pages: readonly MirroredPage[];
}) {
  return (
    <MirroredDraft pages={pages} box={view.element}>
      <PathDraftLayer {...view} anchors={[]} active={null} allHandles={false} ring={null} />
    </MirroredDraft>
  );
}
