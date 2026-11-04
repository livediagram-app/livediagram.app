// A field's type change over the plan's tabs (docs/specs/026-plan/item-types.md "Edit Field": Filters on the field,
// and Built-in fields' "What stops reading it"): the boards, views and forms the tabs hold, as the pure scan in
// @liveplanner/items reads them; how many filters on the field there are; and the tabs with them taken off (a tab
// and an element replaced only where one came off). Pure: no card is read.
import type { Element, Tab } from '@liveplanner/project';
import { questionsOf } from '@liveplanner/forms';
import {
  boardWithoutFieldFilters,
  viewWithoutFieldFilters,
  type FieldRetypeTarget,
  type ImpactBoard,
  type ImpactForm,
  type ImpactView,
} from '@liveplanner/items';

type Surfaces = { boards: ImpactBoard[]; views: ImpactView[]; forms: ImpactForm[] };

/** The boards, views and forms on the plan's tabs, in tab order. */
export function planSurfaces(tabs: readonly Tab[]): Surfaces {
  const out: Surfaces = { boards: [], views: [], forms: [] };
  for (const tab of tabs) {
    for (const el of tab.elements) {
      if (el.type !== 'shape') continue;
      if (el.shape === 'plan-board' && el.planBoard)
        out.boards.push({ title: el.planBoard.title || tab.name, setup: el.planBoard });
      else if (el.shape === 'plan-view' && el.planView)
        out.views.push({ view: el.planView.view, settings: el.planView });
    }
    if (tab.form)
      out.forms.push({
        title: tab.form.heading || tab.name,
        typeId: tab.form.destination?.typeId,
        fieldIds: questionsOf(tab.form).flatMap((q) =>
          q.goesTo?.to === 'field' ? [q.goesTo.fieldId] : [],
        ),
      });
  }
  return out;
}

// One element without the targets' filters, and how many came off (the element as it was when none did).
function elementWithout(
  el: Element,
  targets: readonly FieldRetypeTarget[],
): { el: Element; removed: number } {
  if (el.type !== 'shape') return { el, removed: 0 };
  let removed = 0;
  if (el.shape === 'plan-board' && el.planBoard) {
    let setup = el.planBoard;
    for (const t of targets) {
      const out = boardWithoutFieldFilters(setup, t);
      setup = out.setup;
      removed += out.removed;
    }
    return removed ? { el: { ...el, planBoard: setup }, removed } : { el, removed };
  }
  if (el.shape === 'plan-view' && el.planView) {
    let settings = el.planView;
    for (const t of targets) {
      const out = viewWithoutFieldFilters(settings, t);
      settings = out.settings;
      removed += out.removed;
    }
    return removed ? { el: { ...el, planView: settings }, removed } : { el, removed };
  }
  return { el, removed: 0 };
}

/** How many filters on the targets' fields the plan's boards and views hold (those the change takes off). */
export function countFieldFilters(
  tabs: readonly Tab[],
  targets: readonly FieldRetypeTarget[],
): number {
  if (targets.length === 0) return 0;
  let n = 0;
  for (const tab of tabs) for (const el of tab.elements) n += elementWithout(el, targets).removed;
  return n;
}

/** The tabs with the targets' filters taken off; the same array when none came off. */
export function tabsWithoutFieldFilters<T extends Tab>(
  tabs: T[],
  targets: readonly FieldRetypeTarget[],
): T[] {
  if (targets.length === 0) return tabs;
  let changed = false;
  const next = tabs.map((tab) => {
    let touched = false;
    const elements = tab.elements.map((el) => {
      const out = elementWithout(el, targets);
      if (out.removed) touched = true;
      return out.el;
    });
    if (!touched) return tab;
    changed = true;
    return { ...tab, elements };
  });
  return changed ? next : tabs;
}
