import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { EDITOR_MODES, editorModeLabel, nextEditorMode } from '@livediagram/document';
import { CheckIcon, ChevronDownIcon, useClickOutside, useEscape } from '@livediagram/ui';
import { TOOLBAR_TRIGGER_TONE } from '@/components/palette/PaletteDropdown';
import {
  EDITOR_MODE_ICON,
  EDITOR_MODE_KEYSHORTCUT,
  MODE_SWITCH_FOCUS,
  type EditorModeSwitchProps,
} from './editor-mode-copy';
import { ModeKeyHint } from './ModeKeyHint';

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): a dropdown chip
// showing the current mode's glyph and a chevron (and, `labelled`, its name), that opens a menu DOWNWARD (it sits in
// the top chrome), one compact row per mode from the catalogue (glyph and name, at the
// palette dropdowns' size; no hover card, which would cover the menu), a check on the
// current mode, and Shift+D on the row the key leads to. The chip wears the Toolbar
// layout's faint dropdown tint (docs/specs/007-editor/toolbar-layout.md "Look"), so it reads as a
// menu. `align` picks the edge the menu hangs from, so it opens into the room beside its host.
//
// Menu button pattern: the chip is `aria-haspopup="menu"`, the rows are `menuitemradio`. Opening
// focuses the checked row; ↑/↓ wrap, Home/End jump, Enter/Space choose and close, Escape closes;
// both return focus to the chip. An outside press or Tab away closes it where focus already went.

export function ModeMenuChip({
  mode,
  onChange,
  align = 'left',
  labelled = false,
}: EditorModeSwitchProps & { align?: 'left' | 'right'; labelled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const Icon = EDITOR_MODE_ICON[mode];
  const label = editorModeLabel(mode);
  const keyLeadsTo = nextEditorMode(mode);

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
        // Close only when focus MOVES to something outside (Tab away). A blur to nowhere
        // (relatedTarget null) is a press: Safari does not focus a pressed button, so pressing a
        // row blurs the focused row to the body, and closing here unmounted the row before its
        // click landed, leaving the switch dead. Presses outside are useClickOutside's.
        const next = event.relatedTarget;
        if (open && next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      {/* No hover card: it would sit over the menu the chip opens. The menu itself names the
          modes and shows Shift+D, and the chip keeps its accessible name. */}
      <button
        ref={chip}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Editor mode: ${label}`}
        aria-keyshortcuts={EDITOR_MODE_KEYSHORTCUT}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          setOpen(true);
        }}
        className={`flex w-full items-center gap-1 rounded-md px-1.5 transition-colors ${
          labelled ? 'h-6 justify-start text-xs font-medium' : 'h-7 justify-center'
        } ${TOOLBAR_TRIGGER_TONE} ${MODE_SWITCH_FOCUS}`}
      >
        <Icon aria-hidden />
        {labelled ? <span className="text-optical-centre flex-1 text-left">{label}</span> : null}
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
          className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} z-(--z-popover) mt-1.5 flex w-max min-w-36 animate-fade-in flex-col gap-px rounded-lg border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60`}
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
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${MODE_SWITCH_FOCUS} ${
                  checked
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <RowIcon size={16} aria-hidden className="shrink-0" />
                <span className="flex-1">{editorModeLabel(option)}</span>
                <span className="flex w-7 shrink-0 justify-end">
                  {checked ? <CheckIcon aria-hidden /> : null}
                  {option === keyLeadsTo && !checked ? <ModeKeyHint /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
