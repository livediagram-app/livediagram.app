import { describe, expect, it } from 'vitest';

// The Worker itself is every app's (@liveworkspace/community-site/worker, tested there); this is livedocuments's entry.
describe('community worker: the entry module', () => {
  it('exports only the handler, or the Workers runtime refuses to start it', async () => {
    const entry = await import('./index');
    expect(Object.keys(entry)).toEqual(['default']);
    expect(typeof entry.default.fetch).toBe('function');
  });
});
