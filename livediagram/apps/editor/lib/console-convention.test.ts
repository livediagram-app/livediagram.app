import { describe, expect, it } from 'vitest';

// docs/specs/003-system-architecture/console-logging.md: trace lines go through the one logger
// (@liveworkspace/workbench/lib/debug-log.ts).
// No direct console.info / console.log / console.debug outside the logger.
describe('the console convention', () => {
  it('holds across apps/editor', async () => {
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
    // The editor code every editor shares (@liveworkspace/workbench) keeps the convention too.
    walk(join(root, '../../../packages/workbench/src'));
    // So does Avatar mode's (@liveworkspace/avatar).
    walk(join(root, '../../../packages/avatar/src'));
    expect(offenders).toEqual([]);
  });
});
