// Freehand runs (docs/specs/024-agents/blueprints/document-views.md "Freehand runs", VW56), shared in
// `@liveworkspace/document-views`; a run's strokes default to this product's placed elements.
import type { FreehandRun as FreehandRunOf } from '@liveworkspace/document-views/freehand-runs';
import type { Placed } from './reading-order';

export { freehandRuns, isBareStroke } from '@liveworkspace/document-views/freehand-runs';
export type FreehandRun<T extends Placed = Placed> = FreehandRunOf<T>;
