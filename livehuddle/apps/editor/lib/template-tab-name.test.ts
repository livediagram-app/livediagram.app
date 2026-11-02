import { describe, expect, it } from 'vitest';
import { templateTabName } from './template-tab-name';

// docs/specs/007-editor/templates-by-mode.md "The tab's name".
describe('the name a template gives its tab', () => {
  it('is the template’s title for any template, diagrams included', () => {
    expect(templateTabName('flowchart')).toBe('Flowchart');
  });

  it('is none for a blank template', () => {
    expect(templateTabName('blank')).toBeNull();
  });
});
