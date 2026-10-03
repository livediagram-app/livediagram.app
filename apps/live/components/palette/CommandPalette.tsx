import { PaletteTintProvider } from '@/components/palette/palette-controls';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { PaletteTabBar } from '@/components/palette/PaletteTabBar';
import { PaletteGroupProvider } from '@/components/palette/palette-group-state';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';
import { EditorModeSwitch } from '@/components/chrome/editor-mode/EditorModeSwitch';

import type { CanvasTool, CommandPaletteProps } from './CommandPalette.types';
import { usePaletteCatalogue } from './usePaletteCatalogue';
import { paletteLandingCategory } from './palette-mode-categories';

export type { CanvasTool };

export function CommandPalette(props: CommandPaletteProps) {
  const { position, onMoveTo, onReset, esBoard, onSize, themeTint, dock, drawTools } = props;
  // Handlers, categories and the canvas-tool options are shared with the
  // Toolbar layout's strip (docs/specs/007-editor/toolbar-layout.md) — see usePaletteCatalogue.
  const { tabs, editorMode, canvasToolOptions, onCanvasToolChange } = usePaletteCatalogue(props);
  const { canvasTool } = props;
  return (
    <MovablePanel
      helpArticle="palette"
      // Above the other panels by default (docs/specs/008-canvas/canvas-and-palette.md): the palette is the one
      // you reach for while another panel happens to be open.
      elevated
      title="Palette"
      dataTourId="palette"
      position={position}
      defaultCorner="top-right"
      width="w-auto sm:w-64"
      onSize={onSize}
      flushTop
      growBody
      onMoveTo={onMoveTo}
      {...dock}
      // Reset-position is the panel header's own button (MovablePanel shows
      // it only once the palette has left its home corner). The settings
      // popover that used to carry it, and the preferences inside it, moved
      // to the Settings dialog (docs/specs/007-editor/user-preferences.md).
      onReset={onReset}
      collapsible
      // The editor mode switch, labelled, beside the panel title, where the header has the room
      // (docs/specs/007-editor/editor-modes.md "The mode switch"); nothing on a board.
      headerActions={<EditorModeSwitch labelled align="right" />}
    >
      {/* Header band: canvas-tool picker (Select / Hand / Laser) on the
          left, category picker on the right. The tool dropdown is a mode
          switch, not an element-add control, so it stays a permanent
          fixture; Select is the default and Space pans regardless of the
          active tool, mirroring Figma. Favourites is the default category
          (the user's own go-to tiles, docs/specs/010-palette/palette-favourites.md). */}
      {/* At most one collapsible tile group open across the palette
          (palette-group-state): Behaviour's two groups hold eight tiles
          between them and both open ran the category past the panel. */}
      {drawTools ?? (
        <PaletteGroupProvider>
          <PaletteTintProvider tint={themeTint}>
            <PaletteTabBar
              // No storageKey: the palette always opens on Favourites when a
              // document loads (the user's go-to tiles, docs/specs/010-palette/palette-favourites.md) rather than
              // restoring the last-used category across documents — EXCEPT on
              // an event-storming board (docs/specs/021-event-storming/event-storming.md), where the notation is the
              // whole point: it opens on the Event Storming category. Keyed so
              // crossing an ES / non-ES tab boundary re-lands on the right
              // default rather than whatever was open on the other tab. Keyed on the editor mode
              // too: a mode offers its own categories, so a switch re-lands on Favourites rather
              // than on a category the new mode leaves out.
              key={esBoard ? 'es-board' : editorMode}
              defaultOpenId={paletteLandingCategory(editorMode, !!esBoard)}
              // Distraction-free capture surface (docs/specs/021-event-storming/event-storming.md): an ES board hides
              // both dropdowns — the notation IS the palette there.
              hideHeader={esBoard}
              leading={
                <PaletteDropdown
                  ariaLabel="Canvas tool"
                  dataTourId="canvas-tool"
                  value={canvasTool}
                  variant="flush"
                  autoHeight
                  // Tile grid (docs/specs/004-interface-design/dropdown-tile-grid.md): nine tools in one column was a lot of
                  // travel for a flat choice between equal-weight modes.
                  grid
                  // The three bands the tools fall into (docs/specs/004-interface-design/dropdown-tile-grid.md): what you do TO
                  // the document, what you do in front of an audience, and the
                  // whole-canvas views.
                  groupLabels={{ 0: 'Edit', 1: 'Present', 2: 'Preview' }}
                  // 'zen' is an action entry, not a tool (see usePaletteCatalogue).
                  onChange={onCanvasToolChange}
                  options={canvasToolOptions}
                />
              }
              // Ordered by BAND (docs/specs/010-palette/palette-top-level-categories.md): Common, then Decorate, then Dynamic
              // (the headings PaletteTabBar's CATEGORY_BANDS actually renders).
              // It renders the dropdown straight from this order, so the array IS
              // the grid layout.
              tabs={tabs}
            />
          </PaletteTintProvider>
        </PaletteGroupProvider>
      )}
    </MovablePanel>
  );
}
