import { describe, expect, it, vi } from 'vitest';

vi.mock('@livedesign/page-lint', () => ({
  lintTab: () => {
    throw new Error('boom');
  },
}));

const { lintResult } = await import('./lint');

// A lint that throws never fails the write (page-lint LN23).
describe('lintResult when the lint fails', () => {
  it('answers null and logs the failure', () => {
    const errors: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(args));
    expect(lintResult({ elements: [] }, { designId: 'D', tabId: 't1' })).toBeNull();
    expect(errors[0]).toEqual([
      '[lint] failed',
      { where: 'changeset', designId: 'D', tabId: 't1', error: 'Error: boom' },
    ]);
  });
});
