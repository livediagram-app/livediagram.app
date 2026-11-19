// The hug measurer behind a whiteboard text box (docs/specs/023-draw-mode/draw-mode.md "Text boxes"): the shared one
// (liveworkspace/docs/specs/011-workbench/label-editor.md), bound to this editor's label run style, plus a mind
// node's label measure.

import type { Finish, ShapeElement } from '@livediagram/document';
import {
  createTextHugMeasure,
  drawnLabelFont,
  labelRuns,
} from '@liveworkspace/workbench/components/label-editor/text-hug-measure';
import type { MeasureTextBlock } from '@liveworkspace/workbench/components/label-editor/text-hug-font';
import { effectiveRunStyle } from '@/components/canvas/label-style';
import { mindLabelFontPx } from '@/lib/mind-label-fit';

export { labelRuns };

export const { measureLabelBlock, measureTextHug, measureDrawnText } =
  createTextHugMeasure(effectiveRunStyle);

// The same for a mind node's label, at the size it draws (or, sized Auto, types) at
// (docs/specs/009-elements/mind-node.md "A node grows to fit its label").
export function measureDrawnMindLabel(
  tabFont: string | undefined,
  tabFinish?: Finish,
): (el: ShapeElement) => MeasureTextBlock {
  return (el) =>
    measureLabelBlock(
      el,
      labelRuns(el),
      drawnLabelFont(el, tabFont, tabFinish),
      mindLabelFontPx(el),
    );
}
