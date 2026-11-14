'use client';

// Show Me in a Sankey's Flows dialog (docs/specs/009-elements/sankey.md "Show Me"; docs/specs/007-editor/show-me.md):
// the tour of writing flows, drawn over the dialog. Never offered: only the button runs it. The dialog is loaded on
// demand, so its steps are imported with it rather than at the press. Each editor binds it once, in its
// components/tour/SankeyFlowsTour.tsx, with its own Show Me parts and its own `track`.
import { useState, type ReactNode } from 'react';
import { useLatest } from '../../hooks/ui/useLatest';
import {
  sankeyFlowsTourSteps,
  type SankeyFlowsTourApi,
  type SankeyFlowsTourContext,
} from './sankey-flows-tour-steps';
import { useTourEngine, type TourEngine } from './useTourEngine';

type Tour = TourEngine<SankeyFlowsTourApi>;

export type SankeyFlowsTourDeps = {
  /** The editor's Show Me button (its components/tour/ShowMe.tsx). */
  ShowMeButton: (props: { tour: Tour; onStart: () => void }) => ReactNode;
  /** The editor's Show Me stage, closing on the Sankey help article. */
  ShowMeStage: (props: { tour: Tour; article: 'sankeyDiagram' }) => ReactNode;
  /** The editor's telemetry, for the tour's Started and Ended events. */
  track: (category: 'UI', action: 'Started' | 'Ended', type: string) => void;
};

export function createSankeyFlowsTour({ ShowMeButton, ShowMeStage, track }: SankeyFlowsTourDeps) {
  // The tour, and `freeze`, which fixes its steps from the dialog as it is when Show Me is pressed, so typing a flow
  // mid-tour (which may add the first node or balance a node) never shifts the steps out from under the person.
  function useSankeyFlowsTour(
    context: SankeyFlowsTourContext,
    api: SankeyFlowsTourApi,
  ): { tour: Tour; freeze: () => void } {
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

  function SankeyFlowsShowMeButton({ tour, onStart }: { tour: Tour; onStart: () => void }) {
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

  function SankeyFlowsTourStage({ tour }: { tour: Tour }) {
    return <ShowMeStage tour={tour} article="sankeyDiagram" />;
  }

  return { useSankeyFlowsTour, SankeyFlowsShowMeButton, SankeyFlowsTourStage };
}
