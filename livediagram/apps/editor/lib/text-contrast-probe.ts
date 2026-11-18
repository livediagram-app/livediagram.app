// What a text colour picker judges its colours against (docs/specs/004-interface-design/colour-picker.md "Reading on
// its ground"): one copy for every product, @liveworkspace/element-model/text-contrast-probe, bound here to this
// model's grounds (its canvas, as saved) and default inks. A canvas seen in the other appearance than it is saved in
// is judged as saved. Pure.
import {
  canvasSurface,
  defaultTextColor,
  textContrastProbesFor,
  textGroundOf,
  type BoxedElement,
} from '@livediagram/document';
import type { ProbeTab } from './text-ground-memo';

export type { TextContrastProbe } from '@livediagram/document';

export const { textContrastProbe, textContrastProbes, cellContrastProbes } = textContrastProbesFor<
  ProbeTab,
  BoxedElement
>({
  groundOf: textGroundOf,
  defaultTextColor,
  exported: (ground, surface) =>
    ground.on === 'canvas' && canvasSurface(ground.tones[0]) !== surface,
});
