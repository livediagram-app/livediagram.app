// A person card's text (docs/specs/015-api/mcp-server.md §4.7, the org-chart template): the name in bold at the
// medium size over the role, the card's own text the small size. One shape for the template and graph input.

import { runsPlainText, type TextRun } from './rich-text';

export function personRuns(name: string, role: string): TextRun[] {
  return [{ text: name, bold: true, size: 'md' }, { text: `\n${role}` }];
}

// The fields a person card's box carries: its plain label (search, the outline) and its runs.
export function personCardText(name: string, role: string): { label: string; richText: TextRun[] } {
  const runs = personRuns(name, role);
  return { label: runsPlainText(runs), richText: runs };
}
