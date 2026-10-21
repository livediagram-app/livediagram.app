import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Tailwind's stock looping animations (animate-ping, -pulse, -spin, -bounce) run forever and ignore
// prefers-reduced-motion unless gated. Marketing's own loops settle under reduced motion in their
// stylesheets (app/feature-art/*.css, hero-animations.css); a utility class needs the motion-safe:
// variant to do the same. The status page's pulse ran for reduced-motion visitors until this test.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['app', 'components', 'lib'];
const BARE_LOOP = /(?<![\w:-])animate-(?:ping|pulse|spin|bounce)\b/g;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

describe('looping Tailwind animations', () => {
  it('are always gated on motion-safe:', () => {
    const files = DIRS.flatMap((d) => sources(join(ROOT, d)));
    expect(files.length).toBeGreaterThan(20);
    const bare = files.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(BARE_LOOP)].map(
        (m) => `${f.slice(ROOT.length)}: ${m[0]}`,
      ),
    );
    expect(bare).toEqual([]);
  });
});
