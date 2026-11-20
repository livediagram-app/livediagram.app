'use client';

// Dragging a choice's option by its grip (docs/specs/030-forms/forms.md "Question types", options): mouse, pen or
// touch alike. While dragging, a line marks the gap it would drop into; letting go places it there, one undo step.
// Escape cancels, and leaves the question open.
import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

type Edge = { top: number; bottom: number };

// The gap a pointer at `y` is over, 0 (before the first row) to `rows.length` (after the last): past a row's middle
// is the gap after it.
export function gapAt(rows: readonly Edge[], y: number): number {
  let gap = 0;
  for (const r of rows) if (y > (r.top + r.bottom) / 2) gap += 1;
  return gap;
}

// The options with the one at `from` dropped into `gap` (counted before it is lifted out). The same list when the
// drop leaves it where it was: the gaps on either side of it.
export function movedOption(options: readonly string[], from: number, gap: number): string[] {
  const same = [...options];
  if (from < 0 || from >= options.length || gap === from || gap === from + 1) return same;
  const [taken] = same.splice(from, 1);
  same.splice(Math.max(0, Math.min(gap > from ? gap - 1 : gap, same.length)), 0, taken!);
  return same;
}

export type OptionDropMark = { gap: number; top: number };

export function useOptionDrag(
  listRef: RefObject<HTMLElement | null>,
  onDrop: (from: number, gap: number) => void,
) {
  const [from, setFrom] = useState<number | null>(null);
  const [mark, setMark] = useState<OptionDropMark | null>(null);
  const markRef = useRef<OptionDropMark | null>(null);
  const fromRef = useRef<number | null>(null);

  const end = useCallback(
    (commit: boolean) => {
      const at = fromRef.current;
      const m = markRef.current;
      fromRef.current = null;
      markRef.current = null;
      setFrom(null);
      setMark(null);
      if (commit && at !== null && m) onDrop(at, m.gap);
    },
    [onDrop],
  );

  useEffect(() => {
    if (from === null) return;
    const move = (e: globalThis.PointerEvent) => {
      const list = listRef.current;
      if (!list) return;
      const base = list.getBoundingClientRect().top;
      const rows = [...list.querySelectorAll<HTMLElement>('[data-form-option]')].map((row) => {
        const r = row.getBoundingClientRect();
        return { top: r.top - base, bottom: r.bottom - base };
      });
      if (!rows.length) return;
      const gap = gapAt(rows, e.clientY - base);
      // The line sits on the gap: the top of the row after it, or the last row's foot.
      const top = gap < rows.length ? rows[gap]!.top : rows[rows.length - 1]!.bottom;
      const next = { gap, top };
      markRef.current = next;
      setMark((m) => (m && m.gap === gap && m.top === top ? m : next));
    };
    const up = () => end(true);
    const cancel = () => end(false);
    // Caught before the question's own Escape, which would close the question under the drag.
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      end(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key, true);
    };
  }, [from, end, listRef]);

  const grab = useCallback((e: PointerEvent, index: number) => {
    if (e.button !== 0) return;
    // No text selection as the pointer travels; the grip keeps its focus for Escape and the arrow keys.
    e.preventDefault();
    (e.currentTarget as HTMLElement).focus?.();
    fromRef.current = index;
    setFrom(index);
  }, []);

  return { from, mark, grab };
}
