'use client';

import { HoverCard } from '@livepages/ui';
import { LayersStackIcon } from '@/components/panels/layers-panel-icons';
import { CLUSTER_CONTROL_REST } from '@/components/canvas/cluster-strip';
import { ClusterPopoverSegment, ClusterStrip } from './ClusterPopoverButton';
import { ThemeLookIcon } from '@/components/palette/palette-icons';
import { useDockNames } from '@/hooks/ui/useDockNames';

// Layers and the Theme & canvas button, one strip in the bottom-right cluster
// (docs/specs/007-editor/live-app.md): both shape how the tab looks rather than what is on it, so
// they sit together. A canvas without Layers (Pages) or a session without the Theme & canvas button (a view-only
// visitor) keeps whichever of the two it has.
//
// Layers opens its panel as a popover above it (docs/specs/006-document/layers.md); the palette
// opens the CanvasThemeDialog (docs/specs/011-theme/canvas-and-theme-dialog.md).
export function LayersThemeStrip({
  layers,
  onOpenTheme,
}: {
  // The Layers button: its popover's state and toggle. Absent, the strip has none.
  layers?: { open: boolean; onToggle: (button: HTMLElement) => void } | undefined;
  // The Theme & canvas button. Absent, the strip has none.
  onOpenTheme?: (() => void) | undefined;
}) {
  const named = useDockNames();
  if (!layers && !onOpenTheme) return null;
  return (
    <ClusterStrip>
      {layers ? (
        <ClusterPopoverSegment
          label="Open Layers"
          name="Layers"
          hoverTitle="Open Layers"
          hoverDescription="Show this tab's layers."
          icon={<LayersStackIcon />}
          popoverOpen={layers.open}
          onTogglePopover={layers.onToggle}
        />
      ) : null}
      {onOpenTheme ? (
        <HoverCard
          title="Theme & canvas"
          description="Change this tab's theme and canvas background."
        >
          <button
            type="button"
            data-tour-id="canvas-theme"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onOpenTheme}
            aria-label="Theme and canvas"
            className={`flex h-11 items-center justify-center transition ${
              named ? 'gap-2 px-3.5 text-sm font-medium' : 'w-11'
            } ${layers ? 'border-l border-slate-100 dark:border-slate-800' : ''} ${CLUSTER_CONTROL_REST}`}
          >
            <ThemeLookIcon />
            {/* Named on a wide desktop, as the cluster's other buttons are (useDockNames). */}
            {named ? <span aria-hidden>Style</span> : null}
          </button>
        </HoverCard>
      ) : null}
    </ClusterStrip>
  );
}
