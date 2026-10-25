import { afterEach, describe, expect, it, vi } from 'vitest';
import { consoleLintLogger } from './log';

describe('consoleLintLogger (LN30)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs each fingerprint at the level it names, info otherwise', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleLintLogger('[lint] crossings skipped', { arrows: 301 });
    consoleLintLogger('[lint] theme unresolved', { theme: 'x' });
    consoleLintLogger('[lint] done', { ms: 3 });
    expect(warn).toHaveBeenCalledWith('[lint] crossings skipped', { arrows: 301 });
    expect(debug).toHaveBeenCalledWith('[lint] theme unresolved', { theme: 'x' });
    expect(info).toHaveBeenCalledWith('[lint] done', { ms: 3 });
  });
});
