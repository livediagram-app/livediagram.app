'use client';

import { HoverCard } from '@livehuddle/ui';
import { CLUSTER_CONTROL_REST } from '@liveworkspace/workbench/components/canvas/cluster-strip';
import { ClusterStrip } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { ThemeLookIcon } from '@/components/palette/palette-icons';
import { useDockNames } from '@liveworkspace/workbench/hooks/ui/useDockNames';

// The Theme & canvas button's strip in the bottom-right cluster (docs/specs/007-editor/editor-app.md): it opens the
// CanvasThemeDialog (docs/specs/011-theme/canvas-and-theme-dialog.md). A session without it (a view-only visitor, a
// whiteboard) has no strip. livehuddle has no Tidy Up button to lead it (docs/specs/008-canvas/layout-cleanup.md
// "No Tidy Up button").
export function ThemeStrip({
  onOpenTheme,
}: {
  // The Theme & canvas button. Absent, the strip has none.
  onOpenTheme?: (() => void) | undefined;
}) {
  const named = useDockNames();
  if (!onOpenTheme) return null;
  return (
    <ClusterStrip>
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
          } ${CLUSTER_CONTROL_REST}`}
        >
          <ThemeLookIcon />
          {/* Named on a wide desktop, as the cluster's other buttons are (useDockNames). */}
          {named ? <span aria-hidden>Style</span> : null}
        </button>
      </HoverCard>
    </ClusterStrip>
  );
}
