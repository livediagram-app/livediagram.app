// Local verification of the Microsoft Whiteboard import over real board exports
// (docs/specs/020-import-export/blueprints/ms-whiteboard-import.md). Data-free: the export's path is
// an argument, and the output is aggregate counts and timings only (never titles, ids or text).
//
//   bun scripts/ms-whiteboard-verify.mts <folder or .zip>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ExportFileSet } from '@/lib/ms-whiteboard/board-export';
import { fileSetFromZip } from '@/lib/ms-whiteboard/file-sets';
import { boardSceneOf, listBoards } from '@/lib/ms-whiteboard/import';
import { landBoardScene } from '@/lib/board-scene/land';

const path = process.argv[2];
if (!path) {
  console.error('usage: bun scripts/ms-whiteboard-verify.mts <folder or .zip>');
  process.exit(2);
}

function folderFiles(root: string): ExportFileSet {
  const files: ExportFileSet = new Map();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.set(relative(root, full), async () => new Uint8Array(readFileSync(full)));
    }
  };
  walk(root);
  return files;
}

const add = (into: Record<string, number>, key: string, n = 1) => {
  into[key] = (into[key] ?? 0) + n;
};

async function main() {
  const quiet = console.info;
  console.info = () => {};
  console.warn = () => {};
  let files: ExportFileSet;
  if (path!.endsWith('.zip')) {
    const set = fileSetFromZip(new Uint8Array(readFileSync(path!)));
    if (!set.ok) throw new Error(`zip refused: ${set.rejection}`);
    files = set.files;
  } else files = folderFiles(path!);

  const t0 = performance.now();
  const listed = await listBoards(files);
  if (!listed.ok) throw new Error(listed.error);
  const items: Record<string, number> = {};
  const landed: Record<string, number> = {};
  const notes: Record<string, number> = {};
  const replay = {
    changes: 0,
    applied: 0,
    undone: 0,
    skippedEdits: 0,
    staleReplaces: 0,
    misplacedInserts: 0,
    ignoredCommands: 0,
  };
  let slowest = 0;
  let rejected = 0;
  let crashed = 0;
  for (const board of listed.boards) {
    const t = performance.now();
    try {
      for (const [k, v] of Object.entries(board.prepared.replayed.stats))
        replay[k as keyof typeof replay] += v;
      const scene = await boardSceneOf(files, board);
      for (const item of scene.items) add(items, item.kind);
      const result = landBoardScene(scene, {
        profile: 'whiteboard',
        placement: { kind: 'origin' },
        mintId: () => crypto.randomUUID(),
      });
      if (!result.ok) rejected++;
      else {
        for (const [k, v] of Object.entries(result.report.landed)) add(landed, k, v);
        for (const n of [...result.report.degraded, ...result.report.skipped])
          add(notes, n.rule, n.count);
      }
    } catch (error) {
      crashed++;
      quiet('crash', (error as Error).name);
    }
    slowest = Math.max(slowest, performance.now() - t);
  }
  console.info = quiet;
  console.info({
    boards: listed.boards.length,
    unreadable: listed.failures.length,
    rejected,
    crashed,
    totalMs: Math.round(performance.now() - t0),
    slowestBoardMs: Math.round(slowest),
    replay,
    sceneItems: items,
    landed,
    notes,
  });
}

void main();
