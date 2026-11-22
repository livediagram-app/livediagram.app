import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generatedFiles, iconSources, prune } from './build-scopes.mjs';

// The checked-in generated files are exactly what the build script writes for livediagram, so `next dev` without a
// predev step serves livediagram and a build leaves the tree as it found it.
const APP = fileURLToPath(new URL('..', import.meta.url));

describe('build-scopes', () => {
  it("checks in livediagram's generated files", () => {
    for (const [path, text] of Object.entries(
      generatedFiles('livediagram') as Record<string, string>,
    ))
      expect(readFileSync(join(APP, path), 'utf8'), path).toBe(text);
  });

  it('gives each scope its own theme, bindings and edition', () => {
    const all = generatedFiles('all') as Record<string, string>;
    expect(all['app/scope.generated.css']).toContain("@import '../editions/all/theme.css';");
    expect(all['lib/bindings.generated.ts']).toContain("from './bindings/all'");
    const planner = generatedFiles('liveplanner') as Record<string, string>;
    expect(planner['app/scope.generated.css']).toContain(
      "@import '@liveplanner/ui/hero-band.css';",
    );
    expect(planner['editions/current.generated.ts']).toContain("from './liveplanner/edition'");
  });

  it("copies every scope's icons from inside the help centre (no product help app)", () => {
    for (const scope of [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
      'all',
    ]) {
      for (const source of Object.values(iconSources(scope) as Record<string, string>)) {
        expect(source, scope).not.toMatch(/apps\/help\//);
        expect(existsSync(join(APP, source)), source).toBe(true);
      }
    }
  });

  it("prunes a route that is not the scope's whole: its page, its payloads and its card, never its subpages", () => {
    const dir = mkdtempSync(join(tmpdir(), 'help-prune-'));
    const put = (path: string) => {
      mkdirSync(join(dir, path, '..'), { recursive: true });
      writeFileSync(join(dir, path), '');
    };
    for (const file of ['index.html', 'index.txt', '__next.canvas.__PAGE__.txt'])
      put(`canvas/${file}`);
    put('canvas/links/index.html');
    put('og/canvas.png');
    put('about/index.html');
    const manifest = {
      articles: { 'canvas/links': ['liveknowledge'], about: ['liveknowledge', 'livediagram'] },
      categories: { canvas: ['livediagram'] },
    };
    expect(prune(dir, 'liveknowledge', manifest)).toBe(1);
    expect(readdirSync(join(dir, 'canvas'))).toEqual(['links']);
    expect(existsSync(join(dir, 'canvas/links/index.html'))).toBe(true);
    expect(existsSync(join(dir, 'og/canvas.png'))).toBe(false);
    expect(existsSync(join(dir, 'about/index.html'))).toBe(true);
  });
});
