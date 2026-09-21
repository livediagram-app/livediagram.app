import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { truthDir } from './truth';
import type { Truth } from '../src/truth';

// Files a label exported from the editor's review surface.
//
//   pnpm --filter @livediagram/sticky-vision truth:add ~/Downloads/wall.json
//
// The editor can only hand a browser download to the disk; this puts it where
// the sweep looks, and checks it is a label before it does. Labels live OUTSIDE
// this repo (they describe somebody's real wall), so this is a copy into the
// operator's own data directory, never into the working tree.

function check(path: string): Truth {
  if (!existsSync(path)) throw new Error(`No such file: ${path}`);
  const truth = JSON.parse(readFileSync(path, 'utf8')) as Partial<Truth>;
  if (typeof truth.photo !== 'string' || truth.photo === '') {
    throw new Error(`${basename(path)} has no photo name in it`);
  }
  if (!Array.isArray(truth.notes) || truth.notes.length === 0) {
    throw new Error(`${basename(path)} has no notes in it`);
  }
  const outside = truth.notes.filter(
    (note) => note.x < 0 || note.y < 0 || note.x + note.w > 1.001 || note.y + note.h > 1.001,
  );
  // Fractions, not pixels: a file written in pixels would score everything as
  // a miss and look like a detector regression.
  if (outside.length > 0) {
    throw new Error(
      `${basename(path)}: ${outside.length} notes fall outside the image — are these pixels rather than fractions?`,
    );
  }
  return truth as Truth;
}

function main() {
  const [source] = process.argv.slice(2);
  if (source === undefined) {
    console.error('usage: truth-add <exported-label.json>');
    process.exit(1);
  }
  const truth = check(source);
  const dir = truthDir();
  mkdirSync(dir, { recursive: true });
  const target = `${dir}/${truth.photo}.json`;
  const replacing = existsSync(target)
    ? ` (replacing ${(JSON.parse(readFileSync(target, 'utf8')) as Truth).notes.length} notes)`
    : '';
  copyFileSync(source, target);
  console.log(`${truth.photo}: ${truth.notes.length} notes${replacing} → ${target}`);
}

main();
