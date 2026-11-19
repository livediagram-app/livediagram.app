// The in-place label editor (docs/specs/008-canvas/canvas-and-palette.md "Labels"): the shared one
// (liveworkspace/docs/specs/011-workbench/label-editor.md), bound to this editor's label toolbar, its telemetry, a
// mind node's keys (docs/specs/009-elements/mind-node.md "Keyboard") and Escape out of a placement leaving the
// selection too (lib/placed-edit).

import type { KeyboardEvent } from 'react';
import type { BoxedElement } from '@livediagram/document';
import { createLabelEditor } from '@liveworkspace/workbench/components/label-editor/LabelEditor';
import type {
  LabelKeySession,
  LabelToolbarProps,
} from '@liveworkspace/workbench/components/label-editor/LabelEditor.types';
import { RichTextToolbar } from '@/components/canvas/RichTextToolbar';
import { useMindLabelKeys } from '@/components/canvas/useMindLabelKeys';
import { leaveByEscape } from '@/lib/placed-edit';
import { track } from '@/lib/telemetry';

export type { LabelEditorProps as RichTextEditorProps } from '@liveworkspace/workbench/components/label-editor/LabelEditor.types';

function LabelToolbar({ onPatch, ...props }: LabelToolbarProps<BoxedElement>) {
  return <RichTextToolbar {...props} onColor={(color) => onPatch({ color })} />;
}

// On a mind node (or a flowchart step), Tab and Enter commit the label and grow the next node, and Escape keeps
// what was typed; a no-op for every other element, and outside the editor canvas (share view, embed, exports)
// where there is no grower.
function useMindKeys(session: LabelKeySession<BoxedElement>): (e: KeyboardEvent) => boolean {
  return useMindLabelKeys(session).onMindKeyDown;
}

export const RichTextEditor = createLabelEditor<BoxedElement>({
  Toolbar: LabelToolbar,
  trackFormat: () => track('Element', 'Changed', 'TextFormat'),
  useKeyDown: useMindKeys,
  onEscape: leaveByEscape,
});
