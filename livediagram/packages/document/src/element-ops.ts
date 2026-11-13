// One copy for every product: @liveworkspace/element-model/element-ops, bound to this product's Element.
import {
  createElementOps,
  type ElementOp as SharedElementOp,
  type RoomElementOp as SharedRoomElementOp,
} from '@liveworkspace/element-model/element-ops';
import { preferNewerQa } from './qa-board';
import type { Element } from './index';

export { diffToElementOps, type ElementPatchOp } from '@liveworkspace/element-model/element-ops';
export type ElementOp = SharedElementOp<Element>;
export type RoomElementOp = SharedRoomElementOp<Element>;

// A Q&A board keeps whichever notes carry the newer rev (docs/specs/012-collaboration/qa-board.md): a peer who
// moved the board before a vote reached them must not send that vote back out of existence.
export const { applyElementOp, applyRoomElementOp, applyElementOps, invertElementOps } =
  createElementOps<Element>(preferNewerQa);
