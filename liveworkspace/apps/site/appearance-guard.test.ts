import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The site has one Appearance setting: livediagram's store, which the boot script and the header's
// toggle use (liveworkspace/docs/site.md "Behaviour"). liveplanner's UI package keeps its own store
// under its own key and paints <html> from it once anything subscribes, so the dashboard flipped
// between light and dark when liveplanner was picked. Nothing here may read appearance from it.
const PLANNER_APPEARANCE =
  /import\s*\{[^}]*\b(useAppearance|setAppearance|subscribeAppearance|applyAppearance|getResolvedAppearance|SiteAppearanceToggle|APPEARANCE_BOOT_SCRIPT)\b[^}]*\}\s*from\s*'@liveplanner\/ui'/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'out' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('site appearance', () => {
  it("reads appearance only from livediagram's store", () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => sources(join(import.meta.dirname, dir)))
      .filter((path) => PLANNER_APPEARANCE.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
