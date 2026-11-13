// One copy for every product: @liveworkspace/element-model/element-ops, bound to this product's Element.
import {
  createElementOps,
  type ElementOp as SharedElementOp,
  type RoomElementOp as SharedRoomElementOp,
} from '@liveworkspace/element-model/element-ops';
import type { Element } from './index';

export { diffToElementOps, type ElementPatchOp } from '@liveworkspace/element-model/element-ops';
export type ElementOp = SharedElementOp<Element>;
export type RoomElementOp = SharedRoomElementOp<Element>;

export const { applyElementOp, applyRoomElementOp, applyElementOps, invertElementOps } =
  createElementOps<Element>();
