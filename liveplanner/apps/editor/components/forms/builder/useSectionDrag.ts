'use client';

// Dragging a section by the grip in its header (docs/specs/030-forms/forms.md "Reordering sections"): mouse, pen or
// touch alike. While dragging, the gap between sections it would drop into is marked by a line; letting go places it
// there, one undo step. The page scrolls near its edges; Escape cancels.
import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

type Gap = { index: number; top: number };

// Every gap a section can drop into, top to bottom: before each section and after the last, measured from the
// column's top.
function gapsIn(root: HTMLElement): Gap[] {
  const base = root.getBoundingClientRect().top;
  const blocks = [...root.querySelectorAll<HTMLElement>('[data-form-section]')];
  const out: Gap[] = blocks.map((b, i) => ({
    index: i,
    top: b.getBoundingClientRect().top - base,
  }));
  const last = blocks[blocks.length - 1];
  if (last) out.push({ index: blocks.length, top: last.getBoundingClientRect().bottom - base });
  return out;
}

export function useSectionDrag(
  rootRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  // `index` is where it lands among the sections once it has left its own place.
  onDrop: (id: string, index: number) => void,
) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [mark, setMark] = useState<{ top: number } | null>(null);
  const gapRef = useRef<number | null>(null);
  const idRef = useRef<{ id: string; from: number } | null>(null);

  const end = useCallback(
    (commit: boolean) => {
      const held = idRef.current;
      const gap = gapRef.current;
      idRef.current = null;
      gapRef.current = null;
      setDragging(null);
      setMark(null);
      if (!commit || !held || gap === null) return;
      // A drop below its own place counts the gap it left.
      const index = gap > held.from ? gap - 1 : gap;
      if (index !== held.from) onDrop(held.id, index);
    },
    [onDrop],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: globalThis.PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const y = e.clientY - root.getBoundingClientRect().top;
      let best: Gap | null = null;
      for (const g of gapsIn(root))
        if (!best || Math.abs(y - g.top) < Math.abs(y - best.top)) best = g;
      const scroller = scrollRef.current;
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 48) scroller.scrollTop -= 14;
        else if (e.clientY > r.bottom - 48) scroller.scrollTop += 14;
      }
      gapRef.current = best?.index ?? null;
      setMark(best ? { top: best.top - 8 } : null);
    };
    const up = () => end(true);
    const cancel = () => end(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
    };
  }, [dragging, end, rootRef, scrollRef]);

  const grab = useCallback((e: PointerEvent, id: string, from: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    idRef.current = { id, from };
    setDragging(id);
  }, []);

  return { dragging, mark, grab };
}
