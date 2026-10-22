import { describe, expect, it } from 'vitest';
import { fieldValueIssue } from './element-field-values';

// docs/specs/024-agents/edit-operations.md "The vocabulary": a font is one of the editor's faces.
describe('a font an agent writes', () => {
  it('is one of the editor’s faces, never a family name', () => {
    expect(fieldValueIssue('font', 'lora')).toBeNull();
    expect(fieldValueIssue('font', 'serif')).toMatch(/^font "serif" is not one of .*lora/);
  });
});
