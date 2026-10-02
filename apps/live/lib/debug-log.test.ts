import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEBUG_STORAGE_KEY, debugLogEnabled, debugScopeOf } from './debug-log';

// docs/specs/003-system-architecture/console-logging.md: trace lines show in development and tests,
// and in production only when the debug flag names their scope.
afterEach(() => vi.unstubAllEnvs());

describe('debugScopeOf', () => {
  it('reads the bracketed fingerprint, or the word before a colon', () => {
    expect(debugScopeOf('[drive-mirror] pass-end')).toBe('drive-mirror');
    expect(debugScopeOf('[board-scene] landed')).toBe('board-scene');
    expect(debugScopeOf('drive: start-token moved=1')).toBe('drive');
    expect(debugScopeOf('no scope here')).toBe('');
  });
});

describe('debugLogEnabled', () => {
  const flag = (value: string | null) => ({
    getItem: (k: string) => (k === DEBUG_STORAGE_KEY ? value : null),
  });

  it('is on outside a production build', () => {
    expect(debugLogEnabled('drive-mirror', 'development', flag(null))).toBe(true);
    expect(debugLogEnabled('drive-mirror', 'test', null)).toBe(true);
  });

  it('is off in production without the flag, and when storage is missing', () => {
    expect(debugLogEnabled('drive-mirror', 'production', flag(null))).toBe(false);
    expect(debugLogEnabled('drive-mirror', 'production', null)).toBe(false);
    expect(debugLogEnabled('drive-mirror', 'production', flag(''))).toBe(false);
  });

  it('follows the flag in production: everything, or the scopes it names', () => {
    expect(debugLogEnabled('drive-mirror', 'production', flag('*'))).toBe(true);
    expect(debugLogEnabled('drive-mirror', 'production', flag('board-scene, drive-mirror'))).toBe(
      true,
    );
    expect(debugLogEnabled('photo-model', 'production', flag('board-scene,drive-mirror'))).toBe(
      false,
    );
  });

  it('treats a storage that throws as no flag', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(debugLogEnabled('drive-mirror', 'production', throwing)).toBe(false);
  });
});

// No direct console.info / console.log / console.debug outside the logger.
describe('the console convention', () => {
  it('holds across apps/live', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join, relative } = await import('node:path');
    const root = join(__dirname, '..');
    const skip = new Set(['node_modules', '.next', '.next-dev', 'out', 'e2e', 'scripts', 'public']);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (
          /\.(ts|tsx)$/.test(name) &&
          !/\.test\.tsx?$/.test(name) &&
          name !== 'debug-log.ts'
        ) {
          const text = readFileSync(path, 'utf8');
          if (/console\.(info|log|debug)\(/.test(text)) offenders.push(relative(root, path));
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

// An inline boot script (stale-html-guard.ts) cannot import this module; it embeds the same rule as
// one static source, its settings handed over as data.
