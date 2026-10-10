'use client';

// The in-place cell editor (docs/specs/029-sheets/sheet.md "Editing", "Writing formulas"): a textarea over the
// cell, grown with its text, whose references show in their colours through an overlay drawn underneath (the
// textarea's own text is transparent, its caret not). Under it, the function list while a name is typed, the
// argument hint inside a call, and the reason a formula cannot be saved.
import { useEffect, useRef } from 'react';
import { FUNCTION_DOCS, formatA1 } from '@livediagram/sheets';
import { argumentAt, argumentSlot, refSpans } from './formula-assist';
import { useSheetController } from './sheet-controller';
import { cellBox, mergeAt } from './sheet-geometry';
import { resolveFontStack } from '@livediagram/document';
import { fontPx } from './SheetCells';
import type { FormulaInput } from './useFormulaInput';

// The draft with each reference wrapped in its colour, for the overlay (and the formula bar).
export function ColouredDraft({ draft }: { draft: string }) {
  const spans = refSpans(draft);
  const out: React.ReactNode[] = [];
  let at = 0;
  spans.forEach((s, i) => {
    if (s.start > at) out.push(draft.slice(at, s.start));
    out.push(
      <span key={i} style={{ color: s.colour }}>
        {draft.slice(s.start, s.end)}
      </span>,
    );
    at = s.end;
  });
  out.push(draft.slice(at));
  // A trailing newline needs a character after it to be drawn.
  return (
    <>
      {out}
      {draft.endsWith('\n') ? ' ' : null}
    </>
  );
}

export function FunctionAssist({
  input,
  draft,
  onPick,
}: {
  input: FormulaInput;
  draft: string;
  onPick: (name: string) => void;
}) {
  const c = useSheetController();
  const arg = argumentAt(draft, input.caret);
  if (input.matches)
    return (
      <ul
        role="listbox"
        aria-label="Functions"
        className="absolute left-0 top-full z-20 mt-1 max-h-64 w-72 overflow-auto rounded-lg border py-1 text-[12px] shadow-lg"
        style={{
          backgroundColor: c.palette.surface,
          borderColor: c.palette.border,
          color: c.palette.text,
        }}
      >
        {input.matches.names.map((name, i) => (
          <li
            key={name}
            role="option"
            aria-selected={i === input.pick}
            className="cursor-pointer px-2.5 py-1.5"
            style={i === input.pick ? { backgroundColor: c.palette.column } : undefined}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPick(name);
            }}
          >
            <span className="font-semibold">{name}</span>
            <span className="ml-2" style={{ color: c.palette.muted }}>
              {input.matches!.ranges.has(name) ? 'Named range' : FUNCTION_DOCS[name]?.summary}
            </span>
          </li>
        ))}
      </ul>
    );
  if (arg) {
    const doc = FUNCTION_DOCS[arg.name]!;
    const slot = argumentSlot(arg.name, arg.index);
    return (
      <div
        role="note"
        className="absolute left-0 top-full z-20 mt-1 w-80 rounded-lg border px-3 py-2 text-[12px] shadow-lg"
        style={{
          backgroundColor: c.palette.surface,
          borderColor: c.palette.border,
          color: c.palette.text,
        }}
      >
        <div className="font-mono">
          {arg.name}(
          {doc.args.map((a, i) => (
            <span key={i} style={i === slot ? { fontWeight: 700 } : { color: c.palette.muted }}>
              {i > 0 ? ', ' : ''}
              {a}
            </span>
          ))}
          )
        </div>
        <div className="mt-1" style={{ color: c.palette.muted }}>
          {doc.summary}
        </div>
        <div className="mt-1 font-mono text-[11px]" style={{ color: c.palette.muted }}>
          {doc.example}
        </div>
      </div>
    );
  }
  return null;
}

export function SheetCellEditor({
  input,
  fontFamily,
}: {
  input: FormulaInput;
  fontFamily?: string;
}) {
  const c = useSheetController();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const e = c.editing;
  useEffect(() => {
    const el = ref.current;
    if (!el || !e) return;
    el.focus({ preventScroll: true });
    const end = el.value.length;
    el.setSelectionRange(end, end);
    input.setCaret(end);
    // Only when an edit starts (its cell), not as the draft changes.
  }, [e?.r, e?.c, e?.origin]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e || e.origin === 'bar') return null;
  const m = mergeAt(c.geometry, e.r, e.c);
  const box = cellBox(c.geometry, e.r, e.c, c.scroll, m);
  const rowId = c.sheet.layout.rows[e.r]!;
  const colId = c.sheet.layout.cols[e.c]!;
  const f = c.sheet.cells.get(`${rowId}:${colId}`)?.format;
  const px = fontPx(f);
  const lines = e.draft.split('\n').length;
  const lineH = Math.round(px * 1.3);
  const longest = Math.max(...e.draft.split('\n').map((l) => l.length));
  const width = Math.min(
    Math.max(box.w, longest * px * 0.6 + 16),
    Math.max(box.w, c.view.width - box.x - 8),
  );
  const height = Math.max(box.h, lines * lineH + 8);
  const text = {
    fontSize: px,
    lineHeight: `${lineH}px`,
    fontFamily: resolveFontStack(f?.ff) ?? fontFamily,
    fontWeight: f?.b ? 700 : undefined,
    fontStyle: f?.i ? ('italic' as const) : undefined,
  };
  return (
    <div
      className="absolute z-[9]"
      style={{ left: box.x - 1, top: box.y - 1 }}
      onPointerDown={(ev) => ev.stopPropagation()}
    >
      <div
        className="relative rounded-[2px]"
        style={{
          width: width + 2,
          height: height + 2,
          backgroundColor: f?.bg ?? c.palette.surface,
          boxShadow: `0 0 0 2px ${c.palette.focus}, 0 4px 12px rgba(0,0,0,0.15)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-1.5 py-1"
          style={{ ...text, color: f?.fc ?? c.palette.text }}
        >
          {input.error ? (
            <>
              <ColouredDraft draft={e.draft.slice(0, input.error.at)} />
              {/* The part that cannot be read, underlined (sheet.md "Writing formulas"). */}
              <span style={{ textDecoration: 'underline wavy #dc2626' }}>
                {e.draft.slice(input.error.at) || ' '}
              </span>
            </>
          ) : (
            <ColouredDraft draft={e.draft} />
          )}
        </div>
        <textarea
          ref={ref}
          data-sheet-editor={c.sheet.id}
          aria-label={`Edit cell ${formatA1(e.r, e.c)}`}
          value={e.draft}
          spellCheck={false}
          onChange={input.onChange}
          onKeyDown={input.onKeyDown}
          onSelect={(ev) => input.setCaret(ev.currentTarget.selectionStart ?? 0)}
          className="absolute inset-0 resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent px-1.5 py-1 outline-none"
          style={{ ...text, color: 'transparent', caretColor: f?.fc ?? c.palette.text }}
        />
        <FunctionAssist
          input={input}
          draft={e.draft}
          onPick={(name) => input.accept(name, ref.current)}
        />
      </div>
      {input.error ? (
        <div
          role="alert"
          className="mt-1 w-max max-w-80 rounded-md bg-red-600 px-2 py-1 text-[12px] text-white shadow"
        >
          {input.error.message}
        </div>
      ) : null}
    </div>
  );
}
