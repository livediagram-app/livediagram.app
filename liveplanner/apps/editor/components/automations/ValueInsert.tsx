'use client';

// Text a rule writes, with its values (docs/specs/026-plan/automations.md "Values"): a real textarea whose values
// (`{{person}}`) show as violet chips, drawn by a backdrop under the transparent text so the caret, selection, undo
// and screen readers stay the textarea's own; and Insert a Value, the chips that drop a value at the caret, with Any
// Field… for a field of the card by its name. ValueChipsText draws the same text read-only (a step card's preview).

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  AUTOMATION_BRANCH_VALUE_LABELS,
  AUTOMATION_BRANCH_VALUE_NAMES,
  AUTOMATION_VALUE_LABELS,
  AUTOMATION_VALUE_NAMES,
} from '@liveplanner/items';
import { FIELD_INVALID } from '@liveplanner/ui';
import {
  MenuActionRow,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideTextCursorInput } from '@liveworkspace/icons/lucide';

const FieldIcon = lucideGlyph(lucideTextCursorInput, 16);

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

// Insert a Value's chips: the fixed values, and inside a branch the triggering card's after them.
const VALUE_CHIPS = AUTOMATION_VALUE_NAMES.map((name) => ({
  name,
  label: AUTOMATION_VALUE_LABELS[name],
}));
const BRANCH_VALUE_CHIPS = [
  ...VALUE_CHIPS,
  ...AUTOMATION_BRANCH_VALUE_NAMES.map((name) => ({
    name,
    label: AUTOMATION_BRANCH_VALUE_LABELS[name],
  })),
];

const TEXT = 'whitespace-pre-wrap break-words px-2.5 py-2 text-[13px] leading-6';

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
  const [anyField, setAnyField] = useState<HTMLButtonElement | null>(null);

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
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = insertValue(value, start, end, name);
    caret.current = next.caret;
    onChange(maxLength ? next.text.slice(0, maxLength) : next.text);
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
          onChange={(e) =>
            onChange(multiline ? e.target.value : e.target.value.replace(/\n/g, ' '))
          }
          onKeyDown={(e) => {
            if (!multiline && e.key === 'Enter') e.preventDefault();
          }}
          className={`relative block w-full resize-none overflow-hidden bg-transparent text-transparent caret-slate-900 outline-none placeholder:text-slate-400 selection:bg-brand-200/70 selection:text-transparent dark:caret-white dark:selection:bg-brand-500/40 ${TEXT} ${multiline ? 'min-h-[92px]' : ''}`}
        />
      </div>
      {hint ? <p className="text-[12px] text-slate-500 dark:text-slate-400">{hint}</p> : null}
      <div
        role="group"
        aria-label={`Insert a Value into ${label}`}
        className="flex flex-col gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700"
      >
        <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
          Insert a Value
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(branch ? BRANCH_VALUE_CHIPS : VALUE_CHIPS).map(({ name, label: chip }) => (
            <button
              key={name}
              type="button"
              onClick={() => insert(name)}
              className="touch-target-y relative rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-medium leading-[18px] text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
            >
              {chip}
            </button>
          ))}
          {fields.length > 0 ? (
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={anyField !== null}
              onClick={(e) => setAnyField(anyField ? null : e.currentTarget)}
              className="touch-target-y relative rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-medium leading-[18px] text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
            >
              Any Field…
            </button>
          ) : null}
        </div>
      </div>
      {anyField ? (
        <PortalMenu anchor={anyField} placement="below" onClose={() => setAnyField(null)}>
          {fields.map((f) => (
            <MenuActionRow
              key={f.id}
              plain
              label={f.name}
              icon={<FieldIcon />}
              onClick={() => {
                setAnyField(null);
                insert(`card.field.${f.name}`);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </div>
  );
}
