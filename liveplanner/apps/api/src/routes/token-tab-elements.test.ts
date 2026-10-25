import { describe, expect, it } from 'vitest';
import { tokenTabsElementIssue } from './token-tab-elements';

// docs/specs/015-api/api.md, POST /api/projects: the MCP's sentence for an element no liveplanner tab holds.
describe('tokenTabsElementIssue', () => {
  const view = { id: 'v1', type: 'shape', shape: 'plan-view', x: 0, y: 0, width: 200, height: 120 };

  it('passes Plan elements, template tabs and tabs with no elements', () => {
    expect(
      tokenTabsElementIssue([
        { id: 't1', name: 'Overview', elements: [view] },
        { id: 't2', name: 'Board', template: 'kanban' },
        { id: 't3', name: 'Empty', elements: [] },
      ]),
    ).toBeNull();
  });

  it('names the tab and the element, by id or by place', () => {
    expect(tokenTabsElementIssue([{ name: 'Notes', elements: [{ id: 'a', type: 'arrow' }] }])).toBe(
      'Tab "Notes": element "a": type "arrow" is not an element a liveplanner tab holds; read liveplanner://schema/elements.',
    );
    expect(tokenTabsElementIssue([{ name: 'Notes', elements: [view, { type: 'text' }] }])).toMatch(
      /^Tab "Notes": element 2: type "text" is not/,
    );
  });

  it('refuses a chart with no cells to read', () => {
    expect(
      tokenTabsElementIssue([{ name: 'Dash', elements: [{ ...view, shape: 'bar-chart' }] }]),
    ).toMatch(/a bar-chart reads a Sheet's cells/);
  });
});
