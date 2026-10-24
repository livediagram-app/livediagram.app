// An API token's seeded tabs hold Plan elements only (docs/specs/015-api/api.md, POST /api/projects): a board, a
// Sheet, a Dashboard's views and charts, as the MCP and changesets check them (planElementIssue). The refusal is the
// MCP's own sentence, so an agent reads the same thing whichever door it came in by. A tab given as a template is
// compiled by the server and not checked here.

import { planElementIssue } from '@liveplanner/edit-operations';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

// Why the first seeded element that is not a Plan element cannot be written, as a sentence; null when all can.
export function tokenTabsElementIssue(tabs: readonly unknown[]): string | null {
  for (const tab of tabs) {
    if (!isRec(tab) || !Array.isArray(tab.elements)) continue;
    const name = typeof tab.name === 'string' ? tab.name : 'Tab';
    for (const [i, el] of tab.elements.entries()) {
      if (!isRec(el)) continue;
      const issue = planElementIssue(el);
      if (!issue) continue;
      const where = typeof el.id === 'string' ? `element "${el.id}"` : `element ${i + 1}`;
      return `Tab "${name}": ${where}: ${issue}; read liveplanner://schema/elements.`;
    }
  }
  return null;
}
