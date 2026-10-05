import { describe, expect, it, vi } from 'vitest';

vi.mock('@livediagram/diagram-lint', () => ({
  formatLintReport: () => '',
  lintTab: () => {
    throw new Error('boom');
  },
}));

const { answerTabView } = await import('./document-views-route');

// A lint that throws answers 500 with `lint unavailable` and logs `[lint] failed` (diagram-lint LN23).
describe('the lint view when the lint fails', () => {
  it('answers 500 and logs the failure', async () => {
    const errors: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(args));
    const res = answerTabView(
      { env: {} } as never,
      { lint: true, json: false },
      { id: 'D', tabs: [] } as never,
      { id: 't1', rev: 1, elements: [] } as never,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'lint_failed', message: 'lint unavailable' });
    expect(errors[0]).toEqual([
      '[lint] failed',
      { where: 'view', tab: 't1', error: 'Error: boom' },
    ]);
  });
});
