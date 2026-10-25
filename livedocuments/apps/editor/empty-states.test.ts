import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Empty is an empty state (docs/specs/004-interface-design/empty-states.md): a list, picker or panel with nothing to
// show draws CompactEmptyState, EmptyState or NoMatches, never a bare line of grey text. This scans the editor's
// sources for "No <things> yet" or "No <things> found" written as JSX text, which is how a bare line looks; the
// shared components take their heading as a `title` prop, which this does not match.

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = [
  'app',
  'components',
  'hooks',
  'lib',
  // The editor code every editor shares (@liveworkspace/workbench) renders here too, so it is held to the rule as well.
  '../../../packages/workbench/src',
];
// JSX text on the tag's line (`<p>No links yet.</p>`) or wrapped onto its own line by Prettier.
const BARE_EMPTY = [
  />\s*No [a-z][^<>{}'"`]*\b(yet|found)\.?\s*</,
  /^\s+No [a-z][^<>{}'"`=:]*\b(yet|found)\.?\s*$/,
];
// A canvas element's drawn face keeps its own look ("What is not an empty state").
const DRAWN_FACES = [
  'components/canvas/entity/EntityView.tsx',
  'components/canvas/collab/estimate/EstimateEmpty.tsx',
  'components/canvas/collab/temperature/MoodMeter.tsx',
  'components/plan/widgets/BoardWidgetView.tsx',
];

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) yield path;
  }
}

describe('empty is an empty state', () => {
  it('writes no "No <things> yet" as a bare line of text', () => {
    const offenders: string[] = [];
    for (const dir of DIRS)
      for (const file of sources(join(ROOT, dir))) {
        const rel = relative(ROOT, file);
        if (DRAWN_FACES.includes(rel)) continue;
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (BARE_EMPTY.some((re) => re.test(line)))
              offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
          });
      }
    expect(offenders).toEqual([]);
  });
});
