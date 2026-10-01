// Prints a stored tab or document JSON file with every freehand's `packedPoints` expanded into
// readable `{ nx, ny, p }` points (docs/specs/006-document/stroke-points.md), for debugging.
//   pnpm --filter @livediagram/document stroke-points <file.json>   (or - for stdin)
import { readFileSync } from 'node:fs';
import { expandPackedPoints } from '../src/stroke-points-debug';

const file = process.argv[2];
if (!file) {
  console.error('usage: stroke-points <file.json | ->');
  process.exit(2);
}
const text = readFileSync(file === '-' ? 0 : file, 'utf8');
let parsed: unknown;
try {
  parsed = JSON.parse(text);
} catch (error) {
  console.error(`[stroke-points] not JSON: ${(error as Error).message}`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(expandPackedPoints(parsed), null, 2)}\n`);
