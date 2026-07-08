import type { Element, Layer } from '@livediagram/diagram';
import { LayersGlyph } from '@/components/palette/context-menu-icons';
import { MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { useLayerThumbnails } from '@/hooks/ui/useLayerThumbnails';

// The context menu's "move selection to layer" control (spec/74), shared
// by the single-element and multi-selection Layer sections. One MenuTile
// per layer (top of the stack first, matching the panel) under a small
// section label — each tile's icon is that layer's mini preview (the
// same thumbnails the Layers panel rows render), falling back to the
// layers glyph on an empty tab. The selection's current layer is the
// active tile; clicking another moves the whole selection there and
// keeps the menu open, like the front / back tiles above it. Renders
// nothing until the tab actually has more than one layer.
export function MoveToLayerRow({
  layers,
  elements,
  currentLayerId,
  onMove,
}: {
  // Normalised layers, BOTTOM -> TOP (the data order); rendered reversed.
  layers: Layer[];
  // The tab's elements, for the per-tile layer previews.
  elements: Element[];
  // The selection's resolved layer, or null when members span layers
  // (then no tile is active).
  currentLayerId: string | null;
  onMove: (layerId: string) => void;
}) {
  const { thumbMarkup, thumbViewBox } = useLayerThumbnails(elements, layers);
  if (layers.length <= 1) return null;
  return (
    <div className="px-2 py-1.5">
      <p className="px-1 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Move to layer
      </p>
      <MenuTileGrid cols={2}>
        {[...layers].reverse().map((layer) => (
          <MenuTile
            key={layer.id}
            icon={
              thumbViewBox && thumbMarkup.get(layer.id) ? (
                <span className="flex h-7 w-11 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                  <svg
                    viewBox={thumbViewBox}
                    preserveAspectRatio="xMidYMid meet"
                    className="h-full w-full"
                    aria-hidden
                    dangerouslySetInnerHTML={{ __html: thumbMarkup.get(layer.id)! }}
                  />
                </span>
              ) : (
                <LayersGlyph />
              )
            }
            label={layer.name}
            active={layer.id === currentLayerId}
            onClick={() => onMove(layer.id)}
          />
        ))}
      </MenuTileGrid>
    </div>
  );
}
