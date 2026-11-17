// Quick Start's template landing on its tab (useTemplateFlow). The scaffold REPLACES the tab's elements, and Quick
// Start only opens on an empty tab, but the builders load asynchronously: a collaborator's element can arrive in
// between. So the check runs again here, on the tabs the commit actually applies to, and a tab that is gone or no
// longer empty is left as is. Pure, so the rule is testable without the hook.
// A C4 level landing links the C4 levels already in the document to it and it to them (linkC4Levels,
// docs/specs/008-canvas/canvas-and-palette.md "Templates", the C4 levels link to each other).

import type { Tab } from '@livediagram/document';
import { linkC4Levels } from '@livediagram/templates';

// `tabs` with the template landed on the tab `tabId`.
export function landTemplateOnTab(
  tabs: readonly Tab[],
  tabId: string,
  build: (target: Tab) => Tab,
): Tab[] {
  const target = tabs.find((t) => t.id === tabId);
  if (!target || target.elements.length > 0) return [...tabs];
  const landed = build(target);
  return linkC4Levels(
    tabs.map((t) => (t.id === tabId ? landed : t)),
    tabId,
  );
}
