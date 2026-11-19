// The in-place label editor (docs/specs/008-canvas/canvas-and-palette.md "Labels"): the shared one
// (liveworkspace/docs/specs/011-workbench/label-editor.md), bound to this editor's label toolbar, its telemetry and
// its Text Effects (docs/specs/008-canvas/text-effects.md), painted on each run and applied from the toolbar.

import type { BoxedElement } from '@livedocuments/document';
import { createLabelEditor } from '@liveworkspace/workbench/components/label-editor/LabelEditor';
import type { LabelToolbarProps } from '@liveworkspace/workbench/components/label-editor/LabelEditor.types';
import { effectiveRunStyle } from '@/components/canvas/label-style';
import { RichTextToolbar } from '@/components/canvas/RichTextToolbar';
import { track } from '@/lib/telemetry';

export type { LabelEditorProps as RichTextEditorProps } from '@liveworkspace/workbench/components/label-editor/LabelEditor.types';

function LabelToolbar({ onPatch, ...props }: LabelToolbarProps<BoxedElement>) {
  return (
    <RichTextToolbar
      {...props}
      onColor={(color) => onPatch({ color })}
      onEffect={(patch) => onPatch(patch, 'highlight' in patch ? 'Highlight' : 'Gradient')}
    />
  );
}

export const RichTextEditor = createLabelEditor<BoxedElement>({
  Toolbar: LabelToolbar,
  trackFormat: () => track('Element', 'Changed', 'TextFormat'),
  runStyle: effectiveRunStyle,
});
