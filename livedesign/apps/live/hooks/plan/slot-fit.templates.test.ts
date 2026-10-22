import { describe, expect, it } from 'vitest';
import { PLAN_TEMPLATE_KINDS, templateTabs } from '@livedesign/templates';
import type { Element } from '@livedesign/document';
import { fitsSlot } from './slot-fit';
import type { DashboardItem } from './dashboard-drop';

// docs/specs/026-plan/plan-tabs.md "Templates" and "Filling a slot": a Plan template's Dashboard puts each thing only
// in a slot big enough for it to look good, on a modest desktop page (the canvas area of a 1024 px window).
const PAGE_W = 1024 - 24; // the page's side padding
const GAP = 12;

describe('Plan template Dashboards', () => {
  const cases = PLAN_TEMPLATE_KINDS.flatMap((kind) => {
    const defs = templateTabs(kind);
    const ids = defs.map((_, i) => `${kind}-${i}`);
    return defs.flatMap((d) => {
      const fields = d.tab?.(ids);
      return fields?.dashboard ? [{ kind, dashboard: fields.dashboard, els: d.build(0, 0) }] : [];
    });
  });

  it('some templates make a Dashboard', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)('$kind: every slot fits what it shows', ({ dashboard, els }) => {
    const byId = new Map<string, Element>(els.map((e) => [e.id, e]));
    for (const row of dashboard.rows) {
      const inner = PAGE_W - GAP * (row.slots.length - 1);
      for (const slot of row.slots) {
        const c = slot.content;
        if (!c) continue;
        const item: DashboardItem =
          c.type === 'tab'
            ? { kind: 'tab', tabId: c.tabId, of: c.of ?? 'board' }
            : c.type === 'element'
              ? {
                  kind: 'view',
                  view: (byId.get(c.elementId) as { planView: { view: string } }).planView.view,
                }
              : { kind: 'note' };
        const size = { width: (inner * slot.span) / 12, height: row.height };
        expect(fitsSlot(item, size), `${JSON.stringify(c)} in ${JSON.stringify(size)}`).toBe(true);
      }
    }
  });
});
