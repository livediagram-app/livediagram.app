'use client';

// Show Me in a Sankey's Flows dialog (docs/specs/009-elements/sankey.md "Show Me"; docs/specs/007-editor/show-me.md):
// the tour of writing flows, drawn over the dialog. Never offered: only the button runs it. The dialog is loaded on
// demand, so its steps are imported with it rather than at the press.
import { useState } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import {
  sankeyFlowsTourSteps,
  type SankeyFlowsTourApi,
  type SankeyFlowsTourContext,
} from './sankey-flows-tour-steps';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import {
  useTourEngine,
  type TourEngine,
} from '@liveworkspace/workbench/components/tour/useTourEngine';

// The tour, and `freeze`, which fixes its steps from the dialog as it is when Show Me is pressed, so typing a flow
// mid-tour (which may add the first node or balance a node) never shifts the steps out from under the person.
export function useSankeyFlowsTour(
  context: SankeyFlowsTourContext,
  api: SankeyFlowsTourApi,
): { tour: TourEngine<SankeyFlowsTourApi>; freeze: () => void } {
  const apiRef = useLatest<SankeyFlowsTourApi>(api);
  const [steps, setSteps] = useState(() => sankeyFlowsTourSteps(context));
  const tour = useTourEngine<SankeyFlowsTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) =>
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'SankeyFlowsTourCompleted' : 'SankeyFlowsTourSkipped',
      ),
  });
  return { tour, freeze: () => setSteps(sankeyFlowsTourSteps(context)) };
}

export function SankeyFlowsShowMeButton({
  tour,
  onStart,
}: {
  tour: TourEngine<SankeyFlowsTourApi>;
  onStart: () => void;
}) {
  return (
    <ShowMeButton
      tour={tour}
      onStart={() => {
        track('UI', 'Started', 'SankeyFlowsTour');
        onStart();
      }}
    />
  );
}

export function SankeyFlowsTourStage({ tour }: { tour: TourEngine<SankeyFlowsTourApi> }) {
  return <ShowMeStage tour={tour} article="sankeyDiagram" />;
}
