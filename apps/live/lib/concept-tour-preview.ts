import { createElementKeyedStore } from './element-keyed-store';

// A concept graphic's animation, previewed by an element tour step (docs/specs/007-editor/element-tours.md): played
// once on the element the tour is on, never stored, so nothing changes in the document. `run` restarts it.

export type ConceptTourPreview = {
  elementId: string;
  anim: 'build' | 'pulse';
  run: number;
};

const store = createElementKeyedStore<ConceptTourPreview>(
  (a, b) => a.elementId === b.elementId && a.anim === b.anim && a.run === b.run,
);

export const setConceptTourPreview = store.set;
export const conceptTourPreview = store.get;
export const useConceptTourPreview = store.use;
