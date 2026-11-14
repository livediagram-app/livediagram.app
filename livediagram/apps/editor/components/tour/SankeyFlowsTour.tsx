'use client';

// Show Me in a Sankey's Flows dialog (docs/specs/009-elements/sankey.md "Show Me"): the workbench's tour, bound
// once to this editor's Show Me parts and telemetry.
import { createSankeyFlowsTour } from '@liveworkspace/workbench/components/tour/SankeyFlowsTour';
import { track } from '@/lib/telemetry';
import { ShowMeButton, ShowMeStage } from './ShowMe';

export const { useSankeyFlowsTour, SankeyFlowsShowMeButton, SankeyFlowsTourStage } =
  createSankeyFlowsTour({ ShowMeButton, ShowMeStage, track });
