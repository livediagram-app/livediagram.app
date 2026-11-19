// The hug measurer bound to the plain label run style: what an editor whose runs draw nothing of their own binds
// (liveworkspace/docs/specs/011-workbench/label-editor.md). livedocuments binds its effects run style instead.

import { effectiveRunStyle } from './label-style';
import { createTextHugMeasure, labelRuns } from './text-hug-measure';

export { labelRuns };

export const { measureLabelBlock, measureTextHug, measureDrawnText } =
  createTextHugMeasure(effectiveRunStyle);
