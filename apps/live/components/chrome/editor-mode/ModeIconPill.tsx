import { useRef, type KeyboardEvent } from 'react';
import { EDITOR_MODES, type EditorMode } from '@livediagram/document';
import { HoverCard } from '@livediagram/ui';
import {
  EDITOR_MODE_DESCRIPTION,
  EDITOR_MODE_ICON,
  EDITOR_MODE_LABEL,
  MODE_SWITCH_FOCUS,
  otherEditorMode,
  type EditorModeSwitchProps,
} from './editor-mode-copy';

// Variant A: a labelled segmented pill, "Diagram | Draw", as a radiogroup.
// Both modes are named and sit side by side as peers; a white thumb slides
// under the chosen one. Below `sm` the segments drop their words and keep the
// glyph, the name living on in the accessible name and the hover card.
//
// One Tab stop (roving tabindex on the checked radio). With two instant,
// lossless options the arrows move focus AND select, as a radiogroup does.

const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export function ModeSegmented({ mode, onChange }: EditorModeSwitchProps) {
  const radios = useRef<Partial<Record<EditorMode, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!MOVE_KEYS.has(event.key)) return;
    event.preventDefault();
    const next = otherEditorMode(mode);
    onChange(next);
    radios.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Editor mode"
      className="relative flex h-7 w-full rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md border border-slate-500 bg-white shadow-sm transition-transform duration-micro motion-reduce:transition-none dark:bg-slate-600 ${
          mode === 'draw' ? 'translate-x-full' : ''
        }`}
      />
      {EDITOR_MODES.map((option) => {
        const checked = option === mode;
        const Icon = EDITOR_MODE_ICON[option];
        return (
          <HoverCard
            key={option}
            title={EDITOR_MODE_LABEL[option]}
            description={EDITOR_MODE_DESCRIPTION[option]}
            className="relative flex-1"
          >
            <button
              ref={(el) => {
                radios.current[option] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={EDITOR_MODE_LABEL[option]}
              tabIndex={checked ? 0 : -1}
              onClick={() => {
                if (!checked) onChange(option);
              }}
              onKeyDown={onKeyDown}
              className={`flex h-6 w-full items-center justify-center gap-1.5 rounded-md text-sm transition-colors ${MODE_SWITCH_FOCUS} ${
                checked
                  ? 'font-semibold text-slate-900 dark:text-white'
                  : 'font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
              }`}
            >
              <Icon
                className={checked ? 'text-brand-700 dark:text-brand-300' : undefined}
                aria-hidden
              />
              <span className="text-optical-centre hidden sm:inline">
                {EDITOR_MODE_LABEL[option]}
              </span>
            </button>
          </HoverCard>
        );
      })}
    </div>
  );
}
