import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { photoDir, truthDir } from './truth';
import type { Truth } from '../src/truth';

// Files a label exported from the editor's review surface.
//
//   pnpm --filter @livediagram/sticky-vision truth:add ~/Downloads/wall.json
//
// The editor can only hand a browser download to the disk; this puts it where
// the sweep looks, and checks it is a label before it does. Labels live OUTSIDE
// this repo (they describe somebody's real wall): in the private
// `vision-model-truths` checkout when there is one, where the label is also
// COMMITTED AND PUSHED at once — an hour of labelling that exists only on one
// disk is an hour waiting to be lost.

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
  // A label for a photo the sweep cannot find scores nothing, silently.
  const photos = photoDir();
  if (!['.jpg', '.jpeg', '.png'].some((ext) => existsSync(`${photos}/${truth.photo}${ext}`))) {
    console.warn(
      `  warning: no photo named ${truth.photo}.* in ${photos} — add it, or rename one to match`,
    );
  }
  backUp(dir, truth, replacing !== '');
}

// Commit and push the label when the labels folder is a git checkout. Skipped,
// loudly, when it is not: the label is then only on this disk.
function backUp(dir: string, truth: Truth, replacing: boolean) {
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('rev-parse', '--is-inside-work-tree');
  } catch {
    console.warn(
      '  NOT BACKED UP: the labels folder is not a git checkout (see vision-model-truths)',
    );
    return;
  }
  git('add', `${truth.photo}.json`);
  if (git('status', '--porcelain', '--', `${truth.photo}.json`) === '') {
    console.log('  unchanged, nothing to back up');
    return;
  }
  const verb = replacing ? 'relabel' : 'label';
  git(
    'commit',
    '-m',
    `${verb} ${truth.photo} (${truth.notes.length} notes)`,
    '--',
    `${truth.photo}.json`,
  );
  git('pull', '--rebase', '--quiet');
  git('push', '--quiet');
  console.log(`  backed up: ${git('log', '--oneline', '-1')}`);
}

main();
