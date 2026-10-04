'use client';

// The template step's mode filter (docs/specs/007-editor/templates-by-mode.md "The mode filter"):
// a dropdown left of the search, so a mode added later is one more row, not a wider control. Its
// chip shows the choice in force; its menu lists Everything and every offered mode with its glyph (the
// mode switch's) and how many templates it holds. Hovering the chip with a mouse opens the menu
// without taking focus, so the choice is in plain sight; it closes a moment after the pointer
// leaves, unless it was opened by a press or the keyboard (then an outside press, Escape or a
// choice closes it). Menu button pattern (docs/specs/004-interface-design/menus.md).
import { useEffect, useRef } from 'react';
import { editorModeLabel } from '@livediagram/document';
import { lucideLayoutGrid } from '@livediagram/icons/lucide';
import {
  CheckIcon,
  ChevronDownIcon,
  lucideGlyph,
  useClickOutside,
  useMenu,
  useMenuButton,
  type MenuInitialFocus,
} from '@livediagram/ui';
import { EDITOR_MODE_ICON } from '@/components/chrome/editor-mode/editor-mode-copy';
import { CountBadge } from '@/components/primitives/CountBadge';
import type { TemplateModeChoice, TemplateModeFilter } from './useTemplateModeFilter';

const AllIcon = lucideGlyph(lucideLayoutGrid, 16);
// How long the menu stays once the pointer leaves the chip and menu (ms).
const HOVER_CLOSE_MS = 200;

const labelOf = (c: TemplateModeChoice) => (c === 'all' ? 'Everything' : editorModeLabel(c));
// A choice's glyph: a grid for Everything, the mode switch's glyph for a mode.
function ChoiceIcon({ choice, className }: { choice: TemplateModeChoice; className?: string }) {
  if (choice === 'all') return <AllIcon size={16} aria-hidden className={className} />;
  const Icon = EDITOR_MODE_ICON[choice];
  return <Icon size={16} aria-hidden className={className} />;
}

export function TemplateModeFilterControl({ filter }: { filter: TemplateModeFilter }) {
  const { choice, options, choose, counts } = filter;
  const menu = useMenuButton();
  const root = useRef<HTMLDivElement>(null);
  // Opened by hovering: it closes again as the pointer leaves.
  const byHover = useRef(false);
  const leave = useRef<number | null>(null);
  const cancelLeave = () => {
    if (leave.current !== null) window.clearTimeout(leave.current);
    leave.current = null;
  };
  useEffect(() => cancelLeave, []);
  const close = () => {
    byHover.current = false;
    menu.close();
  };
  useClickOutside(root, close, menu.open);
  return (
    <div
      ref={root}
      className="relative flex shrink-0"
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        cancelLeave();
        if (!menu.open) {
          byHover.current = true;
          menu.openMenu('none');
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse' || !byHover.current) return;
        cancelLeave();
        leave.current = window.setTimeout(() => {
          leave.current = null;
          close();
        }, HOVER_CLOSE_MS);
      }}
    >
      <button
        type="button"
        {...menu.triggerProps}
        // A press on a menu the hover opened keeps it open, as if the press had opened it.
        // Read from the ref, not `menu.open`: a pointer that arrives and presses in one moment
        // opens the menu by hover and presses before that open has rendered.
        onClick={() => {
          if (byHover.current) {
            byHover.current = false;
            cancelLeave();
            menu.openMenu();
          } else {
            menu.toggle();
          }
        }}
        aria-label={`Show templates for: ${labelOf(choice)}`}
        className="flex w-full min-w-[9.5rem] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 sm:w-auto dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-slate-800 dark:focus-visible:outline-brand-400"
      >
        <span className="inline-flex shrink-0 text-slate-500 dark:text-slate-400">
          <ChoiceIcon choice={choice} />
        </span>
        <span className="flex-1 text-left">{labelOf(choice)}</span>
        <ChevronDownIcon
          aria-hidden
          className={`shrink-0 text-slate-400 transition-transform duration-micro motion-reduce:transition-none ${
            menu.open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {menu.open ? (
        <ModeMenu
          options={options}
          choice={choice}
          counts={counts}
          trigger={menu.trigger}
          initialFocus={menu.initialFocus}
          onChoose={(c) => {
            choose(c);
            close();
          }}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function ModeMenu({
  options,
  choice,
  counts,
  trigger,
  initialFocus,
  onChoose,
  onClose,
}: {
  options: readonly TemplateModeChoice[];
  choice: TemplateModeChoice;
  counts: Readonly<Record<TemplateModeChoice, number>>;
  trigger: HTMLElement | null;
  initialFocus: MenuInitialFocus;
  onChoose: (c: TemplateModeChoice) => void;
  onClose: () => void;
}) {
  const { attach, surfaceProps } = useMenu({
    onClose,
    trigger,
    initialFocus,
    label: 'Show templates for',
  });
  return (
    <div
      ref={attach}
      {...surfaceProps}
      // The gap under the chip is padding inside the menu, so the pointer crossing it never leaves.
      className="absolute left-0 top-full z-(--z-popover) w-full min-w-48 pt-1.5 outline-none sm:w-max"
    >
      <div className="flex animate-fade-in flex-col gap-px rounded-lg border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60">
        {options.map((c) => {
          const checked = c === choice;
          return (
            <button
              key={c}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              tabIndex={-1}
              data-mode-choice={c}
              onClick={() => onChoose(c)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
                checked
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <ChoiceIcon choice={c} className="shrink-0" />
              <span className="flex-1">{labelOf(c)}</span>
              <CountBadge count={counts[c]} />
              <span className="flex w-4 shrink-0 justify-end">
                {checked ? <CheckIcon aria-hidden /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
