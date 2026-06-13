// The floating WYSIWYG toolbar shown above an element while its label is
// being edited (spec/09). Per-range bold / italic / underline / strikethrough
// / size / colour, plus the whole-element alignment + padding as dropdowns.
// Rendered by RichTextEditor (which owns the selection + apply handlers);
// this component is presentation + the critical focus-preservation detail.

import { useEffect, useRef, useState } from 'react';
import {
  AlignIcon,
  BoldIcon,
  DotsIcon,
  ItalicIcon,
  NonePaddingIcon,
  PaddingIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from './palette-icons';
import type { Padding, RunBoolKey, RunSize, TextAlignX, TextAlignY } from '@livediagram/diagram';

// The resolved formatting of the current selection: each boolean is true
// when EVERY character in the selection is effectively-on; size/color are
// the uniform value across the selection, or null when mixed.
export type ActiveFormat = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  size: RunSize | null;
  color: string | null;
};

// Same dot glyphs the Selected Element panel's text-size control uses
// (1 / 2 / 3 dots = small / medium / large), so the two surfaces match.
const SIZES: { key: RunSize; label: string; dots: 1 | 2 | 3 }[] = [
  { key: 'sm', label: 'Small', dots: 1 },
  { key: 'md', label: 'Medium', dots: 2 },
  { key: 'lg', label: 'Large', dots: 3 },
];

const PADDINGS: { key: Padding; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'sm', label: 'Small' },
  { key: 'md', label: 'Medium' },
  { key: 'lg', label: 'Large' },
];

// Full 3×3 alignment grid, top→bottom then left→right.
const ALIGN_CELLS: { x: TextAlignX; y: TextAlignY }[] = (
  ['top', 'middle', 'bottom'] as const
).flatMap((y) => (['left', 'center', 'right'] as const).map((x) => ({ x, y })));

// preventDefault on mousedown keeps focus + the live selection in the
// contentEditable when a control is clicked (the classic rich-text-toolbar
// bug). Shared by every button so the editor never blurs mid-format.
const noFocusSteal = (e: React.MouseEvent) => e.preventDefault();

function btnClass(active: boolean): string {
  return `flex h-7 min-w-[28px] items-center justify-center rounded px-1.5 text-xs font-semibold transition ${
    active
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;
}

const CHEVRON = (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 4.5 6 7.5 9 4.5" />
  </svg>
);

const optionClass = (selected: boolean) =>
  `flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition ${
    selected
      ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

// A compact dropdown kept INLINE (not portalled) so it stays inside the
// toolbar wrapper, where the editor's focus + canvas-propagation guards
// already apply. Closes on an option click (the menu's bubble handler) or an
// outside pointerdown (capture phase, so it fires before the wrapper stops
// propagation). The trigger preventDefaults mousedown so the editor keeps
// its selection while the menu is open.
function ToolbarDropdown({
  label,
  trigger,
  menuClassName = 'min-w-[8rem]',
  children,
}: {
  label: string;
  trigger: React.ReactNode;
  menuClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);
  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onMouseDown={noFocusSteal}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-7 items-center gap-1 rounded px-1.5 text-xs font-medium transition ${
          open
            ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        {trigger}
        {CHEVRON}
      </button>
      {open ? (
        <div
          role="listbox"
          // An option click bubbles here and closes the menu after its own
          // handler runs.
          onClick={() => setOpen(false)}
          className={`absolute left-0 top-full z-10 mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${menuClassName}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function RichTextToolbar({
  active,
  alignX,
  alignY,
  padding,
  onToggle,
  onSize,
  onColor,
  onSetAlign,
  onSetPadding,
}: {
  active: ActiveFormat;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: Padding;
  onToggle: (key: RunBoolKey) => void;
  onSize: (size: RunSize) => void;
  onColor: (color: string) => void;
  onSetAlign: (x: TextAlignX, y: TextAlignY) => void;
  onSetPadding: (padding: Padding) => void;
}) {
  // The colour <input> is the ONE control that must take focus to open the
  // OS picker, so it omits the preventDefault the other buttons carry — the
  // editor skips its commit-on-blur while a toolbar interaction is in flight
  // and re-focuses + restores the selection after the colour applies.
  const toggles: { key: RunBoolKey; label: string; icon: React.ReactNode }[] = [
    { key: 'bold', label: 'Bold', icon: <BoldIcon /> },
    { key: 'italic', label: 'Italic', icon: <ItalicIcon /> },
    { key: 'underline', label: 'Underline', icon: <UnderlineIcon /> },
    { key: 'strikethrough', label: 'Strikethrough', icon: <StrikethroughIcon /> },
  ];
  const currentSize = SIZES.find((s) => s.key === active.size) ?? null;
  const currentPad = PADDINGS.find((p) => p.key === padding) ?? PADDINGS[2];
  const divider = <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />;

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {toggles.map((t) => (
        <button
          key={t.key}
          type="button"
          aria-label={t.label}
          aria-pressed={active[t.key]}
          onMouseDown={noFocusSteal}
          onClick={() => onToggle(t.key)}
          className={btnClass(active[t.key])}
        >
          {t.icon}
        </button>
      ))}
      {divider}
      {/* Size */}
      <ToolbarDropdown
        label="Text size"
        trigger={
          <>
            <DotsIcon count={currentSize?.dots ?? 2} />
            <span>{currentSize?.label ?? 'Size'}</span>
          </>
        }
      >
        {SIZES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="option"
            aria-selected={active.size === s.key}
            onMouseDown={noFocusSteal}
            onClick={() => onSize(s.key)}
            className={optionClass(active.size === s.key)}
          >
            <DotsIcon count={s.dots} />
            <span className="flex-1">{s.label}</span>
          </button>
        ))}
      </ToolbarDropdown>
      {divider}
      {/* Alignment — a 3×3 grid in the menu, matching the panel. */}
      <ToolbarDropdown
        label="Text alignment"
        menuClassName="min-w-0 p-1"
        trigger={<AlignIcon x={alignX} y={alignY} />}
      >
        <div className="grid grid-cols-3 gap-1">
          {ALIGN_CELLS.map(({ x, y }) => {
            const selected = alignX === x && alignY === y;
            return (
              <button
                key={`${y}-${x}`}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={`Align ${y} ${x}`}
                onMouseDown={noFocusSteal}
                onClick={() => onSetAlign(x, y)}
                className={`flex h-7 w-7 items-center justify-center rounded ${
                  selected
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <AlignIcon x={x} y={y} />
              </button>
            );
          })}
        </div>
      </ToolbarDropdown>
      {divider}
      {/* Padding */}
      <ToolbarDropdown
        label="Padding"
        trigger={
          <>
            {padding === 'none' ? <NonePaddingIcon /> : <PaddingIcon size={padding} />}
            <span>{currentPad?.label ?? 'Padding'}</span>
          </>
        }
      >
        {PADDINGS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="option"
            aria-selected={padding === p.key}
            onMouseDown={noFocusSteal}
            onClick={() => onSetPadding(p.key)}
            className={optionClass(padding === p.key)}
          >
            {p.key === 'none' ? <NonePaddingIcon /> : <PaddingIcon size={p.key} />}
            <span className="flex-1">{p.label}</span>
          </button>
        ))}
      </ToolbarDropdown>
      {divider}
      <label
        className="flex h-7 cursor-pointer items-center rounded px-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Text color"
      >
        <span
          className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600"
          style={{ backgroundColor: active.color ?? '#0f172a' }}
          aria-hidden
        />
        <input
          type="color"
          value={active.color ?? '#0f172a'}
          onChange={(e) => onColor(e.target.value)}
          aria-label="Text color"
          className="absolute h-0 w-0 opacity-0"
        />
      </label>
    </div>
  );
}
