import type { Layer } from '@livediagram/diagram';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';

// The context menu's "move selection to layer" row (spec/74), shared by
// the single-element and multi-selection Layer sections. Shows the
// selection's current layer in a dropdown (top layer first, matching
// the panel); picking another layer moves the whole selection there.
// Renders nothing until the tab actually has more than one layer — a
// one-option dropdown is dead chrome.
export function MoveToLayerRow({
  layers,
  currentLayerId,
  onMove,
}: {
  // Normalised layers, BOTTOM -> TOP (the data order).
  layers: Layer[];
  // The selection's resolved layer, or null when members span layers.
  currentLayerId: string | null;
  onMove: (layerId: string) => void;
}) {
  if (layers.length <= 1) return null;
  const options = [...layers].reverse().map((l) => ({ id: l.id, label: l.name }));
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Move to</span>
      <PaletteDropdown
        value={currentLayerId ?? ''}
        options={
          currentLayerId === null
            ? [{ id: '', label: 'Mixed layers', disabled: true }, ...options]
            : options
        }
        onChange={onMove}
        ariaLabel="Move selection to layer"
        tooltipTitle="Move to layer"
        tooltipDescription="Move the selected elements onto another layer."
        align="right"
        autoHeight
      />
    </div>
  );
}
