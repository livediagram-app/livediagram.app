import { describe, expect, it } from 'vitest';
import {
  UNTITLED_PROJECT_NAME,
  isUntitledProjectName,
  untitledNameForTemplate,
} from '@liveplanner/templates';

// Projects created before the rename are stored as "Untitled diagram"
// (docs/specs/006-project/project-structure.md); they still count as untitled.
describe('untitled project names', () => {
  it('names a new blank project "Untitled plan"', () => {
    expect(UNTITLED_PROJECT_NAME).toBe('Untitled plan');
    expect(untitledNameForTemplate('blank')).toBe('Untitled plan');
    expect(untitledNameForTemplate(null)).toBe('Untitled plan');
  });

  it('treats the current and the earlier defaults as untitled', () => {
    expect(isUntitledProjectName('Untitled plan')).toBe(true);
    expect(isUntitledProjectName('Untitled project')).toBe(true);
    expect(isUntitledProjectName('Untitled diagram')).toBe(true);
    expect(isUntitledProjectName('Roadmap')).toBe(false);
    expect(isUntitledProjectName('Untitled Tree Mind Map')).toBe(false);
  });
});
