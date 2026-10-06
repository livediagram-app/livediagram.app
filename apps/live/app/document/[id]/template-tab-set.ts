// Quick Start with a template of several tabs (docs/specs/026-plan/plan-templates.md "How a template with
// tabs is made"): the first template tab lands on the tab Quick Start was opened on (useTemplateFlow), the
// others go straight after it, in order, each with that tab's look and the template's canvas overrides.
// Pure, so the placement rule is testable without the hook.

import type { Tab } from '@livediagram/document';
import { newTabSeed } from '@/lib/new-tab-seed';

export type TemplateTabContent = { id: string; name: string; elements: Tab['elements'] };

// The template's later tabs, each looking like `landed` (the tab the first template tab landed on).
export function templateFollowerTabs(
  landed: Tab,
  contents: readonly TemplateTabContent[],
  overrides: Partial<Tab>,
): Tab[] {
  return contents.map(({ id, name, elements }) => ({
    ...newTabSeed(landed),
    id,
    name,
    elements,
    templateChosen: true,
    ...overrides,
  }));
}

// `tabs` with `followers` inserted straight after the tab `afterId` (at the end if it is gone).
export function insertTabsAfter(tabs: readonly Tab[], afterId: string, followers: Tab[]): Tab[] {
  if (followers.length === 0) return [...tabs];
  const at = tabs.findIndex((t) => t.id === afterId);
  if (at < 0) return [...tabs, ...followers];
  return [...tabs.slice(0, at + 1), ...followers, ...tabs.slice(at + 1)];
}
