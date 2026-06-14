// The floating WYSIWYG toolbar shown above an element while its label is
// being edited (spec/09). Per-range bold / italic / underline (+ strikethrough
// under the ⋯ menu) / size / colour, plus whole-element alignment + padding as
// dropdowns. Rendered by RichTextEditor (which owns the selection + apply
// handlers); this component is presentation + the focus-preservation detail.

import { useEffect, useRef, useState } from 'react';
import { AlignmentGrid } from './palette-controls';
import {
  AlignIcon,
  BoldIcon,
  DotsIcon,
  ItalicIcon,
  NonePaddingIcon,
  PaddingIcon,
  ScaleIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from './palette-icons';
import { Tooltip } from './Tooltip';
import { FONTS, resolveFontStack } from '@/lib/fonts';
import type { Padding, RunBoolKey, RunSize, TextAlignX, TextAlignY } from '@livediagram/diagram';

// Size key that includes 'scale' (whole-element auto-fit) alongside the
// per-run sizes.
type SizeKey = RunSize | 'scale';

// The resolved formatting of the current selection: each boolean is true
// when EVERY character in the selection is effectively-on; size/color are
// the uniform value across the selection, or null when mixed.
export type ActiveFormat = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  size: SizeKey | null;
  color: string | null;
};

// Mirrors the Selected Element panel's text-size control: a Scale (auto-fit)
// option + the 1/2/3-dot small / medium / large glyphs.
const SIZES: { key: SizeKey; label: string; icon: React.ReactNode }[] = [
  { key: 'scale', label: 'Scale', icon: <ScaleIcon /> },
  { key: 'sm', label: 'Small', icon: <DotsIcon count={1} /> },
  { key: 'md', label: 'Medium', icon: <DotsIcon count={2} /> },
  { key: 'lg', label: 'Large', icon: <DotsIcon count={3} /> },
];

const PADDINGS: { key: Padding; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'sm', label: 'Small' },
  { key: 'md', label: 'Medium' },
  { key: 'lg', label: 'Large' },
];

// preventDefault on mousedown keeps focus + the live selection in the
// contentEditable when a control is clicked (the classic rich-text-toolbar
// bug). Shared by every button so the editor never blurs mid-format.
const noFocusSteal = (e: React.MouseEvent) => e.preventDefault();

function EllipsisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="4" cy="8" r="1.4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="12" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}

// A serif "A" — the font/typeface glyph for the Font submenu row.
function FontGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <text x="8" y="12" textAnchor="middle" fontSize="12" fontFamily="Georgia, serif">
        A
      </text>
    </svg>
  );
}

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
// propagation). The trigger preventDefaults mousedown so the editor keeps its
// selection while the menu is open.
function ToolbarDropdown({
  label,
  description,
  trigger,
  menuClassName = 'min-w-[8rem]',
  children,
}: {
  label: string;
  description: string;
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
      <Tooltip title={label} description={description}>
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
      </Tooltip>
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
  currentFont,
  onToggle,
  onSize,
  onColor,
  onSetAlign,
  onSetPadding,
  onSetFont,
}: {
  active: ActiveFormat;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: Padding;
  currentFont: string | null;
  onToggle: (key: RunBoolKey) => void;
  onSize: (size: SizeKey) => void;
  onColor: (color: string) => void;
  onSetAlign: (x: TextAlignX, y: TextAlignY) => void;
  onSetPadding: (padding: Padding) => void;
  onSetFont: (font: string | null) => void;
}) {
  const toggles: { key: RunBoolKey; label: string; description: string; icon: React.ReactNode }[] =
    [
      { key: 'bold', label: 'Bold', description: 'Bold the selected text.', icon: <BoldIcon /> },
      {
        key: 'italic',
        label: 'Italic',
        description: 'Italicise the selected text.',
        icon: <ItalicIcon />,
      },
      {
        key: 'underline',
        label: 'Underline',
        description: 'Underline the selected text.',
        icon: <UnderlineIcon />,
      },
    ];
  const currentSize = SIZES.find((s) => s.key === active.size) ?? null;
  const divider = <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />;

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {/* ⋯ overflow menu (left) — holds the less-common Strikethrough. */}
      <ToolbarDropdown label="More" description="More text options." trigger={<EllipsisIcon />}>
        <button
          type="button"
          role="option"
          aria-selected={active.strikethrough}
          onMouseDown={noFocusSteal}
          onClick={() => onToggle('strikethrough')}
          className={optionClass(active.strikethrough)}
        >
          <StrikethroughIcon />
          <span className="flex-1">Strikethrough</span>
        </button>
        {/* Font — hover the row to reveal a flyout list of the fonts. */}
        <div className="group relative">
          <div className={`${optionClass(false)} cursor-default justify-between`}>
            <span className="flex items-center gap-2">
              <FontGlyph />
              Font
            </span>
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
              <path d="M4.5 3 7.5 6 4.5 9" />
            </svg>
          </div>
          <div className="invisible absolute left-full top-0 z-10 ml-0.5 max-h-64 min-w-[8rem] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900">
            {FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={currentFont === f.id}
                onMouseDown={noFocusSteal}
                onClick={() => onSetFont(f.id)}
                style={{ fontFamily: resolveFontStack(f.id) }}
                className={optionClass(currentFont === f.id)}
              >
                <span className="flex-1">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </ToolbarDropdown>
      {divider}
      {toggles.map((t) => (
        <Tooltip key={t.key} title={t.label} description={t.description}>
          <button
            type="button"
            aria-label={t.label}
            aria-pressed={active[t.key]}
            onMouseDown={noFocusSteal}
            onClick={() => onToggle(t.key)}
            className={btnClass(active[t.key])}
          >
            {t.icon}
          </button>
        </Tooltip>
      ))}
      {divider}
      {/* Size — icon-only trigger; labels live in the menu. */}
      <ToolbarDropdown
        label="Text size"
        description="Size of the selected text."
        trigger={currentSize?.icon ?? <DotsIcon count={2} />}
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
            {s.icon}
            <span className="flex-1">{s.label}</span>
          </button>
        ))}
      </ToolbarDropdown>
      {divider}
      {/* Alignment — the panel's 3×3 grid, reused. */}
      <ToolbarDropdown
        label="Alignment"
        description="Align the label inside the element."
        menuClassName="w-28 p-1.5"
        trigger={<AlignIcon x={alignX} y={alignY} />}
      >
        <AlignmentGrid alignX={alignX} alignY={alignY} onChange={onSetAlign} />
      </ToolbarDropdown>
      {divider}
      {/* Padding — icon-only trigger; menu options are "Padding: …". */}
      <ToolbarDropdown
        label="Padding"
        description="Space between the label and the element edge."
        menuClassName="min-w-[10rem]"
        trigger={padding === 'none' ? <NonePaddingIcon /> : <PaddingIcon size={padding} />}
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
            <span className="flex-1">Padding: {p.label}</span>
          </button>
        ))}
      </ToolbarDropdown>
      {divider}
      <Tooltip title="Text colour" description="Colour the selected text.">
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
      </Tooltip>
    </div>
  );
}
