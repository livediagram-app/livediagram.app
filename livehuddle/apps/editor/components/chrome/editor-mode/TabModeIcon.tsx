import { EDITOR_MODE_ICONS } from '@livediagram/ui';
import { opensInOf } from '@livediagram/document';
import type { CSSProperties } from 'react';
import type { EditorModeTab } from '@/lib/editor-mode-store';

// The tab pill's leading icon (docs/specs/007-editor/editor-modes.md "The tab pill shows the tab's
// mode"): the tab's own mode, the same for everyone, so a switch, Shift+D, a Mode choice or a
// collaborator's switch updates it at once.
export function TabModeIcon({ tab, style }: { tab: EditorModeTab; style?: CSSProperties }) {
  const Icon = EDITOR_MODE_ICONS[opensInOf(tab)];
  return <Icon aria-hidden size={12} className="shrink-0" style={style} />;
}
