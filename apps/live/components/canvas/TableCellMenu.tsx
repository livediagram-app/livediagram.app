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
import { ColourRow } from '@/components/palette/context-menu-input-rows';
import { FillColourIcon, TextColourIcon } from '@/components/palette/context-menu-icons';
import { useColourPalette } from '@/hooks/ui/useColourPalette';
import { TextSizeTiles } from '@/components/palette/context-menu-rows';
import { MenuAccordionSection, MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { AlignIcon, CellLinkIcon } from '@/components/canvas/table-icons';

// The per-cell context menu (docs/specs/008-canvas/canvas-and-palette.md Table): right-click / long-press a cell
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
  onPreviewStyle,
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
  // Show a patch over the selected cells without committing it, for the
  // colour rows' hover preview. `null` clears it.
  onPreviewStyle?: (patch: Partial<TableCellStyle> | null) => void;
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
  const { swatches } = useColourPalette();
  const [openColour, setOpenColour] = useState<string | null>(null);
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
      {/* The SAME colour palette every other element gets (docs/specs/008-canvas/canvas-and-palette.md Colours):
          theme presets, the colours you have used, transparent, the pipette
          and the OS picker. It used to be two bare `<input type="color">`
          chips, so colouring a cell meant matching a colour off the wheel
          that every other surface offered in one click. */}
      <MenuAccordionSection title="Colours" icon={<PaletteMenuIcon />} {...section('colours')}>
        <ColourRow
          label="Background"
          icon={<FillColourIcon />}
          value={sc?.bg ?? 'transparent'}
          open={openColour === 'bg'}
          onToggle={() => setOpenColour((c) => (c === 'bg' ? null : 'bg'))}
          onChange={(bg) => applyStyle({ bg })}
          onPreview={(bg) => onPreviewStyle?.({ bg })}
          onPreviewEnd={() => onPreviewStyle?.(null)}
          // Remembering the colour is ColourRow's job (it calls onAddCustom
          // after every commit), so this only has to end the preview and
          // write the cell.
          onCommit={(bg) => {
            onPreviewStyle?.(null);
            applyStyle({ bg });
          }}
          {...swatches}
        />
        <ColourRow
          label="Text"
          icon={<TextColourIcon />}
          value={sc?.textColor ?? textColor}
          open={openColour === 'text'}
          onToggle={() => setOpenColour((c) => (c === 'text' ? null : 'text'))}
          onChange={(color) => applyStyle({ textColor: color })}
          onPreview={(textColor) => onPreviewStyle?.({ textColor })}
          onPreviewEnd={() => onPreviewStyle?.(null)}
          onCommit={(color) => {
            onPreviewStyle?.(null);
            applyStyle({ textColor: color });
          }}
          {...swatches}
        />
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Text Alignment"
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
