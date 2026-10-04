'use client';

// Which article the page toolbar is for (docs/specs/007-editor/article-pages.md "The page
// toolbar"): the one being worked on, else the article page under the pointer; and a press off the
// worked-on article's pages ending the work on it.
import { useLayoutEffect, useRef, useState } from 'react';
import { canvasGestureNow } from '@/lib/canvas-gesture';
import { clearActiveArticle, type ActiveArticle } from '@/lib/article/article-editor-store';

// Screen px of slack around a page that still counts as on it, and how long the pointer may be off
// an article page before its toolbar goes (time to cross the gap to the card).
const HOVER_SLACK = 12;
const HOVER_GRACE_MS = 250;

const sheetOf = (pageId: string) =>
  document.querySelector(`[data-illustrate-page-id="${CSS.escape(pageId)}"]`);

const onSheet = (pageId: string, x: number, y: number, slack: number) => {
  const r = sheetOf(pageId)?.getBoundingClientRect();
  return (
    !!r &&
    x >= r.left - slack &&
    x <= r.right + slack &&
    y >= r.top - slack &&
    y <= r.bottom + slack
  );
};

// The article page under the pointer (kept a moment after it leaves), or null.
export function useHoveredArticlePage(
  pages: readonly { id: string; flow: string }[],
): { flow: string; pageId: string } | null {
  const [hovered, setHovered] = useState<{ flow: string; pageId: string } | null>(null);
  const latest = useRef(pages);
  useLayoutEffect(() => {
    latest.current = pages;
  });
  useLayoutEffect(() => {
    let frame = 0;
    let leave = 0;
    let x = 0;
    let y = 0;
    const look = () => {
      frame = 0;
      // Mid-gesture (a pan, a drag): the pointer is not choosing a page.
      if (canvasGestureNow() !== 'idle') return;
      const page = latest.current.find((p) => onSheet(p.id, x, y, HOVER_SLACK));
      if (page) {
        window.clearTimeout(leave);
        leave = 0;
        setHovered((h) => (h?.pageId === page.id ? h : { flow: page.flow, pageId: page.id }));
      } else if (!leave) {
        leave = window.setTimeout(() => {
          leave = 0;
          setHovered(null);
        }, HOVER_GRACE_MS);
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      // Over the toolbar or its menus: the page it is for stays.
      if ((e.target as Element | null)?.closest?.('[data-article-keep-active]')) {
        window.clearTimeout(leave);
        leave = 0;
        return;
      }
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(look);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(leave);
    };
  }, []);
  return hovered;
}

// A press off the active article's pages (and off its toolbar, menus and zone bar) ends working on
// it: its toolbar goes.
export function useOffPagePressClears(
  active: ActiveArticle | null,
  pages: readonly { id: string; flow: string }[],
) {
  const flow = active?.handle.flow ?? null;
  const latest = useRef(pages);
  useLayoutEffect(() => {
    latest.current = pages;
  });
  useLayoutEffect(() => {
    if (!flow) return;
    const press = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-article-keep-active]')) return;
      const own = latest.current.filter((p) => p.flow === flow);
      if (own.some((p) => onSheet(p.id, e.clientX, e.clientY, 0))) return;
      clearActiveArticle(flow);
    };
    window.addEventListener('pointerdown', press, true);
    return () => window.removeEventListener('pointerdown', press, true);
  }, [flow]);
}
