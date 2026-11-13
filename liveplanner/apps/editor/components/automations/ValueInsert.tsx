'use client';

// Text a rule writes, with its values (docs/specs/026-plan/automations.md "Values"): a real textarea whose values
// (`{{person}}`) show as violet chips, drawn by a backdrop under the transparent text so the caret, selection, undo
// and screen readers stay the textarea's own; and Insert a Value, a button inside the field (ValueInsertMenu) whose
// popover (a sheet on a phone) drops a value at the caret: the card's values, its fields by name, and in an Incoming
// Webhook rule Webhook Field… for a value of the call's JSON. ValueChipsText draws the same text read-only (a step
// card's preview).

import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FIELD_INVALID, useMediaQuery } from '@liveplanner/ui';
import { useIncomingRule } from './incoming-rule';
import { valueInsertGroups } from './value-insert-options';
import { ValueInsertButton, ValueInsertMenu } from './ValueInsertMenu';

// A value in the text, braces and all.
const VALUE = /(\{\{[^{}]*\}\})/g;

export const VALUE_CHIP =
  'rounded bg-brand-100 text-brand-800 [box-decoration-break:clone] dark:bg-brand-500/25 dark:text-brand-100';

// The text in runs: plain words, and each value as a chip whose braces stay (transparent) so it keeps the width the
// textarea gives it, its padding.
function Runs({ text, hideBraces }: { text: string; hideBraces: boolean }) {
  return text.split(VALUE).map((run, i) =>
    i % 2 === 1 ? (
      <span key={i} className={VALUE_CHIP}>
        {hideBraces ? <span className="text-transparent">{'{{'}</span> : null}
        {hideBraces ? run.slice(2, -2) : run.slice(2, -2).trim()}
        {hideBraces ? <span className="text-transparent">{'}}'}</span> : null}
      </span>
    ) : (
      <span key={i}>{run}</span>
    ),
  );
}

/** A rule's text as it reads, its values as chips. */
export function ValueChipsText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      <Runs text={text} hideBraces={false} />
    </span>
  );
}

// The text's box, the same for the textarea and its backdrop; the right padding keeps the words clear of the Insert
// button at the field's top right.
const TEXT = 'whitespace-pre-wrap break-words py-2 pl-2.5 pr-10 text-[13px] leading-6';

/** Puts `{{name}}` at the caret (over a selection), answering the text and where the caret goes after it. */
export function insertValue(text: string, start: number, end: number, name: string) {
  const value = `{{${name}}}`;
  return { text: `${text.slice(0, start)}${value}${text.slice(end)}`, caret: start + value.length };
}

export function ValueTextField({
  label,
  value,
  onChange,
  fields,
  multiline = true,
  maxLength,
  placeholder,
  invalid = false,
  hint,
  branch = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  // The card's fields by name, for Any Field…
  fields: readonly { id: string; name: string }[];
  // One line: Enter does not break it (a subject, a title).
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  invalid?: boolean;
  hint?: ReactNode;
  // Text inside a For Related Cards branch: {{card.…}} is the related card, and the triggering card's values join
  // the chips.
  branch?: boolean;
}) {
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const caret = useRef<number | null>(null);
  // Whether the field has had focus, so its selection is where the person left the caret.
  const placed = useRef(false);
  const [menu, setMenu] = useState<HTMLButtonElement | null>(null);
  // A phone's sheet just closed: its button keeps its hover card away until focus leaves it.
  const [quiet, setQuiet] = useState(false);
  const { incoming, github = false } = useIncomingRule();
  const phone = !useMediaQuery('(min-width: 640px)');
  const groups = useMemo(
    () => valueInsertGroups(branch, fields, incoming, github),
    [branch, fields, incoming, github],
  );

  // Grows with its text (no inner scroll, so the backdrop never drifts), and puts the caret after an inserted value.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    if (caret.current !== null) {
      el.focus();
      el.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);

  const insert = (name: string) => {
    const el = area.current;
    // A field never typed in has no caret of its own yet: the value goes at the end.
    const start = (placed.current ? el?.selectionStart : null) ?? value.length;
    const end = (placed.current ? el?.selectionEnd : null) ?? value.length;
    const next = insertValue(value, start, end, name);
    // A value goes in whole or not at all: past the field's limit it is refused, as the field refuses typing.
    if (maxLength !== undefined && next.text.length > maxLength) return;
    caret.current = next.caret;
    onChange(next.text);
    // The popover's (or sheet's) own focus return lands on the button as it goes: the field takes focus back after it.
    requestAnimationFrame(() => {
      const field = area.current;
      if (!field || document.activeElement === field) return;
      field.focus();
      const at = Math.min(next.caret, field.value.length);
      field.setSelectionRange(at, at);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <div
        className={`relative rounded-lg border bg-white transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:bg-slate-900 dark:focus-within:ring-brand-500/20 ${
          invalid ? FIELD_INVALID : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        <div
          ref={backdrop}
          aria-hidden
          className={`pointer-events-none absolute inset-0 overflow-hidden text-slate-900 dark:text-slate-100 ${TEXT}`}
        >
          <Runs text={value} hideBraces />
          {/* A trailing line break keeps the backdrop as tall as the textarea's last empty line. */}
          {'​'}
        </div>
        <textarea
          ref={area}
          id={id}
          value={value}
          rows={multiline ? 3 : 1}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          spellCheck
          onFocus={() => {
            placed.current = true;
          }}
          onChange={(e) =>
            onChange(multiline ? e.target.value : e.target.value.replace(/\n/g, ' '))
          }
          onKeyDown={(e) => {
            if (!multiline && e.key === 'Enter') e.preventDefault();
          }}
          className={`relative block w-full resize-none overflow-hidden bg-transparent text-transparent caret-slate-900 outline-none placeholder:text-slate-400 selection:bg-brand-200/70 selection:text-transparent dark:caret-white dark:selection:bg-brand-500/40 ${TEXT} ${multiline ? 'min-h-[92px]' : ''}`}
        />
        <ValueInsertButton
          label={label}
          open={menu !== null}
          onOpen={(anchor) => setMenu(menu ? null : anchor)}
          quiet={quiet}
          onBlur={() => setQuiet(false)}
        />
      </div>
      {hint ? <p className="text-[12px] text-slate-500 dark:text-slate-400">{hint}</p> : null}
      {menu ? (
        <ValueInsertMenu
          anchor={menu}
          groups={groups}
          phone={phone}
          onInsert={insert}
          onClose={() => {
            setMenu(null);
            if (phone) setQuiet(true);
          }}
        />
      ) : null}
    </div>
  );
}
