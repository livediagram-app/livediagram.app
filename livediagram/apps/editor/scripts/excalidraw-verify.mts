// Real Excalidraw copies through the parser and the landing, both profiles
// (docs/specs/020-import-export/blueprints/excalidraw-import.md "Testing").
//
// A script, not a test: real boards are personal content and never fixtures. It reads the paths it
// is given and prints only aggregates (counts per kind, notes, validity, timing), never text,
// names, ids or coordinates, so its output is safe to share.
//
//   pnpm --filter @livediagram/live exec tsx scripts/excalidraw-verify.mts <file.json> [...]
//
// Exits non-zero when a file is refused, a landing is rejected, or any landed element is invalid.

import { readFileSync } from 'node:fs';
import { isValidElement, type Element } from '@livediagram/document';
import { landBoardScene, type BoardSceneProfile } from '../lib/board-scene/land';
import { sceneFromExcalidrawText } from '../lib/excalidraw-read';

const countBy = <T,>(items: T[], key: (t: T) => string) => {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return out;
};

// How each landed element's colours came across: board ink, a named stock colour, or a hex.
const colourOf = (el: Element) => {
  const named = 'penColour' in el && el.penColour;
  if (named) return 'stock';
  const hex = 'strokeColor' in el && el.strokeColor;
  return hex ? 'hex' : 'ink';
};

let failed = false;
const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('usage: excalidraw-verify.mts <file.json> [...]');
  process.exit(2);
}
paths.forEach((path, i) => {
  const label = `input ${i + 1}`;
  const started = performance.now();
  const read = sceneFromExcalidrawText(readFileSync(path, 'utf8'));
  if (!read.ok) {
    console.log(label, 'REFUSED', read.error);
    failed = true;
    return;
  }
  const parsed = performance.now() - started;
  const { scene } = read;
  console.log(label, {
    items: scene.items.length,
    kinds: countBy(scene.items, (it) => it.kind),
    assets: scene.assets.length,
    notes: scene.notes,
    parseMs: Math.round(parsed),
  });
  for (const profile of ['whiteboard', 'diagram'] as BoardSceneProfile[]) {
    const t = performance.now();
    const landed = landBoardScene(scene, {
      profile,
      placement: { kind: 'at', x: 0, y: 0 },
      mintId: () => crypto.randomUUID(),
    });
    if (!landed.ok) {
      console.log(label, profile, 'REJECTED', landed.rejection);
      failed = true;
      continue;
    }
    const invalid = landed.elements.filter((el) => !isValidElement(el)).length;
    if (invalid > 0) failed = true;
    console.log(label, profile, {
      elements: landed.elements.length,
      types: countBy(landed.elements, (el) => el.type),
      colours: countBy(landed.elements, colourOf),
      pinnedArrowEnds: landed.elements
        .filter((el) => el.type === 'arrow')
        .flatMap((el) => [el.from, el.to])
        .filter((end) => end.kind === 'pinned').length,
      // Strokes land as one packed block of points, never a points array.
      strokes: countBy(
        landed.elements.filter((el) => el.type === 'freehand'),
        (el) => ('points' in el ? 'unpacked' : 'packedPoints' in el ? 'packed' : 'none'),
      ),
      invalid,
      report: landed.report,
      landMs: Math.round(performance.now() - t),
    });
  }
});
process.exit(failed ? 1 : 0);
