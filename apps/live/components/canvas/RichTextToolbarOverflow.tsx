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
  DotsIcon,
  NonePaddingIcon,
  PaddingIcon,
  ScaleIcon,
  StrikethroughIcon,
} from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/primitives/PortalMenu';
import { FONTS, resolveFontStack } from '@/lib/fonts';
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
