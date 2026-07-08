import { useEffect, useRef, useState } from 'react';
import {
  BulletListIcon,
  EllipsisIcon,
  NoListIcon,
  NumberedListIcon,
} from './rich-text-toolbar-icons';
import { AlignmentGrid } from '@/components/palette/palette-controls';
import { AlignIcon as AlignLinesIcon } from '@/components/canvas/table-icons';
import { StrikethroughIcon } from '@/components/palette/palette-icons';
import { TypographySections } from '@/components/palette/TypographySections';
import { Tooltip } from '@/components/primitives/Tooltip';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/primitives/PortalMenu';
import type { ListStyle, Padding, RunBoolKey, TextAlignX, TextAlignY } from '@livediagram/diagram';
import type { ActiveFormat, SizeKey } from './RichTextToolbar';

// The rich-text toolbar's ⋯ overflow menu, lifted out of
// RichTextToolbar: the less-common Format band (strikethrough + lists)
// and the typography band (Font / Size / Padding / Alignment), as
// accordion category sections matching the element / canvas context
// menus. The focus-preservation rules it relies on are documented at
// the top of RichTextToolbar.

const noFocusSteal = (e: React.MouseEvent) => e.preventDefault();

// The editor's text-size control: a Scale (auto-fit) option + the
// 1/2/3-dot small / medium / large glyphs.
// The ⋯ overflow menu: the less-common text options grouped into collapsible
// category sections, matching the element / canvas context menus rather than a
// flat list — a Format band (strikethrough + lists), then a separator, then a
// typography band (Font / Size / Padding). Kept INLINE (not portalled)
// so the editor's focus + canvas-propagation guards apply; every control
// preventDefaults mousedown so the live text selection survives a click, and
// the category headers do too (via MenuAccordionSection's preserveFocus).
export function OverflowMenu({
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
          {/* ── Typography band: Font / Size / Padding (shared with the
              element context menu's Text flyout) ── */}
          <MenuGroupSeparator />
          <TypographySections
            currentFont={currentFont}
            currentSize={active.size}
            padding={padding}
            onSetFont={onSetFont}
            onSetSize={onSize}
            onSetPadding={onSetPadding}
            sectionProps={catProps}
            preserveFocus
            onAfterPick={close}
          />
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
