'use client';

// The template step's mode filter control (docs/specs/007-editor/templates-by-mode.md "The mode
// filter"): All, Diagram, Draw and Illustrate as one radio group on the shared sliding pill, each
// mode with its glyph from the mode switch. Arrow keys move the choice, as in any radio group.
import type { KeyboardEvent } from 'react';
import { ACTIVE_SEGMENT, SEGMENT_TRACK } from '@livediagram/ui';
import { editorModeLabel } from '@livediagram/document';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';
import { EDITOR_MODE_ICON } from '@/components/chrome/editor-mode/editor-mode-copy';
import type { TemplateModeChoice, TemplateModeFilter } from './useTemplateModeFilter';

const labelOf = (c: TemplateModeChoice) => (c === 'all' ? 'All' : editorModeLabel(c));

export function TemplateModeFilterControl({
  filter,
  className = '',
}: {
  filter: TemplateModeFilter;
  className?: string;
}) {
  const { choice, options, choose } = filter;
  const index = options.indexOf(choice);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(index + step + options.length) % options.length]!;
    choose(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-mode-choice="${next}"]`)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Show templates for"
      onKeyDown={onKeyDown}
      className={`relative grid shrink-0 rounded-lg p-0.5 ${SEGMENT_TRACK} ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <SegmentSlider count={options.length} index={index} className={ACTIVE_SEGMENT} />
      {options.map((c) => {
        const active = c === choice;
        const Icon = c === 'all' ? null : EDITOR_MODE_ICON[c];
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-mode-choice={c}
            onClick={() => choose(c)}
            className={`relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400 ${
              active
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {Icon ? (
              <span className="inline-flex shrink-0">
                <Icon size={14} aria-hidden />
              </span>
            ) : null}
            {labelOf(c)}
          </button>
        );
      })}
    </div>
  );
}
