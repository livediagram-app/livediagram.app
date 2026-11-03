import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_VALUES, fieldValueIssue } from './element-field-values';

// docs/specs/024-agents/edit-operations.md "The vocabulary": a font is one of the faces liveplanner offers.
describe('a font an agent writes', () => {
  it('is one of the editor’s faces, never a family name', () => {
    expect(fieldValueIssue('font', 'lora')).toBeNull();
    expect(fieldValueIssue('font', 'serif')).toMatch(/^font "serif" is not one of .*lora/);
  });

  // docs/specs/004-interface-design/fonts.md "Not offered in liveplanner": the pickers' rule, for agents.
  it('lists only the offered faces, never Permanent Marker', () => {
    expect(ELEMENT_FIELD_VALUES.font).toContain('lora');
    expect(ELEMENT_FIELD_VALUES.font).not.toContain('permanent-marker');
    expect(fieldValueIssue('font', 'serif')).not.toContain('permanent-marker');
  });

  it('keeps Permanent Marker on a whole element, so a plan read back writes again', () => {
    expect(fieldValueIssue('font', 'permanent-marker')).toBeNull();
    expect(fieldValueIssue('font', 'permanent-marker', 'stored')).toBeNull();
  });

  it('refuses Permanent Marker as a new value, naming the offered faces', () => {
    expect(fieldValueIssue('font', 'permanent-marker', 'new')).toMatch(
      /^font "permanent-marker" is not one of .*lora/,
    );
    expect(fieldValueIssue('font', 'lora', 'new')).toBeNull();
    // A field with no kept values reads the same either way.
    expect(fieldValueIssue('textSize', 'xl', 'new')).toBe(fieldValueIssue('textSize', 'xl'));
  });
});
