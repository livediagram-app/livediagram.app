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
  // A concept graphic: play an animation on it once, never stored, or stop it.
  previewConcept: (anim: 'build' | 'pulse' | 'flow') => void;
  clearPreview: () => void;
};
