'use client';

import { HoverCard, TidyUpIcon } from '@livehuddle/ui';
import { CLUSTER_CONTROL_REST } from '@liveworkspace/workbench/components/canvas/cluster-strip';
import {
  ClusterPopoverSegment,
  ClusterStrip,
} from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { ThemeLookIcon } from '@/components/palette/palette-icons';
import { useDockNames } from '@liveworkspace/workbench/hooks/ui/useDockNames';

// The Theme & canvas button's strip in the bottom-right cluster (docs/specs/007-editor/editor-app.md): it opens the
// CanvasThemeDialog (docs/specs/011-theme/canvas-and-theme-dialog.md). A session without it (a view-only visitor, a
// whiteboard) has no strip.
//
// Given a Tidy Up button it leads the strip; livehuddle gives none, since it was Diagram mode's
// (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up button").
export function ThemeStrip({
  tidyUp,
  onOpenTheme,
}: {
  // The Tidy Up button: its popover's state and toggle. Absent, the strip has none.
  tidyUp?: { open: boolean; onToggle: (button: HTMLElement) => void } | undefined;
  // The Theme & canvas button. Absent, the strip has none.
  onOpenTheme?: (() => void) | undefined;
}) {
  const named = useDockNames();
  if (!tidyUp && !onOpenTheme) return null;
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
            } ${tidyUp ? 'border-l border-slate-100 dark:border-slate-800' : ''} ${CLUSTER_CONTROL_REST}`}
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
