import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { TableCellStyle, TableElement, TextSize } from '@livediagram/diagram';
import { ContextMenu, ContextMenuDivider } from '@/components/palette/ContextMenu';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  TextGlyph,
  PaletteMenuIcon,
  RemoveIconGlyph,
} from '@/components/palette/context-menu-icons';
import { TextSizeTiles } from '@/components/palette/context-menu-rows';
import { MenuAccordionSection, MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { AlignIcon, CellLinkIcon } from '@/components/canvas/table-icons';

// The per-cell context menu (spec/09 Table): right-click / long-press a cell
// opens THIS at the pointer — the same accordion-category menu language as
// the element/tab context menus, replacing the old floating cell toolbar.
// Every control applies to the WHOLE cell selection (shift-click builds a
// multi-cell set), reading its display value off the anchor cell; Link is
// per-cell identity, so it shows only for a single selected cell.
//
// Rendered through a portal: ContextMenu positions itself `fixed` at screen
// coords, and TableView lives inside the canvas's transformed wrapper, where
// fixed would resolve against the transform instead of the viewport.
export function TableCellMenu({
  element,
  cells,
  anchor,
  position,
  onClose,
  applyStyle,
  onClear,
  onLinkCell,
  textColor,
}: {
  element: TableElement;
  // Every selected cell (anchor first). The menu acts on all of them.
  cells: { r: number; c: number }[];
  // The cell whose current values the controls display.
  anchor: { r: number; c: number };
  // Screen coords of the opening right-click / long-press.
  position: { x: number; y: number };
  onClose: () => void;
  // Apply a style patch to every selected cell (one commit).
  applyStyle: (patch: Partial<TableCellStyle>) => void;
  // Clear text + formatting of every selected cell (one commit).
  onClear: () => void;
  // Open the link picker for the anchor cell; absent in read-only sessions.
  onLinkCell?: (tableId: string, r: number, c: number) => void;
  textColor: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const section = (key: string) => ({
    open: open === key,
    onToggle: () => setOpen((o) => (o === key ? null : key)),
    flush: true,
  });
  const sc = element.cellStyles?.[anchor.r]?.[anchor.c] ?? null;
  const isHeaderAnchor =
    (element.headerRow && anchor.r === 0) || (element.headerColumn && anchor.c === 0);
  const boldOn = sc?.bold ?? (isHeaderAnchor || (element.textBold ?? false));
  const italicOn = sc?.italic ?? element.textItalic ?? false;
  const underlineOn = sc?.underline ?? element.textUnderline ?? false;
  const single = cells.length === 1;
  const toggleCls = (on: boolean) =>
    `flex h-7 flex-1 items-center justify-center rounded text-sm ${
      on
        ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/30 dark:text-brand-200'
        : 'text-slate-600 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700'
    }`;
  return createPortal(
    <ContextMenu position={position} onClose={onClose} flush>
      <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {single ? 'Selected Cell' : `${cells.length} Cells`}
      </p>
      <MenuAccordionSection title="Text" icon={<TextGlyph />} {...section('text')}>
        <div className="flex gap-1 px-2 py-1.5">
          <button
            type="button"
            aria-pressed={boldOn}
            className={toggleCls(boldOn)}
            onClick={() => applyStyle({ bold: !boldOn })}
          >
            <span className="font-bold">B</span>
          </button>
          <button
            type="button"
            aria-pressed={italicOn}
            className={toggleCls(italicOn)}
            onClick={() => applyStyle({ italic: !italicOn })}
          >
            <span className="italic">I</span>
          </button>
          <button
            type="button"
            aria-pressed={underlineOn}
            className={toggleCls(underlineOn)}
            onClick={() => applyStyle({ underline: !underlineOn })}
          >
            <span className="underline">U</span>
          </button>
        </div>
        <p className="px-3 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">Size</p>
        <TextSizeTiles
          current={(sc?.textSize ?? element.textSize ?? 'md') as TextSize}
          onSet={(size) => applyStyle({ textSize: size })}
        />
      </MenuAccordionSection>
      <MenuAccordionSection title="Colours" icon={<PaletteMenuIcon />} {...section('colours')}>
        <label className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          Background
          <span
            className="relative h-5 w-5 overflow-hidden rounded border border-slate-300"
            style={{ backgroundColor: sc?.bg ?? '#ffffff' }}
          >
            <input
              type="color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={sc?.bg ?? '#ffffff'}
              onChange={(e) => applyStyle({ bg: e.target.value })}
              aria-label="Cell background colour"
            />
          </span>
        </label>
        <label className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          Text
          <span
            className="relative h-5 w-5 overflow-hidden rounded border border-slate-300"
            style={{ backgroundColor: sc?.textColor ?? textColor }}
          >
            <input
              type="color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={sc?.textColor ?? textColor}
              onChange={(e) => applyStyle({ textColor: e.target.value })}
              aria-label="Cell text colour"
            />
          </span>
        </label>
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Alignment"
        icon={<AlignIcon dir={sc?.alignX ?? element.textAlignX ?? 'center'} />}
        {...section('align')}
      >
        <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
          {(['left', 'center', 'right'] as const).map((al) => (
            <SizeButton
              key={al}
              active={(sc?.alignX ?? element.textAlignX ?? 'center') === al}
              onClick={() => applyStyle({ alignX: al })}
            >
              <AlignIcon dir={al} />
            </SizeButton>
          ))}
        </div>
      </MenuAccordionSection>
      <ContextMenuDivider />
      <MenuTileGrid cols={2}>
        {onLinkCell && single ? (
          <MenuTile
            icon={<CellLinkIcon />}
            label={sc?.link ? 'Edit Link' : 'Link Cell'}
            onClick={() => {
              onLinkCell(element.id, anchor.r, anchor.c);
              onClose();
            }}
          />
        ) : null}
        <MenuTile
          icon={<RemoveIconGlyph />}
          label={single ? 'Clear Cell' : 'Clear Cells'}
          onClick={() => {
            onClear();
            onClose();
          }}
        />
      </MenuTileGrid>
    </ContextMenu>,
    document.body,
  );
}
