import { createElementKeyedStore } from './element-keyed-store';

// What an element tour step shows on the concept graphic it is on (docs/specs/007-editor/element-tours.md), never
// stored, so nothing changes in the document: an animation previewed (`run` restarts it), or one chevron stage's bar
// held open as if the stage were pointed at.

export type ConceptTourPreview = {
  elementId: string;
  anim?: 'build' | 'pulse' | 'flow';
  bar?: number;
  run: number;
};

const store = createElementKeyedStore<ConceptTourPreview>(
  (a, b) => a.elementId === b.elementId && a.anim === b.anim && a.bar === b.bar && a.run === b.run,
);

export const setConceptTourPreview = store.set;
export const useConceptTourPreview = store.use;
