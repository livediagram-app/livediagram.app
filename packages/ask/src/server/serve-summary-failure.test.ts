// Send to Knowledge Base's summary when the model call fails in a way the AI package does not name: refused with
// the plain words, the kind logged as `other`, nothing charged (liveworkspace/docs/specs/004-index/send-to-knowledge.md
// "The summary").
import { describe, expect, it, vi } from 'vitest';

vi.mock('@liveworkspace/ai', async (original) => ({
  ...(await original<typeof import('@liveworkspace/ai')>()),
  callModel: vi.fn(async () => Promise.reject(new Error('unexpected'))),
}));

import { serveSelectionSummary } from './serve-summary';

describe('a model call that fails unnamed', () => {
  it('answers summary_failed and logs the kind as other', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await serveSelectionSummary({
      request: new Request('https://app.test/x', {
        method: 'POST',
        body: JSON.stringify({
          selection: { items: [{ id: 'a', kind: 'shape', label: 'Cart' }], links: [] },
        }),
      }),
      accountId: 'acc_1',
      itemId: 'D',
      aiKey: async () => ({ status: 'none' }),
      builtIn: { run: vi.fn() },
      spend: async () => true,
      now: () => 0,
    });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe('summary_failed');
    expect(warn).toHaveBeenCalledWith('[knowledge-summary] failed', {
      provider: 'built-in',
      kind: 'other',
    });
    warn.mockRestore();
  });
});
