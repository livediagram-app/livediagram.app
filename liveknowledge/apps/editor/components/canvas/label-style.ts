// The label typography the display renderers (element-labels.tsx) and the label editor share: one copy in the
// workbench (liveworkspace/docs/specs/011-workbench/label-editor.md), kept at this path for its importers, with this
// editor's Text Effects on every run (docs/specs/008-canvas/text-effects.md).

import type { TextElement } from '@liveknowledge/document';
import type { LabelRunStyle } from '@liveworkspace/workbench/components/label-editor/LabelEditor.types';
import { effectiveRunStyle as plainRunStyle } from '@liveworkspace/workbench/components/label-editor/label-style';
import { runEffectCss } from '@/components/canvas/run-effect-style';

export * from '@liveworkspace/workbench/components/label-editor/label-style';

// A run's span style with its highlight and gradient: the label, its editor and the hug measurer all paint it, so
// starting to edit never moves a glyph. A text box's shadow moves onto a gradient run's own filter.
export const effectiveRunStyle: LabelRunStyle = (run, el, runSizePx) => {
  const shadow = el.type === 'text' ? (el as TextElement).shadow : undefined;
  return Object.assign(plainRunStyle(run, el, runSizePx), runEffectCss(run, shadow));
};
