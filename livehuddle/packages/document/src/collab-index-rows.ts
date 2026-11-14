// What one tab contributes to the collaboration index (docs/specs/013-workspace/inbox.md §2): one copy for every
// product, @liveworkspace/element-model/collab-index-rows, bound to this model's boxed elements.
import { collabIndexRowsFor } from '@liveworkspace/element-model/collab-index-rows';
import { isBoxed, type Element } from './index';

export type {
  CollabActionRow,
  CollabIndexRows,
  CollabThreadRow,
} from '@liveworkspace/element-model/collab-index-rows';

export const collabIndexRowsFromElements = collabIndexRowsFor<Element>(isBoxed);
