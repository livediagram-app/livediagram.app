// The editor's first load carries the Automations door and none of the screen (docs/specs/016-platform/
// web-performance.md; blueprint automations.md "Editor", "Performance"): the host, the footer's Tools row, the item
// and the plumbing load with the editor; the screen (the platform's dialog, the document's kit with every panel,
// picture, panel and template) and the gate load the first time each opens. A static import of either from a file the
// editor always loads passes every other test, and this one fails.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const HERE = __dirname;
const APP = join(HERE, '..', '..');
// A re-export (`export { x } from '…'`) loads its module as surely as an import does; a type-only one loads nothing.
const staticImports = (src: string) =>
  [...src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

function local(from: string, spec: string): string | null {
  const base = spec.startsWith('@/components/automations/')
    ? join(HERE, spec.slice('@/components/automations/'.length))
    : spec.startsWith('.')
      ? join(dirname(from), spec)
      : null;
  if (!base || !base.startsWith(HERE)) return null;
  for (const ext of ['.ts', '.tsx']) if (existsSync(base + ext)) return base + ext;
  throw new Error(`unresolved ${spec} from ${from}`);
}

/** Every file under components/automations the entries load by static import, and every package they name. */
function reached(entries: string[]) {
  const files = new Set<string>();
  const packages = new Set<string>();
  const walk = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    for (const spec of staticImports(readFileSync(file, 'utf8'))) {
      const next = local(file, spec);
      if (next) walk(next);
      else if (spec.startsWith('@liveworkspace/automations')) packages.add(spec);
    }
  };
  for (const entry of entries) walk(entry);
  return {
    files: [...files]
      .filter((f) => f.startsWith(HERE))
      .map((f) => relative(HERE, f))
      .sort(),
    packages: [...packages].sort(),
  };
}

describe('the editor’s first load and Automations', () => {
  // What the editor view and the footer import of Automations, and what those import in turn.
  const always = () => {
    const entries: string[] = [];
    const packages: string[] = [];
    for (const file of ['app/document/[id]/EditorView.tsx', 'components/chrome/ChromeControls.tsx'])
      for (const spec of staticImports(readFileSync(join(APP, file), 'utf8'))) {
        const next = local(join(APP, file), spec);
        if (next) entries.push(next);
        else if (spec.startsWith('@liveworkspace/automations')) packages.push(spec);
      }
    const found = reached(entries);
    return { files: found.files, packages: [...new Set([...found.packages, ...packages])].sort() };
  };

  it('loads the host, the item, the plumbing and the gate hook, and nothing of the screen', () => {
    expect(always().files).toEqual([
      'DocumentAutomationsHost.tsx',
      'document-item.ts',
      'document-plumbing.ts',
      'use-document-automations.ts',
    ]);
  });

  it('reaches the platform’s door alone, never the item kit', () => {
    const { packages } = always();
    expect(packages).toEqual([
      '@liveworkspace/automations-ui',
      '@liveworkspace/automations-ui/automations-gate',
      '@liveworkspace/automations-ui/automations-tools-item',
      '@liveworkspace/automations-ui/item/plumbing',
      '@liveworkspace/automations-ui/use-automations-gate',
    ]);
    expect(packages).not.toContain('@liveworkspace/automations-ui/item');
  });

  it('loads the screen and the gate each from a chunk of its own', () => {
    const host = readFileSync(join(HERE, 'DocumentAutomationsHost.tsx'), 'utf8');
    expect(host).toContain("import('./DocumentAutomationsScreen')");
    expect(host).toContain("import('./DocumentAutomationsGate')");
    expect(staticImports(host)).not.toContain('./document-kit');
    // The kit, the scenes and the templates reach the screen alone.
    const screen = staticImports(readFileSync(join(HERE, 'DocumentAutomationsScreen.tsx'), 'utf8'));
    expect(screen).toContain('./document-kit');
  });
});
