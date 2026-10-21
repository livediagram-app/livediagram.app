import { afterEach, describe, expect, it, vi } from 'vitest';
import { logMoveFailure } from './move-failure';

describe('logMoveFailure', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the kind, the subject and an error message, or what was thrown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logMoveFailure('folder', ' folder=f1', new Error('offline'));
    logMoveFailure('new-folder', '', 'refused');
    expect(warn.mock.calls).toEqual([
      ['[explorer-move] folder failed folder=f1: offline'],
      ['[explorer-move] new-folder failed: refused'],
    ]);
  });
});
