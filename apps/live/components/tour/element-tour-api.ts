import type { TourPreviewAnim } from '@/lib/concept-tour-preview';
import type { SankeyTourFocus } from '@/lib/sankey-tour-focus';
import type { SankeyFlowsTourApi } from './sankey-flows-tour-steps';

// What an element tour's steps may do (docs/specs/007-editor/element-tours.md), built fresh by ElementTourHost every
// render on the element the tour is on. One facade for every toured kind; each kind's steps use its own part.
export type ElementTourApi = SankeyFlowsTourApi & {
  // A Sankey: lift one band or node, or let it go.
  focus: (part: SankeyTourFocus['part'], index: number) => void;
  clearFocus: () => void;
  // A Sankey: open its Flows dialog, or close it as its Done does.
  openFlows: () => void;
  closeFlows: () => void;
  // A concept graphic or a chart: play an animation on it, never stored, or stop it.
  previewConcept: (anim: TourPreviewAnim) => void;
  // A line, area or scatter chart: open its Chart Data dialog, or close it as its Done does.
  openChartData: () => void;
  closeChartData: () => void;
  // A sequence diagram: open its Sequence dialog, close it as its Done does, or bring a tab forward.
  openSequence: () => void;
  closeSequence: () => void;
  showSequenceTab: (tab: 'messages' | 'text') => void;
  // A chevron process: hold one stage's bar open, as if pointed at.
  showStageBar: (index: number) => void;
  clearPreview: () => void;
};
