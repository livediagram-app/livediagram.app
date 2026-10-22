'use client';

// Dragging a question by its handle (docs/specs/030-forms/forms.md "The form card, top to bottom"): mouse, pen or
// touch alike. While dragging, the gap it would drop into is marked by a line between questions (sections included:
// a question can move into another section); letting go places it there, one undo step. Escape cancels.
import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

type DropMark = { section: number; index: number; top: number };

type Slot = { section: number; index: number; top: number; bottom: number };

// Every gap a question can drop into, top to bottom: before each question, and at the end of each section.
// Measured from the column's top, so a line drawn in the column sits on the gap whatever the scroll.
function slotsIn(root: HTMLElement): Slot[] {
  const base = root.getBoundingClientRect().top;
  const out: Slot[] = [];
  for (const section of root.querySelectorAll<HTMLElement>('[data-form-section]')) {
    const s = Number(section.dataset['formSection']);
    const cards = [...section.querySelectorAll<HTMLElement>('[data-form-question]')];
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      out.push({ section: s, index: i, top: r.top - base, bottom: r.bottom - base });
    });
    const end = section.querySelector<HTMLElement>('[data-form-section-end]');
    if (end) {
      const r = end.getBoundingClientRect();
      out.push({ section: s, index: cards.length, top: r.top - base, bottom: r.top - base });
    }
  }
  return out;
}

export function useQuestionDrag(
  rootRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  onDrop: (id: string, section: number, index: number) => void,
) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [mark, setMark] = useState<DropMark | null>(null);
  const markRef = useRef<DropMark | null>(null);
  const idRef = useRef<string | null>(null);

  const end = useCallback(
    (commit: boolean) => {
      const id = idRef.current;
      const m = markRef.current;
      idRef.current = null;
      markRef.current = null;
      setDragging(null);
      setMark(null);
      if (commit && id && m) onDrop(id, m.section, m.index);
    },
    [onDrop],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: globalThis.PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const y = e.clientY - root.getBoundingClientRect().top;
      const slots = slotsIn(root);
      // The gap whose line is nearest the pointer: a question's top edge, or a section's end.
      let best: Slot | null = null;
      let bestD = Infinity;
      for (const s of slots) {
        const d = Math.abs(y - s.top);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
        // Below a question's middle, the gap after it.
        if (y > (s.top + s.bottom) / 2 && Math.abs(y - s.bottom) < bestD) {
          bestD = Math.abs(y - s.bottom);
          best = { ...s, index: s.index + 1, top: s.bottom };
        }
      }
      // Near the page's edge, it scrolls.
      const scroller = scrollRef.current;
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 48) scroller.scrollTop -= 12;
        else if (e.clientY > r.bottom - 48) scroller.scrollTop += 12;
      }
      const next = best ? { section: best.section, index: best.index, top: best.top - 6 } : null;
      markRef.current = next;
      setMark(next);
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

  const grab = useCallback((e: PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    idRef.current = id;
    setDragging(id);
  }, []);

  return { dragging, mark, grab };
}
