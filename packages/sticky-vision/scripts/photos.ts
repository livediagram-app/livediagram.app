import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { ImageBuffer } from '../src/colour';
import { decodePng } from './png';

// Getting real wall photographs in front of the detector, without any of them
// — or anything derived from them — ever landing in the repo.
//
// The photos are somebody's actual workshop (spec/139), so the cache and the
// overlays live under the system temp directory, keyed by the folder they came
// from. A JPEG straight off a phone is converted once, at the SAME working
// size the editor detects at, so a number measured here is a number the editor
// will reproduce.

// The editor scales to this before detecting (`PHOTO_MAX_EDGE_PX` in
// `@livediagram/api-schema`). Calibrating at any other size measures a
// detector nobody runs.
export const WORKING_EDGE_PX = 1000;

const PHOTO_EXTENSIONS = /\.(jpe?g|png)$/i;

export function workDirFor(photoDir: string): string {
  const abs = resolve(photoDir);
  const key = createHash('sha1').update(abs).digest('hex').slice(0, 10);
  const dir = `${tmpdir()}/livediagram-sticky-vision/${key}`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function listPhotos(photoDir: string): string[] {
  return readdirSync(photoDir)
    .filter((f) => PHOTO_EXTENSIONS.test(f))
    .sort();
}

function converter(): { cmd: string; auto: boolean } {
  for (const cmd of ['magick', 'convert']) {
    try {
      execFileSync(cmd, ['-version'], { stdio: 'ignore' });
      return { cmd, auto: true };
    } catch {
      // try the next one
    }
  }
  throw new Error(
    'No ImageMagick on PATH. Install `magick` (or `convert`) to calibrate against JPEG photos.',
  );
}

// A JPEG becomes a working-size PNG once, outside the repo. PNG photos are
// resized the same way, so every photo is measured at the editor's size.
function workingPng(photoDir: string, name: string, workDir: string): string {
  const out = `${workDir}/work-${name.replace(PHOTO_EXTENSIONS, '')}.png`;
  if (existsSync(out)) return out;
  const { cmd } = converter();
  execFileSync(cmd, [
    `${photoDir}/${name}`,
    '-auto-orient',
    '-resize',
    `${WORKING_EDGE_PX}x${WORKING_EDGE_PX}`,
    '-strip',
    `png24:${out}`,
  ]);
  return out;
}

// Decode once, iterate a hundred times. A raw RGBA dump beside the working PNG
// is the difference between a six-minute loop and a two-second one.
export function loadPhoto(photoDir: string, name: string): ImageBuffer {
  const workDir = workDirFor(photoDir);
  const cache = `${workDir}/${name}.rgba`;
  const meta = `${workDir}/${name}.json`;
  if (existsSync(cache) && existsSync(meta)) {
    const { width, height } = JSON.parse(readFileSync(meta, 'utf8')) as {
      width: number;
      height: number;
    };
    return { width, height, data: new Uint8ClampedArray(readFileSync(cache)) };
  }
  const image = decodePng(workingPng(photoDir, name, workDir));
  writeFileSync(cache, Buffer.from(image.data.buffer));
  writeFileSync(meta, JSON.stringify({ width: image.width, height: image.height }));
  return image;
}
