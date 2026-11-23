// An editor's first load carries the Ask AI row and none of the tool (liveworkspace/docs/specs/019-ask/ask.md "What
// it costs"): the hook an editor calls and the row it publishes load with the editor; the tool, the conversation, the
// client, the popovers and the settings line load when the row is first opened. A static import of any of them from
// what the editor always loads passes every other test, and this one fails.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = __dirname;
const REPO = join(UI, '..', '..', '..', '..');

// A re-export loads its module as surely as an import does; a type-only one loads nothing.
const staticImports = (src: string) =>
  [...src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

function reached(entry: string) {
  const files = new Set<string>();
  const packages = new Set<string>();
  const walk = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    for (const spec of staticImports(readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) {
        packages.add(spec);
        continue;
      }
      const base = join(dirname(file), spec);
      const found = ['.ts', '.tsx'].map((ext) => base + ext).find((path) => existsSync(path));
      if (!found) throw new Error(`unresolved ${spec} from ${file}`);
      walk(found);
    }
  };
  walk(entry);
  return {
    files: [...files].map((file) => relative(join(UI, '..'), file)).sort(),
    packages: [...packages].sort(),
  };
}

describe("an editor's first load and Ask AI", () => {
  it('loads the hook, the row and the walk, and nothing of the tool', () => {
    const { files, packages } = reached(join(UI, 'use-ask-tool.ts'));
    expect(files).toEqual([
      'limits.ts',
      'ui/ask-tools-item.tsx',
      'ui/tab-passages.ts',
      'ui/use-ask-tool.ts',
    ]);
    expect(packages).toEqual([
      '@liveworkspace/sites',
      '@liveworkspace/ui',
      '@liveworkspace/ui/tool-explainer',
      '@liveworkspace/workbench/components/chrome/tools-door',
      'react',
    ]);
  });

  it('reaches the tool only through a dynamic import', () => {
    const row = readFileSync(join(UI, 'ask-tools-item.tsx'), 'utf8');
    expect(row).toContain("lazy(() => import('./AskTool')");
  });

  it.each([
    'livediagram/apps/editor',
    'liveplanner/apps/editor',
    'livedocuments/apps/editor',
    'livedesign/apps/live',
    'livehuddle/apps/editor',
  ])('%s takes the hook alone', (editor) => {
    const specs = staticImports(
      readFileSync(join(REPO, editor, 'components', 'panels', 'useAskAi.ts'), 'utf8'),
    ).filter((spec) => spec.startsWith('@liveworkspace/ask'));
    expect(specs).toEqual(['@liveworkspace/ask/use-ask-tool']);
  });
});
