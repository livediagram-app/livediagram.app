import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureWorkbench,
  resetWorkbenchForTests,
  workbench,
  WORKBENCH_DEFAULTS,
} from './bindings';
import { testBindings } from './lib/testing/bindings';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetWorkbenchForTests();
});

describe('workbench bindings', () => {
  it('reads safe defaults before any editor configures it', () => {
    expect(workbench.debugKey).toBe('workbench:debug');
    expect(workbench.reloadGuardKey).toBe('workbench:stale-chunk-reloads');
    expect(workbench.formatLogScope).toBe('document-format');
  });

  it('reads what the editor configured, when read', () => {
    configureWorkbench(testBindings({ debugKey: 'product:debug' }));
    expect(workbench.debugKey).toBe('product:debug');
  });

  it('warns once in development when read before it is configured', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    void workbench.debugKey;
    void workbench.debugKey;
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet outside development, and once configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    void workbench.debugKey;
    vi.stubEnv('NODE_ENV', 'development');
    configureWorkbench(testBindings());
    void workbench.debugKey;
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps its defaults frozen', () => {
    expect(Object.isFrozen(WORKBENCH_DEFAULTS)).toBe(true);
  });
});
