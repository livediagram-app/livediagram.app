import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { EDITOR_MODES } from '@livediagram/document';
import { CheckIcon, ChevronDownIcon, useClickOutside, useEscape } from '@livediagram/ui';
import { TOOLBAR_TRIGGER_TONE } from '@/components/palette/PaletteDropdown';
import {
  EDITOR_MODE_DESCRIPTION,
  EDITOR_MODE_ICON,
  EDITOR_MODE_LABEL,
  MODE_SWITCH_FOCUS,
  type EditorModeSwitchProps,
} from './editor-mode-copy';

// Variant C: a chip naming the current mode that opens a menu UPWARD (the
// tab bar is the bottom edge). Each row teaches its mode with a one-line
// description; the current one carries a check. The chip wears the Toolbar
// layout's faint dropdown tint (docs/specs/007-editor/toolbar-layout.md "Look"),
// so it reads as a menu rather than as another tab pill. Below `sm` the chip
// is glyph + chevron.
//
// Menu button pattern: the chip is `aria-haspopup="menu"`, the rows are
// `menuitemradio`. Opening focuses the checked row; ↑/↓ wrap, Home/End jump,
// Enter/Space choose and close, Escape closes; both return focus to the chip.
// An outside press or Tab away closes it where focus already went.

export function ModeMenuChip({ mode, onChange }: EditorModeSwitchProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const Icon = EDITOR_MODE_ICON[mode];

  const closeToChip = () => {
    setOpen(false);
    chip.current?.focus();
  };

  useClickOutside(root, () => setOpen(false), open);
  useEscape(closeToChip, { enabled: open, capture: true, stopPropagation: true });

  // Opening lands focus on the checked row. Choosing closes the menu in the
  // same step, so the mode never changes while it is open.
  useEffect(() => {
    if (open) rows.current[EDITOR_MODES.indexOf(mode)]?.focus();
  }, [open, mode]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = EDITOR_MODES.length;
    const at = rows.current.findIndex((row) => row === document.activeElement);
    const target =
      event.key === 'ArrowDown'
        ? (at + 1) % count
        : event.key === 'ArrowUp'
          ? (at - 1 + count) % count
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    rows.current[target]?.focus();
  };

  return (
    <div
      ref={root}
      className="relative w-full"
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={chip}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Editor mode: ${EDITOR_MODE_LABEL[mode]}`}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          setOpen(true);
        }}
        className={`flex h-7 w-full items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors sm:justify-start ${TOOLBAR_TRIGGER_TONE} ${MODE_SWITCH_FOCUS}`}
      >
        <Icon aria-hidden />
        <span className="text-optical-centre hidden flex-1 text-left sm:inline">
          {EDITOR_MODE_LABEL[mode]}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={`transition-transform duration-micro motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Editor mode"
          onKeyDown={onMenuKeyDown}
          className="absolute bottom-full left-0 z-(--z-popover) mb-2 flex w-[260px] animate-fade-in flex-col gap-px rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-xl shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60"
        >
          {EDITOR_MODES.map((option, index) => {
            const checked = option === mode;
            const RowIcon = EDITOR_MODE_ICON[option];
            return (
              <button
                key={option}
                ref={(el) => {
                  rows.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => {
                  if (!checked) onChange(option);
                  closeToChip();
                }}
                className={`flex h-14 items-center gap-3 rounded-lg px-2.5 text-left transition-colors ${MODE_SWITCH_FOCUS} ${
                  checked
                    ? 'bg-brand-50 dark:bg-brand-500/15'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <RowIcon
                  size={20}
                  aria-hidden
                  className={
                    checked
                      ? 'shrink-0 text-brand-700 dark:text-brand-200'
                      : 'shrink-0 text-slate-600 dark:text-slate-300'
                  }
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {EDITOR_MODE_LABEL[option]}
                  </span>
                  <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                    {EDITOR_MODE_DESCRIPTION[option]}
                  </span>
                </span>
                <span className="flex w-3 shrink-0 justify-center text-brand-700 dark:text-brand-200">
                  {checked ? <CheckIcon aria-hidden /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
