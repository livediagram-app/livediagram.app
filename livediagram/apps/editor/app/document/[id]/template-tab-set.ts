// Quick Start with a template of several tabs (docs/specs/026-plan/plan-templates.md "How a template with
// tabs is made"): the first template tab lands on the tab Quick Start was opened on (useTemplateFlow), the
// others go straight after it, in order, each with that tab's look and the template's canvas overrides.
// Pure, so the placement rule is testable without the hook.

import type { Tab } from '@livediagram/document';
import { newTabSeed } from '@/lib/new-tab-seed';

type TemplateTabContent = {
  id: string;
  name: string;
  elements: Tab['elements'];
  // The template's own fields for the tab (a Plan template's kind and Dashboard), over the overrides.
  fields?: Partial<Tab>;
  // A companion Sheet (docs/specs/026-plan/plan-templates.md "How a template with tabs is made"): the theme's backdrop
  // rather than the template's canvas overrides, which are its drawing's.
  ownCanvas?: Partial<Tab>;
};

// The template's later tabs, each looking like `landed` (the tab the first template tab landed on).
export function templateFollowerTabs(
  landed: Tab,
  contents: readonly TemplateTabContent[],
  overrides: Partial<Tab>,
): Tab[] {
  return contents.map(({ id, name, elements, fields, ownCanvas }) => ({
    ...newTabSeed(landed),
    id,
    name,
    elements,
    templateChosen: true,
    ...(ownCanvas ?? overrides),
    ...fields,
  }));
}

// `tabs` with `followers` inserted straight after the tab `afterId` (at the end if it is gone).
export function insertTabsAfter(tabs: readonly Tab[], afterId: string, followers: Tab[]): Tab[] {
  if (followers.length === 0) return [...tabs];
  const at = tabs.findIndex((t) => t.id === afterId);
  if (at < 0) return [...tabs, ...followers];
  return [...tabs.slice(0, at + 1), ...followers, ...tabs.slice(at + 1)];
}

// `tabs` with the template landed on the tab `tabId` and its later tabs after it. The scaffold
// REPLACES the tab's elements, and Quick Start only opens on an empty tab, but the builders load
// asynchronously: a collaborator's element can arrive in between. So the check runs again here, on
// the tabs the commit actually applies to, and a tab that is gone or no longer empty is left as is.
export function landTemplateOnTab(
  tabs: readonly Tab[],
  tabId: string,
  build: (target: Tab) => { landed: Tab; followers: Tab[] },
): Tab[] {
  const target = tabs.find((t) => t.id === tabId);
  if (!target || target.elements.length > 0) return [...tabs];
  const { landed, followers } = build(target);
  return insertTabsAfter(
    tabs.map((t) => (t.id === tabId ? landed : t)),
    tabId,
    followers,
  );
}
