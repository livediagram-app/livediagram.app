import { EDITOR_MODE_ICONS, lucideGlyph } from '@livediagram/ui';
import {
  lucideClipboardList,
  lucideGrid3x3,
  lucideLayoutGrid,
  lucideSquareKanban,
} from '@livediagram/icons/lucide';
import { isPlanTabKind, opensInOf, type PlanTabKind } from '@livediagram/document';
import type { CSSProperties } from 'react';
import type { EditorModeTab } from '@/lib/editor-mode-store';

// A Plan kind's own glyph (docs/specs/026-plan/plan-tabs.md "Tab kinds"): a Board, Sheet or Dashboard tab is always in
// Plan, so its mode says nothing the others' don't; what it is tells them apart.
const KIND_ICONS: Record<PlanTabKind, ReturnType<typeof lucideGlyph>> = {
  board: lucideGlyph(lucideSquareKanban, 12),
  sheet: lucideGlyph(lucideGrid3x3, 12),
  dashboard: lucideGlyph(lucideLayoutGrid, 12),
  // A Form tab (docs/specs/030-forms/forms.md "The Form tab").
  form: lucideGlyph(lucideClipboardList, 12),
};

// The tab pill's leading icon (docs/specs/007-editor/editor-modes.md "The tab pill shows the tab's
// mode"): the tab's own mode, the same for everyone, so a switch, Shift+D, a Mode choice or a
// collaborator's switch updates it at once; a Board, Sheet, Dashboard or Form tab shows its kind instead.
export function TabModeIcon({ tab, style }: { tab: EditorModeTab; style?: CSSProperties }) {
  const kind = isPlanTabKind(tab.kind) ? tab.kind : null;
  const Icon = kind ? KIND_ICONS[kind] : EDITOR_MODE_ICONS[opensInOf(tab)];
  return <Icon aria-hidden size={12} className="shrink-0" style={style} />;
}
