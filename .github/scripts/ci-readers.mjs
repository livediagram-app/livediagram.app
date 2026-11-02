// The test suites that read files outside their own workspace (docs/ci.md "Suites that read other
// workspaces"), from turbo.json: a `<workspace>#test` or `<workspace>#test:coverage` task whose inputs
// name `$TURBO_ROOT$/…` paths. Turbo hashes those inputs, so its cache never replays a stale pass, but
// `turbo ls --affected` only follows the package graph: a change to liveplanner/apps/… never reached
// @liveworkspace/site, whose telemetry suite scans it, so the pull request passed and main went red at
// the next change that did reach the site. ci-plan adds the readers a change reaches with these.

import { readFileSync } from 'node:fs';

const ROOT = '$TURBO_ROOT$/';
const TEST_TASK = /^(.+)#(test|test:coverage)$/;

/** turbo.json is JSONC: drop its whole-line `//` comments (a URL inside a string has no line to itself). */
export function parseTurboJson(text) {
  return JSON.parse(
    text
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n'),
  );
}

/** A turbo input glob, relative to the repository root, as a regular expression over a file path. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      // `**/` matches no folder or any folders; a trailing `**` matches anything below.
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/**
 * Each workspace with a test task reading outside itself, and the root-relative globs it reads.
 * @param {{ tasks?: Record<string, { inputs?: string[] }> }} turbo
 * @returns {{ name: string, include: RegExp[], exclude: RegExp[] }[]}
 */
export function readersOf(turbo) {
  const byName = new Map();
  for (const [task, config] of Object.entries(turbo.tasks ?? {})) {
    const name = task.match(TEST_TASK)?.[1];
    if (!name) continue;
    const reader = byName.get(name) ?? { name, include: [], exclude: [] };
    for (const input of config.inputs ?? []) {
      const negated = input.startsWith('!');
      const glob = negated ? input.slice(1) : input;
      if (!glob.startsWith(ROOT)) continue;
      (negated ? reader.exclude : reader.include).push(globToRegExp(glob.slice(ROOT.length)));
    }
    if (reader.include.length) byName.set(name, reader);
  }
  return [...byName.values()];
}

/**
 * The readers whose declared inputs one of the changed files falls in.
 * @param {ReturnType<typeof readersOf>} readers
 * @param {string[]} files root-relative paths
 * @returns {string[]} workspace names
 */
export function readersReached(readers, files) {
  return readers
    .filter((r) =>
      files.some(
        (file) => r.include.some((re) => re.test(file)) && !r.exclude.some((re) => re.test(file)),
      ),
    )
    .map((r) => r.name);
}

/** The repository's own readers, from its turbo.json. */
export function repoReaders(path = 'turbo.json') {
  return readersOf(parseTurboJson(readFileSync(path, 'utf8')));
}
