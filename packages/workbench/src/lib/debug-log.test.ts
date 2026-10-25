import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureWorkbench, resetWorkbenchForTests } from '../bindings';
import { debugLogEnabled, debugScopeOf, debugScopeOn } from './debug-log';
import { testBindings } from './testing/bindings';

// docs/specs/003-system-architecture/console-logging.md: trace lines show in development and tests,
// and in production only when the debug flag names their scope.
const KEY = 'product:debug';
beforeEach(() => configureWorkbench(testBindings({ debugKey: KEY })));
afterEach(() => {
  vi.unstubAllEnvs();
  resetWorkbenchForTests();
});

describe('debugScopeOf', () => {
  it('reads the bracketed fingerprint, or the word before a colon', () => {
    expect(debugScopeOf('[room] malformed op dropped')).toBe('room');
    expect(debugScopeOf('[board-scene] landed')).toBe('board-scene');
    expect(debugScopeOf('home: start moved=1')).toBe('home');
    expect(debugScopeOf('no scope here')).toBe('');
  });
});

describe('debugLogEnabled', () => {
  const flag = (value: string | null) => ({
    getItem: (k: string) => (k === KEY ? value : null),
  });

  it('is on outside a production build', () => {
    expect(debugLogEnabled('room', 'development', flag(null))).toBe(true);
    expect(debugLogEnabled('room', 'test', null)).toBe(true);
  });

  it('is off in production without the flag, and when storage is missing', () => {
    expect(debugLogEnabled('room', 'production', flag(null))).toBe(false);
    expect(debugLogEnabled('room', 'production', null)).toBe(false);
    expect(debugLogEnabled('room', 'production', flag(''))).toBe(false);
  });

  it('follows the flag in production: everything, or the scopes it names', () => {
    expect(debugLogEnabled('room', 'production', flag('*'))).toBe(true);
    expect(debugLogEnabled('room', 'production', flag('board-scene, room'))).toBe(true);
    expect(debugLogEnabled('photo-model', 'production', flag('board-scene,room'))).toBe(false);
  });

  it("reads the flag under the product's key, and no other", () => {
    configureWorkbench(testBindings({ debugKey: 'other:debug' }));
    expect(debugLogEnabled('room', 'production', flag('*'))).toBe(false);
  });

  it('treats a storage that throws as no flag', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(debugLogEnabled('room', 'production', throwing)).toBe(false);
  });
});

// An inline boot script (stale-html-guard.ts in each editor) cannot import this module; it embeds the
// same rule as one static source, its settings handed over as data.

describe('debugScopeOn', () => {
  it('says a scope logs, as its trace lines would, outside production', () => {
    expect(debugScopeOn('canvas-perf')).toBe(true);
  });
});
