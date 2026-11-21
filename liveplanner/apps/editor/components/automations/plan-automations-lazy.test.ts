// The editor's first load carries the Automations door and none of the screen (docs/specs/016-platform/
// web-performance.md; the platform's blueprint ui.md "The door"): the host, the footer's Tools row, the plumbing
// and the return from GitHub load with the editor; the screen (the platform's dialog, the plan's kit with every
// panel, picture and template) and the gate load the first time each opens. A static import of either from a file
// the editor always loads passes every other test, and this one fails.
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
      else if (spec.startsWith('@liveworkspace/automations-ui')) packages.add(spec);
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
  // What the editor view, its hooks and the footer import of Automations.
  const always = () => {
    const entries: string[] = [];
    for (const file of [
      'app/project/[id]/EditorView.tsx',
      'app/project/[id]/editor-view-hooks.ts',
      'components/chrome/ChromeControls.tsx',
    ])
      for (const spec of staticImports(readFileSync(join(APP, file), 'utf8'))) {
        const next = local(join(APP, file), spec);
        if (next) entries.push(next);
      }
    return reached(entries);
  };

  it('loads the host, the plumbing and the routes, and nothing of the screen', () => {
    expect(always().files).toEqual([
      'PendingStarterRules.tsx',
      'PlanAutomationsHost.tsx',
      'automations-client.ts',
      'github/GithubReturn.tsx',
      'github/github-hash.ts',
      'plan-client.ts',
      'plan-plumbing.ts',
      'use-automations.ts',
    ]);
  });

  it('reaches the platform’s door alone: its entry, its routes, its list and the session’s context', () => {
    expect(always().packages).toEqual([
      '@liveworkspace/automations-ui',
      '@liveworkspace/automations-ui/AutomationsContext',
      '@liveworkspace/automations-ui/automations-client',
      '@liveworkspace/automations-ui/use-automations',
    ]);
  });

  it('loads the screen and the gate each from a chunk of its own', () => {
    const host = readFileSync(join(HERE, 'PlanAutomationsHost.tsx'), 'utf8');
    expect(host).toContain("import('./PlanAutomationsScreen')");
    expect(host).toContain("import('./PlanAutomationsGate')");
    expect(staticImports(host)).not.toContain('./plan-kit');
    // The reader's sheet too: a rule's name on a card opens it without the builder.
    const author = readFileSync(join(HERE, 'AutomationAuthor.tsx'), 'utf8');
    expect(author).toContain("import('./PlanRuleSummarySheet')");
    expect(
      staticImports(readFileSync(join(HERE, 'PlanRuleSummarySheet.tsx'), 'utf8')),
    ).not.toContain('./plan-kit');
  });
});
