import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteSectionLabel, PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';

// The palette's creation-category tab bodies. Since spec/78 every tile is
// a data entry in the shared catalogue (palette-tile-defs.tsx) rendered
// through PaletteTileGrid, so each tab is just its catalogue slice — the
// per-tile JSX that used to live here (and in PaletteShapesTab /
// PaletteToolsTab / PaletteDataTab / DevicePickerTab) moved into the
// catalogue. The search-driven tabs (Icons / Technology) stay in
// CommandPalette since they own their search / filter state; the
// Favourites tab (spec/78) has its own file (PaletteFavouritesTab).

type TabProps = {
  pendingDraw: PendingDraw | null | undefined;
  actions: PaletteTileActions;
};

export function PaletteShapesTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="shapes" actions={actions} pendingDraw={pendingDraw} />;
}

// Two labelled sub-sections in one tab: the drawing/element Tools, then the
// Data charts (spec/53, folded in from the old standalone Data category so
// the palette spends one fewer top-level tab).
export function PaletteToolsTab({ pendingDraw, actions }: TabProps) {
  return (
    <div className="flex flex-col">
      <PaletteSectionLabel>Tools</PaletteSectionLabel>
      <PaletteTileGrid section="tools" actions={actions} pendingDraw={pendingDraw} />
      <PaletteSectionLabel>Data</PaletteSectionLabel>
      <PaletteTileGrid section="data" actions={actions} pendingDraw={pendingDraw} />
    </div>
  );
}

export function PaletteComponentsTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="components" actions={actions} pendingDraw={pendingDraw} />;
}

// Wireframing device-frame primitives (browser / monitor / laptop / phone /
// tablet / smartwatch) — see spec/09 "Devices".
export function DevicePickerTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="devices" actions={actions} pendingDraw={pendingDraw} />;
}
