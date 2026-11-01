import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraphTab, resolveGraphInput, type GraphInput } from '@livehuddle/document';
import { routeMeasures, type RouteMeasures } from './route-measures';

// The routing fixtures (plan 0026): the graphs and Mermaid the MCP evals wrote, built as create_document builds them,
// measured, and held at or under the committed baseline, so routing only gets better. Run with
// UPDATE_ROUTING_BASELINE=1 to write a new baseline after an improvement.

const DIR = join(__dirname, 'routing');
const BASELINE = join(__dirname, 'routing-baseline.json');

function tabOf(file: string) {
  const input = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as {
    graph?: GraphInput;
    mermaid?: string;
  };
  const resolved = resolveGraphInput(input);
  if (!resolved.graph) throw new Error(`${file}: ${resolved.error}`);
  return buildGraphTab('t', 'T', resolved.graph, undefined);
}

const NUMERIC: readonly (keyof RouteMeasures)[] = [
  'shared',
  'crossed',
  'strikes',
  'kinks',
  'crossings',
  'behind',
  'collisions',
];

describe('routing fixtures', () => {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const measured = Object.fromEntries(
    files.map((f) => [f.replace(/\.json$/, ''), routeMeasures(tabOf(f))]),
  );

  it('measures every fixture at or under its baseline', () => {
    if (process.env.UPDATE_ROUTING_BASELINE)
      writeFileSync(BASELINE, JSON.stringify(measured, null, 2) + '\n');
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, RouteMeasures>;
    for (const [name, now] of Object.entries(measured)) {
      const was = baseline[name];
      expect(was, `${name} has no baseline`).toBeDefined();
      for (const key of NUMERIC)
        expect(now[key], `${name} ${key}`).toBeLessThanOrEqual(was![key] as number);
    }
  });
});
