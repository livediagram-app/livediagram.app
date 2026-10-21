import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/document';
import { templateTabName } from './template-tab-name';

// docs/specs/007-editor/templates-by-mode.md "The tab's name".
describe('the name a template gives its tab', () => {
  it('is the template’s title for any template, diagrams included', () => {
    expect(templateTabName('flowchart', { name: 'Tab 1', elements: [] })).toBe('Flowchart');
  });

  it('is none for a blank template', () => {
    expect(templateTabName('blank', { name: 'Tab 1', elements: [] })).toBeNull();
  });

  it('is a Board template’s board title', () => {
    const board = {
      id: 'b',
      type: 'shape',
      shape: 'plan-board',
      planBoard: { preset: 'kanban', title: 'Sprint 12' },
    } as unknown as Element;
    expect(templateTabName('kanban', { name: 'Tab 1', elements: [board], kind: 'board' })).toBe(
      'Sprint 12',
    );
    // A tab with a name of its own still takes the board's title, not the template's.
    expect(templateTabName('kanban', { name: 'Roadmap', elements: [board], kind: 'board' })).toBe(
      'Sprint 12',
    );
  });
});
