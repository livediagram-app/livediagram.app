// Quick Start's template landing on its tab (useTemplateFlow). The scaffold REPLACES the tab's elements, and Quick
// Start only opens on an empty tab, but the builders load asynchronously: a collaborator's element can arrive in
// between. So the check runs again here, on the tabs the commit actually applies to, and a tab that is gone or no
// longer empty is left as is. Pure, so the rule is testable without the hook.

import type { Tab } from '@livediagram/document';

// `tabs` with the template landed on the tab `tabId`.
export function landTemplateOnTab(
  tabs: readonly Tab[],
  tabId: string,
  build: (target: Tab) => Tab,
): Tab[] {
  const target = tabs.find((t) => t.id === tabId);
  if (!target || target.elements.length > 0) return [...tabs];
  const landed = build(target);
  return tabs.map((t) => (t.id === tabId ? landed : t));
}
