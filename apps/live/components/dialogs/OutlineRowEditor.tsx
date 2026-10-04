'use client';

// One row of Edit Outline's row editor (docs/specs/009-elements/mind-node.md "Edit Outline"): a
// node's text, editable in place with its bold / italic / underline, wrapping onto further lines
// inside the row. A contentEditable whose DOM is painted imperatively from the row's marks (as the
// canvas label editor does, lib: rich-text-dom), so React never reconciles the text being typed;
// typing reads the DOM back into marks. Keys and paste go up to the row list, which owns structure.
import { memo, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { normalizeRuns, type TextRun } from '@livediagram/document';
import {
  dataAttrsForRun,
  readRunsFromDom,
  reconcileTrailingNewline,
} from '@/components/rich-text/rich-text-dom';

/** The formatting a row carries: bold, italic and underline, nothing else. */
export function outlineMarks(runs: TextRun[]): TextRun[] {
  return normalizeRuns(
    runs.map((r) => {
      const run: TextRun = { text: r.text };
      if (r.bold) run.bold = true;
      if (r.italic) run.italic = true;
      if (r.underline) run.underline = true;
      return run;
    }),
  );
}

function paint(el: HTMLElement, marks: TextRun[]) {
  el.replaceChildren();
  for (const run of marks) {
    const span = document.createElement('span');
    if (run.bold) span.style.fontWeight = '700';
    if (run.italic) span.style.fontStyle = 'italic';
    if (run.underline) span.style.textDecoration = 'underline';
    for (const [k, v] of Object.entries(dataAttrsForRun(run))) span.setAttribute(k, v);
    span.textContent = run.text;
    el.appendChild(span);
  }
  reconcileTrailingNewline(el);
}

const keyOf = (marks: TextRun[]) => JSON.stringify(marks);

export const OutlineRowEditor = memo(function OutlineRowEditor({
  id,
  marks,
  label,
  placeholder,
  className,
  register,
  onMarks,
  onKeyDown,
  onPaste,
  onFocus,
}: {
  id: string;
  marks: TextRun[];
  // The row's accessible name ("Root", "Level 2").
  label: string;
  placeholder: string;
  className: string;
  register: (id: string, el: HTMLDivElement | null) => void;
  onMarks: (id: string, marks: TextRun[]) => void;
  onKeyDown: (id: string, e: KeyboardEvent<HTMLDivElement>) => void;
  onPaste: (id: string, e: ClipboardEvent<HTMLDivElement>) => void;
  onFocus: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The marks the DOM shows now: painted from props, or read back from typing.
  const shown = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || shown.current === keyOf(marks)) return;
    paint(el, marks);
    shown.current = keyOf(marks);
  }, [marks]);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        register(id, el);
      }}
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-rt-placeholder={placeholder}
      className={className}
      onInput={(e) => {
        const el = e.currentTarget;
        const next = outlineMarks(readRunsFromDom(el));
        reconcileTrailingNewline(el);
        shown.current = keyOf(next);
        onMarks(id, next);
      }}
      onKeyDown={(e) => onKeyDown(id, e)}
      onPaste={(e) => onPaste(id, e)}
      onFocus={() => onFocus(id)}
    />
  );
});
