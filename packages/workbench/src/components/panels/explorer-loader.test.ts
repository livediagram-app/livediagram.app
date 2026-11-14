import { afterEach, describe, expect, it, vi } from 'vitest';
import { explorerLoader } from './explorer-loader';

afterEach(() => vi.restoreAllMocks());

// docs/specs/007-editor/load-recovery.md "Offline": a panel that cannot load draws nothing.
describe('explorerLoader', () => {
  it('hands back the panel module’s Explorer', async () => {
    const Explorer = () => null;
    await expect(explorerLoader(() => Promise.resolve({ Explorer }))()).resolves.toBe(Explorer);
  });

  it('draws nothing when the code cannot load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const Unavailable = await explorerLoader<object>(() => Promise.reject(new Error('offline')))();
    expect((Unavailable as () => null)()).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});
