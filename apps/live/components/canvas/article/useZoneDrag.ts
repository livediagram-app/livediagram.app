'use client';

// Dragging a zone through the writing by its grip (docs/specs/007-editor/article-pages.md "Zones"):
// while the pointer moves, a ghost of the zone follows it and a drop caret shows the block boundary
// it would land at; release moves it there (one edit, its elements with it); Escape, or a release
// where it already sits, leaves it be.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArticleZoneBlock, LaidOutPage, PageRect } from '@livediagram/document';
import { articleHandleOf } from '@/lib/article/article-editor-store';
import { debugLog } from '@/lib/debug-log';

export type DropCaret = { x: number; y: number; width: number };

export type ZoneDragState = {
  flow: string;
  zoneId: string;
  // The zone's box where the pointer has carried it, in canvas px.
  ghost: PageRect;
  // Where it would land; null over nowhere it can go.
  caret: DropCaret | null;
};

/** A screen point on the canvas, by a page's sheet (its canvas rect and its box on screen). */
export function screenToCanvasBySheet(
  page: LaidOutPage,
  zoom: number,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const sheet = document.querySelector(`[data-illustrate-page-id="${CSS.escape(page.id)}"]`);
  if (!sheet) return null;
  const r = sheet.getBoundingClientRect();
  return { x: page.rect.x + (clientX - r.left) / zoom, y: page.rect.y + (clientY - r.top) / zoom };
}

export function useZoneDrag({
  zoom,
  pagesOf,
  onMove,
}: {
  zoom: number;
  // An article's pages, as laid out now.
  pagesOf: (flow: string) => readonly LaidOutPage[] | undefined;
  onMove: (flow: string, zoneId: string, near: { x: number; y: number }) => void;
}) {
  const [drag, setDrag] = useState<ZoneDragState | null>(null);
  const latest = useRef({ zoom, pagesOf, onMove });
  useEffect(() => {
    latest.current = { zoom, pagesOf, onMove };
  });
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const start = useCallback(
    (e: React.PointerEvent<HTMLElement>, flow: string, zone: ArticleZoneBlock, rect: PageRect) => {
      const page = latest.current.pagesOf(flow)?.[0];
      const handle = articleHandleOf(flow);
      if (!page || !handle) return;
      const z = latest.current.zoom;
      const grab = screenToCanvasBySheet(page, z, e.clientX, e.clientY);
      if (!grab) return;
      // On the window: the zone bar (and its grip) stands down while the zone is in hand.
      const target = window;
      const zoneEl = document.querySelector<HTMLElement>(
        `.article-zone[data-block-id="${CSS.escape(zone.id)}"]`,
      );
      zoneEl?.classList.add('article-zone-lifted');
      let point = grab;
      let caret: DropCaret | null = null;
      let frame = 0;
      const paint = () => {
        frame = 0;
        caret = handle.boundaryNear(point, zone.id)?.caret ?? null;
        setDrag({
          flow,
          zoneId: zone.id,
          ghost: {
            x: rect.x + point.x - grab.x,
            y: rect.y + point.y - grab.y,
            width: rect.width,
            height: rect.height,
          },
          caret,
        });
      };
      const move = (ev: PointerEvent) => {
        const p = screenToCanvasBySheet(page, latest.current.zoom, ev.clientX, ev.clientY);
        if (!p) return;
        point = p;
        if (!frame) frame = requestAnimationFrame(paint);
      };
      const end = (drop: boolean) => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', key, true);
        if (frame) cancelAnimationFrame(frame);
        zoneEl?.classList.remove('article-zone-lifted');
        cleanup.current = null;
        setDrag(null);
        if (drop && caret) latest.current.onMove(flow, zone.id, point);
        debugLog('[article] zone drag ended', { flow, zoneId: zone.id, dropped: drop && !!caret });
      };
      const up = () => end(true);
      const cancel = () => end(false);
      const key = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape') return;
        ev.preventDefault();
        ev.stopPropagation();
        end(false);
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', key, true);
      cleanup.current = () => end(false);
      paint();
    },
    [],
  );

  return { drag, start };
}
