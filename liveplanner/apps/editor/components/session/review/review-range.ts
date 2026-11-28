// Sprint Review's Since Last Review (docs/specs/026-plan/session-tabs.md "Sprint Review"): the newest decision of
// another Sprint Review tab in the plan, read from its tabs when asked, never on a render.
import { lastReviewAt } from '@liveplanner/items';
import { readSessionTab } from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';

export function reviewedAt(
  plan: Pick<PlanContextValue, 'planTabs'>,
  exceptTabId?: string,
): number | null {
  const tabs = plan.planTabs?.() ?? [];
  const sessions = tabs.flatMap((t) => {
    const s = t.kind === 'session' ? readSessionTab(t.session) : null;
    return s ? [{ tabId: t.id, sessionKind: s.sessionKind, decided: s.decided }] : [];
  });
  return lastReviewAt(sessions, exceptTabId);
}
