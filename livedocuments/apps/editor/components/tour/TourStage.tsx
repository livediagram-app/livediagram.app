'use client';

import type { ComponentProps } from 'react';
import { TourStage as SharedTourStage } from '@liveworkspace/workbench/components/tour/TourStage';
import { useStartPalette } from '@/components/start/useStartPalette';
import { tourColourVars } from '@liveworkspace/workbench/components/tour/tour-colours';

// The shared tour stage (@liveworkspace/workbench, docs/specs/007-editor/pages-tour.md "Mechanics") in this editor's
// colours: the card and the ring wear the active tab's palette, as the start panels do (the shared tour-colours.ts).
export function TourStage<Api>(
  props: Omit<ComponentProps<typeof SharedTourStage<Api>>, 'colours'>,
) {
  const colours = tourColourVars(useStartPalette());
  return <SharedTourStage {...props} colours={colours} />;
}
