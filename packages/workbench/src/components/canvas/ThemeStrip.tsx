'use client';

import { HoverCard } from '@liveworkspace/ui';
import { CLUSTER_CONTROL_REST } from './cluster-strip';
import { ClusterStrip } from './ClusterPopoverButton';
import { ThemeLookIcon } from '@liveworkspace/ui';
import { useDockNames } from '../../hooks/ui/useDockNames';

// The Theme & canvas button, a strip of its own in the bottom-right cluster
// (each editor's docs/specs/007-editor/editor-app.md). It opens the CanvasThemeDialog
// (docs/specs/011-theme/canvas-and-theme-dialog.md). A session without the button (a view-only visitor) draws no
// strip.
export function ThemeStrip({
  onOpenTheme,
}: {
  // The Theme & canvas button. Absent, there is no strip.
  onOpenTheme?: (() => void) | undefined;
}) {
  const named = useDockNames();
  if (!onOpenTheme) return null;
  return (
    <ClusterStrip>
      <HoverCard
        title="Theme & Canvas"
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
