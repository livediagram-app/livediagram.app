import { afterEach, describe, expect, it, vi } from 'vitest';
import { SKIP_TYPECHECK_ENV, typescriptConfig } from './index.js';

describe('typescriptConfig', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the type check when the variable is unset', () => {
    expect(typescriptConfig({})).toEqual({ ignoreBuildErrors: false });
  });

  it('keeps the type check for any value but 1', () => {
    expect(typescriptConfig({ [SKIP_TYPECHECK_ENV]: 'true' })).toEqual({
      ignoreBuildErrors: false,
    });
    expect(typescriptConfig({ [SKIP_TYPECHECK_ENV]: '0' })).toEqual({ ignoreBuildErrors: false });
  });

  it('skips the type check and says so when the variable is 1', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(typescriptConfig({ [SKIP_TYPECHECK_ENV]: '1' })).toEqual({ ignoreBuildErrors: true });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('skips its type check'));
  });
});
