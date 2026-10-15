import { createElementKeyedStore } from './element-keyed-store';

// What a Sankey tour step lifts on the canvas (docs/specs/007-editor/element-tours.md "The Sankey tour"): one band or
// one node of one diagram, drawn as a hover would draw it, readout and all, while the step is up.

export type SankeyTourFocus = {
  elementId: string;
  part: 'band' | 'node';
  index: number;
};

const store = createElementKeyedStore<SankeyTourFocus>(
  (a, b) => a.elementId === b.elementId && a.part === b.part && a.index === b.index,
);

export const setSankeyTourFocus = store.set;

/** The lifted part of this diagram, or null (a diagram the tour is not on never re-renders for it). */
export const useSankeyTourFocus = store.use;
