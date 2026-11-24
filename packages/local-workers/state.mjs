// One Miniflare keeps one state folder for all its Workers (D1, KV, R2, Durable Objects). So each Worker's own
// `.wrangler/state` becomes a link to the group's shared one: its migrations, its seed scripts and any
// `wrangler d1 execute --local` run in its folder keep reaching the same data the group runs on. A Worker's existing
// state is copied in first (never over what the shared folder already holds) and its old folder kept beside the link,
// so nothing local is lost.

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  renameSync,
  symlinkSync,
} from 'node:fs';
import path from 'node:path';

/**
 * Point `<dir>/.wrangler/state` at `shared`. Returns what happened: 'linked' (no state before), 'merged' (its state
 * copied in, the old folder kept at `kept`), 'kept' (already linked here) or 'foreign' (a link elsewhere, left alone).
 */
export function shareState(dir, shared) {
  mkdirSync(shared, { recursive: true });
  const own = path.join(dir, '.wrangler', 'state');
  let stat = null;
  try {
    stat = lstatSync(own);
  } catch {
    // No state yet.
  }
  if (stat?.isSymbolicLink()) {
    return path.resolve(path.dirname(own), readlinkSync(own)) === path.resolve(shared)
      ? { outcome: 'kept' }
      : { outcome: 'foreign' };
  }
  mkdirSync(path.dirname(own), { recursive: true });
  if (!stat) {
    symlinkSync(shared, own, 'dir');
    return { outcome: 'linked' };
  }
  cpSync(own, shared, { recursive: true, force: false, errorOnExist: false });
  let kept = `${own}.before-shared`;
  for (let n = 2; existsSync(kept); n++) kept = `${own}.before-shared-${n}`;
  renameSync(own, kept);
  symlinkSync(shared, own, 'dir');
  return { outcome: 'merged', kept };
}
