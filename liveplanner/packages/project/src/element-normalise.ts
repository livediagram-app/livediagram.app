// A model's raw elements made safe to author (docs/specs/015-api/mcp-server.md §4.7a): one copy for livediagram and
// liveplanner, @liveworkspace/element-model/element-normalise, bound to this model's shape factory, shape kinds and
// stored-element migrations.
import { elementNormaliserFor } from '@liveworkspace/element-model/element-normalise';
import { createShape } from './shape-factory';
import { migrateStoredElementsUnsettled } from './stored-elements';
import { coerceShapeKind } from './validate';

export const { normaliseElement, lanesToFront, mergeElementUpdate, normaliseElements } =
  elementNormaliserFor({ createShape, coerceShapeKind, migrateStoredElementsUnsettled });
