import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Marketing's share rail sits beside a max-w-6xl page from xl. A wider max-w-7xl column fills the
// window there, so its text ran under the rail at 1280px; each one takes RAIL_CLEAR_PADDING
// (../packages/ui/src/share-rail-clearance.ts) instead of its own side padding.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.tsx$/.test(e.name) && !/\.test\./.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

describe('share rail clearance', () => {
  const files = [...sources('app'), ...sources('components')];

  it('gives every max-w-7xl column the rail-clear padding', () => {
    const wide = files.filter((f) => readFileSync(join(ROOT, f), 'utf8').includes('max-w-7xl'));
    expect(wide.length).toBeGreaterThan(0);
    for (const f of wide) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      for (const line of src.split('\n').filter((l) => l.includes('max-w-7xl'))) {
        expect(line, f).toContain('${RAIL_CLEAR_PADDING}');
        expect(line, f).not.toMatch(/\bpx-\d/);
      }
    }
  });
});
