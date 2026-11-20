'use client';

// Show Me in the Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md "Show Me"): the workbench's tour,
// bound once to this editor's Show Me parts and telemetry.
import { createTabStyleTour } from '@liveworkspace/workbench/components/tour/TabStyleTour';
import { track } from '@/lib/telemetry';
import { ShowMeButton, ShowMeStage } from './ShowMe';

export const { useTabStyleTour, TabStyleShowMeButton, TabStyleTourStage } = createTabStyleTour({
  ShowMeButton,
  ShowMeStage,
  track,
});
