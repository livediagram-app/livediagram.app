import type { CSSProperties } from 'react';
import { useEditorMode } from '@/hooks/editor/useEditorMode';
import type { EditorModeTab } from '@/lib/editor-mode-store';
import { useEditorModeState } from './editor-mode-context';
import { EDITOR_MODE_ICON } from './editor-mode-copy';

// The tab pill's leading icon (docs/specs/007-editor/editor-modes.md "The tab pill shows its
// mode"): the mode this person works in on that tab, resolved exactly as the canvas resolves it
// (useEditorMode), so a switch, Shift+D or an Opens in choice updates it at once. Who may edit is
// the editor's one answer, read from EditorModeProvider; outside an editor (a test mounting a
// pill alone) the tab's opening mode shows.
export function TabModeIcon({ tab, style }: { tab: EditorModeTab; style?: CSSProperties }) {
  const canEdit = useEditorModeState()?.canEdit ?? false;
  const { mode } = useEditorMode(tab, { canEdit });
  const Icon = EDITOR_MODE_ICON[mode];
  return <Icon aria-hidden size={12} className="shrink-0" style={style} />;
}
