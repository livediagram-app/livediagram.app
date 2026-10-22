import { describe, expect, it } from 'vitest';
import { templateKindOf } from './templates';

describe('templateKindOf', () => {
  it('passes a live kind through and refuses anything else', () => {
    expect(templateKindOf('kanban')).toBe('kanban');
    expect(templateKindOf('not-a-template')).toBeNull();
    expect(templateKindOf(42)).toBeNull();
    expect(templateKindOf('hasOwnProperty')).toBeNull();
  });
});
