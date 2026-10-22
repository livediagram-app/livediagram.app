import { describe, expect, it } from 'vitest';
import { changeLabel } from './AllApps';

describe('changeLabel', () => {
  it('names the change against the span before', () => {
    expect(changeLabel(112, 100)).toBe('up 12%');
    expect(changeLabel(97, 100)).toBe('down 3%');
    expect(changeLabel(100, 100)).toBe('level');
    expect(changeLabel(5, 0)).toBe('new');
    expect(changeLabel(0, 0)).toBe('level');
  });
});
