'use client';

// Double-click to edit (docs/specs/030-knowledgebase/editing.md "Read mode"): while someone who may edit reads a
// page, a double-click on the page away from its writing (its margins, the gaps between blocks, the room under the
// last line) opens edit mode. A double-click on the writing is the browser's: it selects the word, and a reader
// selecting text never lands in edit mode (owner 2026-11-22). No label announces it; Edit is the visible way in.
import { useEffect, useRef } from 'react';
import { ringAt } from './mode-flash';

const WRITING = '.article-flow[data-readonly]';
// The document area: the scrolling reading column with its margins, never the sidebars, the top row or the footer.
const DOCUMENT = '[data-page-scroller]';
// The writing's own blocks (the flow's box itself spans the margins between columns and takes no presses).
const BLOCK = '.article-flow > *';
// Over these a click does its own thing.
const INTERACTIVE =
  'a, button, input, textarea, select, [role="button"], [data-page-link], summary';

/** Whether a double-click on `target` opens edit mode: on the page being read, off its writing and its controls. */
export function opensEditOnDoubleClick(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const area = target.closest(DOCUMENT);
  return (
    area !== null &&
    area.querySelector(WRITING) !== null &&
    target.closest(BLOCK) === null &&
    target.closest(INTERACTIVE) === null
  );
}

export function useDoubleClickToEdit(active: boolean, onEdit: () => void): void {
  const edit = useRef(onEdit);
  useEffect(() => {
    edit.current = onEdit;
  });
  useEffect(() => {
    if (!active) return;
    const onDouble = (e: MouseEvent) => {
      if (!opensEditOnDoubleClick(e.target)) return;
      ringAt(e.clientX, e.clientY);
      edit.current();
    };
    document.addEventListener('dblclick', onDouble);
    return () => document.removeEventListener('dblclick', onDouble);
  }, [active]);
}
