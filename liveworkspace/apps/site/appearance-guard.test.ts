import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The site has one Appearance setting: its own store (lib/appearance/), under the key of the app whose address the
// page is on, or the platform's on liveworkspace.app, which the boot script, the rail's and the Explorer bar's
// toggles and every colour decision read (liveworkspace/docs/specs/010-site/site.md "Behaviour"). Each product's UI
// package keeps its own store under its own key and paints <html> from it once anything subscribes: liveplanner's
// once flipped the dashboard between light and dark, and livediagram's made the Explorer on every other app's
// address ignore that app's choice. Nothing here may read appearance from any of them.
const OTHER_APPEARANCE =
  /import\s*\{[^}]*\b(useAppearance|setAppearance|subscribeAppearance|applyAppearance|getResolvedAppearance|SiteAppearanceToggle|APPEARANCE_BOOT_SCRIPT)\b[^}]*\}\s*from\s*'@(livediagram|liveplanner|livedocuments|livedesign|livehuddle)\/ui'/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'out' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('site appearance', () => {
  it("reads appearance only from the site's own store", () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => sources(join(import.meta.dirname, dir)))
      .filter((path) => OTHER_APPEARANCE.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
