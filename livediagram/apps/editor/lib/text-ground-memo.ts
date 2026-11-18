// The ground under a text, remembered while what makes it stays the same (docs/specs/004-interface-design/blueprints/
// colour-picker.md "Performance and limits"): one copy for every product, @liveworkspace/element-model/
// text-ground-memo, bound here to this model's grounds.
import {
  textGroundMemoFor,
  textGroundOf,
  type BoxedElement,
  type Tab,
  type TextGroundOf,
} from '@livediagram/document';

export type ProbeTab = Pick<Tab, 'elements' | 'layers'> & { backgroundColor?: unknown };
export type GroundOf = TextGroundOf<ProbeTab, BoxedElement>;

/** A ground cache for one picker (the shared one), working grounds out with this model's `textGroundOf`. */
export const textGroundMemo = (compute: GroundOf = textGroundOf) => textGroundMemoFor(compute);
