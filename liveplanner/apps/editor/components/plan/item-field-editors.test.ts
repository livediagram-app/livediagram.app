import { describe, expect, it } from 'vitest';
import { detailSelectClass } from './item-field-editors';

describe('detailSelectClass', () => {
  it('gives every Details select the 34px field its neighbours draw', () => {
    expect(detailSelectClass(false)).toContain('min-h-[34px]');
    expect(detailSelectClass(true)).toContain('min-h-[34px]');
  });

  it('mutes an empty None as the Assignee and Parent fields do, and only then', () => {
    expect(detailSelectClass(true)).toContain('text-slate-500!');
    expect(detailSelectClass(false)).not.toContain('text-slate-500!');
  });

  it("keeps the caller's own classes", () => {
    expect(detailSelectClass(false, 'font-medium pl-6')).toMatch(/ font-medium pl-6$/);
  });
});
