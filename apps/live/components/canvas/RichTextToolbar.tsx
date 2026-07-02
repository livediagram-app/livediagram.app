// The floating WYSIWYG toolbar shown above an element while its label is
// being edited (spec/09). Per-range bold / italic / underline (+ strikethrough
// under the ⋯ menu) / size / colour, plus whole-element alignment + padding as
// dropdowns. Rendered by RichTextEditor (which owns the selection + apply
// handlers); this component is presentation + the focus-preservation detail.

import { useEffect, useRef, useState } from 'react';
import {
  BulletListIcon,
  EllipsisIcon,
  FontGlyph,
  NoListIcon,
  NumberedListIcon,
} from './rich-text-toolbar-icons';
import { AlignmentGrid } from '@/components/palette/palette-controls';
import { AlignIcon as AlignLinesIcon } from '@/components/canvas/table-icons';
import {
  BoldIcon,
  DotsIcon,
  ItalicIcon,
  NonePaddingIcon,
  PaddingIcon,
  ScaleIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/primitives/PortalMenu';
import { FONTS, resolveFontStack } from '@/lib/fonts';
import type {
  ListStyle,
  Padding,
  RunBoolKey,
  RunSize,
  TextAlignX,
  TextAlignY,
} from '@livediagram/diagram';

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

// The editor's text-size control: a Scale (auto-fit) option + the
// 1/2/3-dot small / medium / large glyphs.
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

// The ⋯ overflow menu: the less-common text options grouped into collapsible
// category sections, matching the element / canvas context menus rather than a
// flat list — a Format band (strikethrough + lists), then a separator, then a
// typography band (Font / Size / Padding). Kept INLINE (not portalled)
// so the editor's focus + canvas-propagation guards apply; every control
// preventDefaults mousedown so the live text selection survives a click, and
// the category headers do too (via MenuAccordionSection's preserveFocus).
function OverflowMenu({
  active,
  currentFont,
  padding,
  alignX,
  alignY,
  onToggle,
  onApplyList,
  onSetFont,
  onSetPadding,
  onSize,
  onSetAlign,
}: {
  active: ActiveFormat;
  currentFont: string | null;
  padding: Padding;
  // Whole-element alignment, mirrored from the toolbar's dropdown so the
  // control is discoverable here too (spec/09).
  alignX: TextAlignX;
  alignY: TextAlignY;
  onToggle: (key: RunBoolKey) => void;
  onApplyList: (style: ListStyle) => void;
  onSetFont: (font: string | null) => void;
  onSetPadding: (padding: Padding) => void;
  onSize: (size: SizeKey) => void;
  onSetAlign: (x: TextAlignX, y: TextAlignY) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);
  const close = () => setOpen(false);
  const catProps = (id: string) => ({
    open: openCat === id,
    onToggle: () => setOpenCat((c) => (c === id ? null : id)),
    preserveFocus: true,
    // Rows sit flush; the only rule is the MenuGroupSeparator band, matching
    // the element + tab context menus.
    flush: true,
  });
  return (
    <div className="relative" ref={rootRef}>
      <Tooltip title="More" description="More text options.">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More"
          onMouseDown={noFocusSteal}
          onClick={() => setOpen((o) => !o)}
          className={`flex h-8 items-center gap-0.5 rounded-md px-1.5 transition ${
            open
              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <EllipsisIcon />
        </button>
      </Tooltip>
      {open ? (
        <div className="lvd-menu-stagger animate-fade-in absolute left-0 top-full z-[var(--z-panel)] mt-1 w-44 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <MenuAccordionSection title="Format" icon={<StrikethroughIcon />} {...catProps('format')}>
            <MenuTileGrid cols={2}>
              <MenuTile
                preserveFocus
                active={active.strikethrough}
                label="Strikethrough"
                icon={<StrikethroughIcon />}
                onClick={() => {
                  onToggle('strikethrough');
                  close();
                }}
              />
              <MenuTile
                preserveFocus
                label="Bullet list"
                icon={<BulletListIcon />}
                onClick={() => {
                  onApplyList('bullet');
                  close();
                }}
              />
              <MenuTile
                preserveFocus
                label="Numbered"
                icon={<NumberedListIcon />}
                onClick={() => {
                  onApplyList('numbered');
                  close();
                }}
              />
              <MenuTile
                preserveFocus
                label="Remove list"
                icon={<NoListIcon />}
                onClick={() => {
                  onApplyList('none');
                  close();
                }}
              />
            </MenuTileGrid>
          </MenuAccordionSection>
          {/* ── Typography band: Font / Size / Padding ── */}
          <MenuGroupSeparator />
          <MenuAccordionSection title="Font" icon={<FontGlyph />} {...catProps('font')}>
            <MenuTileGrid cols={2}>
              {FONTS.map((f) => (
                <MenuTile
                  key={f.id}
                  preserveFocus
                  active={currentFont === f.id}
                  label={f.label}
                  icon={
                    <span style={{ fontFamily: resolveFontStack(f.id) }} className="text-sm">
                      Aa
                    </span>
                  }
                  onClick={() => {
                    onSetFont(f.id);
                    close();
                  }}
                />
              ))}
            </MenuTileGrid>
          </MenuAccordionSection>
          <MenuAccordionSection title="Size" icon={<DotsIcon count={2} />} {...catProps('size')}>
            <MenuTileGrid cols={2}>
              {SIZES.map((s) => (
                <MenuTile
                  key={s.key}
                  preserveFocus
                  active={active.size === s.key}
                  label={s.label}
                  icon={s.icon}
                  onClick={() => {
                    onSize(s.key);
                    close();
                  }}
                />
              ))}
            </MenuTileGrid>
          </MenuAccordionSection>
          <MenuAccordionSection
            title="Padding"
            icon={padding === 'none' ? <NonePaddingIcon /> : <PaddingIcon size={padding} />}
            {...catProps('padding')}
          >
            <MenuTileGrid cols={2}>
              {PADDINGS.map((p) => (
                <MenuTile
                  key={p.key}
                  preserveFocus
                  active={padding === p.key}
                  label={p.label}
                  icon={p.key === 'none' ? <NonePaddingIcon /> : <PaddingIcon size={p.key} />}
                  onClick={() => {
                    onSetPadding(p.key);
                    close();
                  }}
                />
              ))}
            </MenuTileGrid>
          </MenuAccordionSection>
          {/* Alignment — the toolbar dropdown's 3×3 grid, here too for
              discovery (spec/09). Stays open after a pick (like the
              dropdown) so a user can try corners. */}
          <MenuAccordionSection
            title="Alignment"
            icon={<AlignLinesIcon dir={alignX} />}
            {...catProps('align')}
          >
            <div className="px-2 py-1.5">
              <AlignmentGrid alignX={alignX} alignY={alignY} onChange={onSetAlign} />
            </div>
          </MenuAccordionSection>
        </div>
      ) : null}
    </div>
  );
}

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
  padding,
  currentFont,
  onToggle,
  onApplyList,
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
  onApplyList: (style: ListStyle) => void;
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
  // Same spacer the element toolbar's Divider uses, so both read alike.
  const divider = (
    <span className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden />
  );

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
      {/* ⋯ overflow menu (left) — the less-common Strikethrough / Font /
          Padding, grouped into collapsible category sections. */}
      <OverflowMenu
        active={active}
        onApplyList={onApplyList}
        currentFont={currentFont}
        padding={padding}
        alignX={alignX}
        alignY={alignY}
        onToggle={onToggle}
        onSetFont={onSetFont}
        onSetPadding={onSetPadding}
        onSize={onSize}
        onSetAlign={onSetAlign}
      />
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
