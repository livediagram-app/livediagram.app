import { useRef, type KeyboardEvent } from 'react';
import {
  EDITOR_MODES,
  editorModeDescription,
  editorModeLabel,
  nextEditorMode,
  type EditorMode,
} from '@livediagram/document';
import { HoverCard } from '@livediagram/ui';
import {
  EDITOR_MODE_ICON,
  EDITOR_MODE_KEYSHORTCUT,
  MODE_SWITCH_FOCUS,
  type EditorModeSwitchProps,
} from './editor-mode-copy';
import { ModeKeyHint } from './ModeKeyHint';

// Power user mode's quick mode switch (docs/specs/007-editor/power-user-mode.md "Quick mode
// switch"): a segmented pill of icons only, one segment per mode from the catalogue, one press to
// switch. A raised thumb with a border marks the current mode (never colour alone); the words come
// back in each segment's hover card, with Shift+D, and stay its accessible name.
//
// A radiogroup with one Tab stop (roving tabindex on the checked radio); the arrows move focus and
// select, wrapping, as a radiogroup does.

const STEP: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function ModeIconPill({ mode, onChange }: EditorModeSwitchProps) {
  const radios = useRef<Partial<Record<EditorMode, HTMLButtonElement | null>>>({});
  const index = EDITOR_MODES.indexOf(mode);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const next = nextEditorMode(mode, step);
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
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-md border border-slate-500 bg-white shadow-sm transition-transform duration-micro motion-reduce:transition-none dark:bg-slate-600"
        style={{
          width: `calc((100% - 4px) / ${EDITOR_MODES.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {EDITOR_MODES.map((option) => {
        const checked = option === mode;
        const Icon = EDITOR_MODE_ICON[option];
        const label = editorModeLabel(option);
        return (
          <HoverCard
            key={option}
            title={
              <span className="flex items-center justify-between gap-3">
                {label}
                <ModeKeyHint />
              </span>
            }
            description={editorModeDescription(option)}
            className="relative flex-1"
          >
            <button
              ref={(el) => {
                radios.current[option] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={label}
              aria-keyshortcuts={EDITOR_MODE_KEYSHORTCUT}
              tabIndex={checked ? 0 : -1}
              onClick={() => {
                if (!checked) onChange(option);
              }}
              onKeyDown={onKeyDown}
              className={`flex h-6 w-full items-center justify-center rounded-md transition-colors ${MODE_SWITCH_FOCUS} ${
                checked
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
              }`}
            >
              <Icon aria-hidden />
            </button>
          </HoverCard>
        );
      })}
    </div>
  );
}
