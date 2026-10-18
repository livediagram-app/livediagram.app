'use client';

import { HoverCard, TidyUpIcon } from '@livediagram/ui';
import { LayersStackIcon } from '@/components/panels/layers-panel-icons';
import { CLUSTER_CONTROL_REST } from '@/components/canvas/cluster-strip';
import { ClusterPopoverSegment, ClusterStrip } from './ClusterPopoverButton';
import { ThemeLookIcon } from '@/components/palette/palette-icons';
import { useDockNames } from '@/hooks/ui/useDockNames';

// Layers and the Theme & canvas button, one strip in the bottom-right cluster
// (docs/specs/007-editor/live-app.md): both shape how the tab looks rather than what is on it, so
// they sit together in every mode. A mode without Layers (Plan, Pages) or a session without
// the Theme & canvas button (a view-only visitor, a whiteboard) keeps whichever of the two it has.
//
// In Diagram mode an Editor's strip starts with Tidy Up (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up
// button"), left of Layers: how the tab is arranged sits with how it looks.
//
// Layers opens its panel as a popover above it (docs/specs/006-document/layers.md); the palette
// opens the CanvasThemeDialog (docs/specs/011-theme/canvas-and-theme-dialog.md).
export function LayersThemeStrip({
  tidyUp,
  layers,
  onOpenTheme,
}: {
  // The Tidy Up button: its popover's state and toggle. Absent, the strip has none.
  tidyUp?: { open: boolean; onToggle: (button: HTMLElement) => void } | undefined;
  // The Layers button: its popover's state and toggle. Absent, the strip has none.
  layers?: { open: boolean; onToggle: (button: HTMLElement) => void } | undefined;
  // The Theme & canvas button. Absent, the strip has none.
  onOpenTheme?: (() => void) | undefined;
}) {
  const named = useDockNames();
  if (!tidyUp && !layers && !onOpenTheme) return null;
  return (
    <ClusterStrip>
      {tidyUp ? (
        <ClusterPopoverSegment
          label="Tidy Up"
          name="Tidy Up"
          hoverTitle="Tidy Up"
          hoverDescription="Lay this tab out again in one press."
          icon={<TidyUpIcon />}
          dataTourId="tidy-up"
          popoverOpen={tidyUp.open}
          onTogglePopover={tidyUp.onToggle}
        />
      ) : null}
      {layers ? (
        <ClusterPopoverSegment
          divided={!!tidyUp}
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
            } ${layers || tidyUp ? 'border-l border-slate-100 dark:border-slate-800' : ''} ${CLUSTER_CONTROL_REST}`}
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
