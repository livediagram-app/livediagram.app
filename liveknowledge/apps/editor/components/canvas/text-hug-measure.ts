// The hug measurer behind a text box: the shared one (liveworkspace/docs/specs/011-workbench/label-editor.md), bound
// to this editor's label run style, so a run's Text Effects are measured as they are drawn.

import {
  createTextHugMeasure,
  labelRuns,
} from '@liveworkspace/workbench/components/label-editor/text-hug-measure';
import { effectiveRunStyle } from '@/components/canvas/label-style';

export { labelRuns };

export const { measureLabelBlock, measureTextHug, measureDrawnText } =
  createTextHugMeasure(effectiveRunStyle);
