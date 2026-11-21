// The door stays tiny (blueprint ui.md "The door"; each app's web-performance spec): an editor's first load carries
// this package's entry (the host, the footer's Tools row, the gate's rule, the list), and none of the screen. A
// static import of the screen from any file the entry reaches passes every other test, and this one fails.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = __dirname;
// A re-export (`export { x } from '…'`) loads its module as surely as an import does; a type-only one loads nothing.
const staticImports = (src: string) =>
  [...src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(dirname(from), spec);
  for (const ext of ['.ts', '.tsx']) if (existsSync(base + ext)) return base + ext;
  throw new Error(`unresolved ${spec} from ${from}`);
}

/** Every file of this package the entry loads, by static import. */
function reached(entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of staticImports(readFileSync(file, 'utf8'))) {
      const next = resolve(file, spec);
      if (next) walk(next);
    }
  };
  walk(entry);
  return [...seen].map((f) => relative(SRC, f)).sort();
}

describe('the door', () => {
  it('loads the host, the row, the gate and the list, and nothing of the screen', () => {
    expect(reached(join(SRC, 'index.ts'))).toEqual([
      'AutomationsContext.tsx',
      'AutomationsHost.tsx',
      'automations-client.ts',
      'automations-gate.ts',
      'automations-tools-item.tsx',
      'glyphs.tsx',
      'index.ts',
      'kit.ts',
      'types.ts',
      'use-automations-gate.ts',
      'use-automations.ts',
    ]);
  });

  it('reaches no other package but the design system’s icons, the workbench’s log and its move-prompt flag', () => {
    const outside = new Set<string>();
    for (const file of reached(join(SRC, 'index.ts')))
      for (const spec of staticImports(readFileSync(join(SRC, file), 'utf8')))
        if (!spec.startsWith('.')) outside.add(spec);
    expect([...outside].sort()).toEqual([
      '@liveworkspace/icons/lucide',
      '@liveworkspace/ui',
      '@liveworkspace/workbench/lib/debug-log',
      // A flag and two hooks over React alone: the host waits while the move prompt after signing in is up.
      '@liveworkspace/workbench/lib/offline/local-move-showing',
      'react',
    ]);
  });

  it('reaches nothing of an item’s kit', () => {
    expect(reached(join(SRC, 'index.ts')).filter((f) => f.startsWith('item'))).toEqual([]);
  });

  // An item editor's host holds this at first load (blueprint item-ui.md "The helper"): its words, its routes and
  // their types, with no React, no panel, no picture and nothing of the kit.
  it('keeps an item’s plumbing to its own two files and the shared client', () => {
    const plumbing = reached(join(SRC, 'item', 'plumbing.ts'));
    expect(plumbing).toEqual(['automations-client.ts', 'item/client.ts', 'item/plumbing.ts']);
    const outside = new Set<string>();
    for (const file of plumbing)
      for (const spec of staticImports(readFileSync(join(SRC, file), 'utf8')))
        if (!spec.startsWith('.')) outside.add(spec);
    expect([...outside]).toEqual(['@liveworkspace/api-schema/automations']);
  });

  it('builds an item’s kit only where the lazy screen asks for it', () => {
    // The kit's own entry reaches the builder (it is the screen's chunk); nothing the door reaches imports it.
    expect(reached(join(SRC, 'item', 'index.ts'))).toContain('item/define-kit.tsx');
    for (const file of reached(join(SRC, 'index.ts')))
      for (const spec of staticImports(readFileSync(join(SRC, file), 'utf8')))
        expect(spec, file).not.toMatch(/(^|\/)item(\/|$)/);
  });

  it('leaves the screen and the gate to the app’s own lazy components', () => {
    const host = readFileSync(join(SRC, 'AutomationsHost.tsx'), 'utf8');
    expect(staticImports(host)).not.toContain('./AutomationsDialog');
    expect(staticImports(host)).not.toContain('./AutomationsSyncGate');
    expect(host).not.toMatch(/import\(/);
  });
});
