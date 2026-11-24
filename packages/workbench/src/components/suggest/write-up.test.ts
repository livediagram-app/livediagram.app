// @vitest-environment jsdom
// Write It Up's one click (liveworkspace/docs/specs/016-notifications/suggestions.md "What taking one does"): the
// target read once per item, the page written as the person with a toast saying where, a refusal saying why.
import { IndexError } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { writeUpTarget: readTarget, writeUp } = vi.hoisted(() => ({
  writeUpTarget: vi.fn(),
  writeUp: vi.fn(),
}));
vi.mock('../../lib/index-client', () => ({ indexClient: { writeUpTarget: readTarget, writeUp } }));

import {
  resetWriteUpTargetsForTests,
  writeUpFrom,
  writeUpTarget,
  writeUpToKnowledgebase,
} from './write-up';

afterEach(() => {
  vi.clearAllMocks();
  resetWriteUpTargetsForTests();
});

const toast = () => ({ success: vi.fn(), error: vi.fn() });
const kb = { id: 'kb1', title: 'Wiki' };

describe('writeUpTarget', () => {
  it('reads once per item, and again after a failure', async () => {
    readTarget.mockResolvedValue({ knowledgebase: kb });
    expect(await writeUpTarget('P1')).toEqual(kb);
    expect(await writeUpTarget('P1')).toEqual(kb);
    expect(readTarget).toHaveBeenCalledTimes(1);
    readTarget.mockRejectedValueOnce(new Error('offline'));
    expect(await writeUpTarget('P2')).toBeNull();
    readTarget.mockResolvedValue({ knowledgebase: null });
    expect(await writeUpTarget('P2')).toBeNull();
    expect(readTarget).toHaveBeenCalledTimes(3);
  });
});

describe('writeUpToKnowledgebase', () => {
  it('writes the page and offers to open it', async () => {
    writeUp.mockResolvedValue({ page: { title: 'T', link: 'https://k/p1' } });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const t = toast();
    await writeUpToKnowledgebase(t, 'P1', kb, { title: '  ', body: 'B' });
    expect(writeUp).toHaveBeenCalledWith('P1', {
      knowledgebase: 'kb1',
      title: 'Untitled',
      body: 'B',
    });
    expect(t.success).toHaveBeenCalledWith('Written up in Wiki', expect.anything());
    (t.success.mock.calls[0]![1] as { action: { onSelect: () => void } }).action.onSelect();
    expect(open).toHaveBeenCalledWith('https://k/p1', '_blank', 'noopener');
    open.mockRestore();
  });

  it('says why it was refused, or a plain reason', async () => {
    const t = toast();
    writeUp.mockRejectedValueOnce(
      new IndexError(422, 'write_up_refused', null, null, null, { reason: 'Verified page' }),
    );
    await writeUpToKnowledgebase(t, 'P1', { id: 'kb1', title: '' }, { title: 'T', body: 'B' });
    expect(t.error).toHaveBeenCalledWith('It couldn’t be written up. Verified page');
    writeUp.mockRejectedValueOnce(new Error('offline'));
    await writeUpToKnowledgebase(t, 'P1', kb, { title: 'T', body: 'B' });
    expect(t.error).toHaveBeenLastCalledWith(
      'It couldn’t be written up. Check you can edit that knowledgebase.',
    );
  });

  it('ends a page with where it came from', () => {
    expect(writeUpFrom('Launch', 'liveplanner', 'https://p')).toBe(
      '\n\n---\n\nFrom Launch (liveplanner): https://p',
    );
  });
});
