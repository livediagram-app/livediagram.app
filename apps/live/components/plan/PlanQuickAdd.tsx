'use client';

// A column's Add item field (docs/specs/025-plan/plan-board.md "Working on a board"): type a title and
// press Enter; the field stays open for the next one. `@sam`, `#label`, `!high`, `~3` and a leading
// `bug:` fill the item in, each shown as a chip as it is recognised. Escape closes it.
import { useEffect, useRef, useState } from 'react';
import { itemTypeOf, parseQuickAdd, type ItemPerson } from '@livediagram/items';
import type { PlanPalette } from './plan-palette';

export function PlanQuickAdd({
  palette,
  people,
  defaultType,
  autoFocus,
  emptyHint,
  onAdd,
  onClose,
}: {
  palette: PlanPalette;
  people: readonly ItemPerson[];
  defaultType: string;
  autoFocus: boolean;
  emptyHint?: string;
  onAdd: (input: { type: string; fields: Record<string, unknown>; title: string }) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = parseQuickAdd(text, people);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const submit = () => {
    if (!parsed.title) return;
    const type = parsed.type ?? defaultType;
    onAdd({ type, title: parsed.title, fields: { ...parsed.fields, title: parsed.title } });
    setText('');
  };
  return (
    <div
      className="rounded-lg border p-2"
      style={{ backgroundColor: palette.card, borderColor: palette.focus }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        onBlur={() => {
          if (!text.trim()) onClose();
        }}
        placeholder={emptyHint ?? 'Add item'}
        aria-label="New item title. @name assigns, #label labels, !high sets priority, ~3 estimates, bug: sets the type"
        className="w-full bg-transparent text-[14px] outline-none"
        style={{ color: palette.text }}
      />
      {parsed.tokens.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]" aria-live="polite">
          {parsed.tokens.map((t, i) => (
            <span
              key={i}
              className="rounded px-1.5 py-px"
              style={{ backgroundColor: palette.column, color: palette.text }}
            >
              {t.kind === 'type'
                ? itemTypeOf(t.type).label
                : t.kind === 'assignee'
                  ? t.person.name
                  : t.kind === 'label'
                    ? `#${t.label}`
                    : t.kind === 'priority'
                      ? `${t.priority} priority`
                      : `${t.estimate} pts`}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-1 text-[10px]" style={{ color: palette.muted }}>
          Enter to add · @name #label !high ~3 bug:
        </div>
      )}
    </div>
  );
}
