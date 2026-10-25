import { describe, expect, it } from 'vitest';
import { PROJECT_FORMAT, PROJECT_FORMAT_HEADER } from './project-format';

// docs/specs/016-platform/new-version-prompt.md "The project format number".
describe('the project format number', () => {
  it('is 2, packed stroke points, carried in one header', () => {
    expect(PROJECT_FORMAT).toBe(2);
    expect(PROJECT_FORMAT_HEADER).toBe('X-Liveplanner-Format');
  });
});
