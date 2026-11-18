// What a text colour picker judges its colours against (docs/specs/004-interface-design/colour-picker.md "Reading on
// its ground"): one copy for every product, @liveworkspace/element-model/text-contrast-probe, bound here to this
// model's grounds (its pages) and default inks. A page ground on a dark canvas is judged as the page exports. Pure.
import {
  defaultTextColor,
  textContrastProbesFor,
  textGroundOf,
  type BoxedElement,
} from '@livedocuments/document';
import type { ProbeTab } from './text-ground-memo';

export type { TextContrastProbe } from '@livedocuments/document';

export const { textContrastProbe, textContrastProbes, cellContrastProbes } = textContrastProbesFor<
  ProbeTab,
  BoxedElement
>({
  groundOf: textGroundOf,
  defaultTextColor,
  exported: (ground, surface) => surface === 'dark' && ground.on === 'page',
});
