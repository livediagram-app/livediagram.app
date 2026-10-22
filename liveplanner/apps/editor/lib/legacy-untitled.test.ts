import { describe, expect, it } from 'vitest';
import {
  UNTITLED_PROJECT_NAME,
  isUntitledProjectName,
  untitledNameForTemplate,
} from '@liveplanner/templates';

// Projects created before the rename are stored as "Untitled diagram"
// (docs/specs/006-project/project-structure.md); they still count as untitled.
describe('untitled project names', () => {
  it('names a new blank project "Untitled project"', () => {
    expect(UNTITLED_PROJECT_NAME).toBe('Untitled project');
    expect(untitledNameForTemplate('blank')).toBe('Untitled project');
    expect(untitledNameForTemplate(null)).toBe('Untitled project');
  });

  it('treats both the current and the pre-rename default as untitled', () => {
    expect(isUntitledProjectName('Untitled project')).toBe(true);
    expect(isUntitledProjectName('Untitled diagram')).toBe(true);
    expect(isUntitledProjectName('Roadmap')).toBe(false);
    expect(isUntitledProjectName('Untitled Tree Mind Map')).toBe(false);
  });
});
