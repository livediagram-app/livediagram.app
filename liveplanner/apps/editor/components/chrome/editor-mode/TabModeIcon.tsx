import { PlanIcon, lucideGlyph } from '@liveplanner/ui';
import {
  lucideClipboardList,
  lucideGrid3x3,
  lucideLayoutGrid,
  lucideSquareKanban,
} from '@liveworkspace/icons/lucide';
import { isPlanTabKind, type PlanTabKind, type Tab } from '@liveplanner/project';
import type { CSSProperties } from 'react';

// A Plan kind's own glyph (docs/specs/026-plan/plan-tabs.md "Tab kinds"): what the tab is tells them apart.
const KIND_ICONS: Record<PlanTabKind, ReturnType<typeof lucideGlyph>> = {
  board: lucideGlyph(lucideSquareKanban, 12),
  sheet: lucideGlyph(lucideGrid3x3, 12),
  dashboard: lucideGlyph(lucideLayoutGrid, 12),
  // A Form tab (docs/specs/030-forms/forms.md "The Form tab").
  form: lucideGlyph(lucideClipboardList, 12),
};

// The tab pill's leading icon (docs/specs/026-plan/plan-tabs.md "Tab kinds"): a Board, Sheet, Dashboard or Form tab
// shows its kind; a general tab, Plan's mark.
export function TabModeIcon({ tab, style }: { tab: Pick<Tab, 'kind'>; style?: CSSProperties }) {
  const kind = isPlanTabKind(tab.kind) ? tab.kind : null;
  const Icon = kind ? KIND_ICONS[kind] : PlanIcon;
  return <Icon aria-hidden size={12} className="shrink-0" style={style} />;
}
