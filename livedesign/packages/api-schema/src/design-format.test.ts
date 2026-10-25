import { describe, expect, it } from 'vitest';
import { DESIGN_FORMAT, DESIGN_FORMAT_HEADER } from './design-format';

// docs/specs/016-platform/new-version-prompt.md "The design format number".
describe('the design format number', () => {
  it('is 2, packed stroke points, carried in one header', () => {
    expect(DESIGN_FORMAT).toBe(2);
    expect(DESIGN_FORMAT_HEADER).toBe('X-Livedesign-Format');
  });
});
