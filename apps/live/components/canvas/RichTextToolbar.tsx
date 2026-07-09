// The floating WYSIWYG toolbar shown above an element while its label is
// being edited (spec/09). Per-range bold / italic / underline /
// strikethrough + list controls as plain icon buttons, whole-element
// alignment as a dropdown, and the selection colour swatch. Everything
// else the old ⋯ overflow menu carried (Font / Size / Padding) lives in
// the element context menu's Text flyout now, so the toolbar holds only
// the live-selection verbs. Rendered by RichTextEditor (which owns the
// selection + apply handlers); this component is presentation + the
// focus-preservation detail.

import { useEffect, useRef, useState } from 'react';
import { AlignmentGrid } from '@/components/palette/palette-controls';
import { AlignIcon as AlignLinesIcon } from '@/components/canvas/table-icons';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { BulletListIcon, NoListIcon, NumberedListIcon } from './rich-text-toolbar-icons';
import type { ListStyle, RunBoolKey, TextAlignX, TextAlignY } from '@livediagram/diagram';

// The resolved formatting of the current selection: each boolean is true
// when EVERY character in the selection is effectively-on; color is the
// uniform value across the selection, or null when mixed.
export type ActiveFormat = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string | null;
};

// preventDefault on mousedown keeps focus + the live selection in the
// contentEditable when a control is clicked (the classic rich-text-toolbar
// bug). Shared by every button so the editor never blurs mid-format.
const noFocusSteal = (e: React.MouseEvent) => e.preventDefault();

// Matches the element toolbar's PopoverButton (h-8 w-8 rounded-md, same
// active + hover tones) so the two toolbars read as one system.
function btnClass(active: boolean): string {
  return `flex h-8 w-8 items-center justify-center rounded-md transition ${
    active
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
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
  hideChevron = false,
  children,
}: {
  label: string;
  description: string;
  trigger: React.ReactNode;
  menuClassName?: string;
  hideChevron?: boolean;
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
          className={`flex h-8 items-center gap-0.5 rounded-md px-1.5 transition ${
            open
              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          {trigger}
          {hideChevron ? null : CHEVRON}
        </button>
      </Tooltip>
      {open ? (
        <div
          role="listbox"
          // An option click bubbles here and closes the menu after its own
          // handler runs.
          onClick={() => setOpen(false)}
          className={`absolute left-0 top-full z-[var(--z-panel)] mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${menuClassName}`}
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
  onToggle,
  onApplyList,
  onColor,
  onSetAlign,
}: {
  active: ActiveFormat;
  alignX: TextAlignX;
  alignY: TextAlignY;
  onToggle: (key: RunBoolKey) => void;
  onApplyList: (style: ListStyle) => void;
  onColor: (color: string) => void;
  onSetAlign: (x: TextAlignX, y: TextAlignY) => void;
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
      {
        key: 'strikethrough',
        label: 'Strikethrough',
        description: 'Strike through the selected text.',
        icon: <StrikethroughIcon />,
      },
    ];
  // List controls (spec/09): applied to the selected lines. Plain icon
  // buttons since the ⋯ menu that used to hold them is gone.
  const lists: { style: ListStyle; label: string; description: string; icon: React.ReactNode }[] = [
    {
      style: 'bullet',
      label: 'Bullet list',
      description: 'Turn the selected lines into a bullet list.',
      icon: <BulletListIcon />,
    },
    {
      style: 'numbered',
      label: 'Numbered list',
      description: 'Turn the selected lines into a numbered list.',
      icon: <NumberedListIcon />,
    },
    {
      style: 'none',
      label: 'Remove list',
      description: 'Turn the selected lines back into plain text.',
      icon: <NoListIcon />,
    },
  ];
  // Same spacer the element toolbar's Divider uses, so both read alike.
  const divider = (
    <span className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden />
  );

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
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
      {lists.map((l) => (
        <Tooltip key={l.style} title={l.label} description={l.description}>
          <button
            type="button"
            aria-label={l.label}
            onMouseDown={noFocusSteal}
            onClick={() => onApplyList(l.style)}
            className={btnClass(false)}
          >
            {l.icon}
          </button>
        </Tooltip>
      ))}
      {divider}
      {/* Alignment — the shared 3×3 grid, reused. The trigger is the
          familiar word-processor glyph (stacked lines whose ends follow the
          horizontal alignment), not the positional box-dot the grid cells
          use, so the control reads as "alignment" at a glance. */}
      <ToolbarDropdown
        label="Alignment"
        description="Align the label inside the element."
        menuClassName="w-28 p-1.5"
        trigger={<AlignLinesIcon dir={alignX} />}
      >
        <AlignmentGrid alignX={alignX} alignY={alignY} onChange={onSetAlign} />
      </ToolbarDropdown>
      {divider}
      <Tooltip title="Text colour" description="Colour the selected text.">
        <label
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
