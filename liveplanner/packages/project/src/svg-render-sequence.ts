// A sequence diagram element's picture (docs/specs/009-elements/sequence-diagram.md): one copy for livediagram and
// liveplanner, @liveworkspace/element-model/svg-render-sequence, drawn by this model's layout and headless renderer.
import { sequencePictureFor } from '@liveworkspace/element-model/svg-render-sequence';
import { layoutSequence } from './sequence-layout';
import { renderElementsToSvg } from './svg-render';
import type { Element } from './index';

export type { SequenceLook } from '@liveworkspace/element-model/svg-render-sequence';

export const { sequenceDrawing, svgSequencePicture } = sequencePictureFor<Element>({
  layoutSequence: (diagram, opts) => layoutSequence(diagram, opts),
  renderElementsToSvg: (tab, opts) => renderElementsToSvg(tab, opts),
});
