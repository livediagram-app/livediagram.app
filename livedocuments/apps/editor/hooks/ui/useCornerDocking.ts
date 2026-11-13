'use client';

import { createUseCornerDocking } from '@liveworkspace/workbench/hooks/ui/useCornerDocking';
import { DEFAULT_PANEL_CORNER, PANEL_CORNERS, STACK_GAP_PX } from '@/lib/panel-layout';
import { usePanelDock } from '@/hooks/ui/usePanelDock';
import { track } from '@/lib/telemetry';

// Corner docking wiring (docs/specs/007-editor/panel-docking.md), bound to this editor's panels.
export const useCornerDocking = createUseCornerDocking({
  usePanelDock,
  DEFAULT_PANEL_CORNER,
  PANEL_CORNERS,
  STACK_GAP_PX,
  track,
});
