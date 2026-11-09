// Holds each product editor's coverage to a floor that only rises (docs/ci.md "Editor coverage
// floors"). The editors run in shards, each covering a slice, so the floor judges the merged result:
// this run's `coverage-<group>-editor-<shard>` artifacts, merged per editor, against
// coverage-floors.json. It fails below a floor, and notes (without failing) a floor worth raising.
//
//   node .github/scripts/coverage-floors.mjs <dir>            check the editors whose shards are in <dir>
//   node .github/scripts/coverage-floors.mjs --update <dir>   raise the floors to what <dir> measures
//
// <dir> holds one folder per artifact, as `gh run download --pattern 'coverage-*-editor-*'` or
// actions/download-artifact leave them. On CI, EDITORS (ci-plan's `editors` output) names the shards the
// run reached, so a reached editor whose shard kept no coverage fails rather than passing on a slice.

import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { coverageIn } from './lcov.mjs';

/** @typedef {import('./lcov.mjs').Coverage} Coverage */
/** @typedef {{ lines: number, branches: number | null }} Measured  percent; branches null when none */
/** @typedef {{ lines: number, branches?: number }} Floor */

export const FLOORS_FILE = fileURLToPath(new URL('./coverage-floors.json', import.meta.url));

/** How far above its floor an editor must be before the check suggests raising it, in points. */
export const RAISE_HINT = 0.5;

const SHARD = /^coverage-([a-z]+)-editor-(\d+)$/;

/** An editor shard artifact's group and shard, or null for any other name. */
export function parseShard(/** @type {string} */ name) {
  const m = SHARD.exec(name);
  return m ? { group: m[1], shard: Number(m[2]) } : null;
}

/** Line coverage (a line counts when any shard ran it) and branch coverage, in percent. */
export function measure(/** @type {Coverage} */ coverage) {
  let lines = 0;
  let hit = 0;
  let branches = 0;
  let taken = 0;
  for (const data of coverage.values()) {
    for (const hits of data.lines.values()) {
      lines += 1;
      if (hits > 0) hit += 1;
    }
    for (const t of data.branchKeys.values()) {
      branches += 1;
      if (t) taken += 1;
    }
  }
  return {
    lines: lines > 0 ? (hit / lines) * 100 : 0,
    branches: branches > 0 ? (taken / branches) * 100 : null,
  };
}

/** A percentage rounded down to one decimal, so a floor never sits above what was measured. */
export function floorOf(/** @type {number} */ pct) {
  // The epsilon keeps 78.6 from reading as 78.59999… and rounding to 78.5.
  return Math.floor(pct * 10 + 1e-9) / 10;
}

/**
 * Each editor against its floor. `failures` fail the check; `notes` only suggest raising a floor.
 * @param {Map<string, Measured>} measured
 * @param {Record<string, Floor>} floors
 */
export function judge(measured, floors) {
  /** @type {string[]} */
  const failures = [];
  /** @type {string[]} */
  const notes = [];
  /** @type {{ group: string, metric: string, value: number, floor: number | null }[]} */
  const rows = [];
  for (const [group, m] of measured) {
    const floor = floors[group];
    if (!floor) {
      failures.push(
        `${group}: no floor in coverage-floors.json; add one with \`node .github/scripts/coverage-floors.mjs --update <dir>\``,
      );
      continue;
    }
    for (const metric of /** @type {const} */ (['lines', 'branches'])) {
      const value = m[metric];
      const min = floor[metric];
      if (value === null || min === undefined) continue;
      rows.push({ group, metric, value, floor: min });
      if (value < min) {
        failures.push(
          `${group}: ${metric} coverage ${value.toFixed(2)}% is below its floor of ${min}%. Add tests for the code this change brought in or left untested.`,
        );
      } else if (value - min >= RAISE_HINT) {
        notes.push(
          `${group}: ${metric} coverage ${value.toFixed(2)}% beats its floor of ${min}% by ${(value - min).toFixed(2)} points; raise it with \`node .github/scripts/coverage-floors.mjs --update <dir>\`.`,
        );
      }
    }
  }
  return { failures, notes, rows };
}

/**
 * The floors raised to what was measured: a floor never falls, and an editor without one gets one.
 * @param {Record<string, Floor>} floors
 * @param {Map<string, Measured>} measured
 * @returns {Record<string, Floor>}
 */
export function raise(floors, measured) {
  /** @type {Record<string, Floor>} */
  const out = structuredClone(floors);
  for (const [group, m] of measured) {
    const was = out[group];
    /** @type {Floor} */
    const next = { lines: Math.max(was?.lines ?? 0, floorOf(m.lines)) };
    if (m.branches !== null) next.branches = Math.max(was?.branches ?? 0, floorOf(m.branches));
    else if (was?.branches !== undefined) next.branches = was.branches;
    out[group] = next;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * The shard folders per editor in `names`, and what is missing. With `expected` (ci-plan's editors:
 * `{ group, shard, total }[]`), every expected shard must be there; without it, the editors present
 * are taken as they are.
 * @param {string[]} names
 * @param {{ group: string, shard: number, total: number }[] | null} expected
 */
export function shardsByEditor(names, expected) {
  /** @type {Map<string, string[]>} */
  const found = new Map();
  for (const name of names) {
    const s = parseShard(name);
    if (!s) continue;
    if (!found.has(s.group)) found.set(s.group, []);
    found.get(s.group).push(name);
  }
  /** @type {string[]} */
  const missing = [];
  if (!expected) return { found, missing };
  const wanted = new Set(expected.map((e) => e.group));
  for (const group of [...found.keys()]) if (!wanted.has(group)) found.delete(group);
  for (const e of expected) {
    const name = `coverage-${e.group}-editor-${e.shard}`;
    if (!names.includes(name)) missing.push(name);
  }
  return { found, missing };
}

function readFloors() {
  return existsSync(FLOORS_FILE) ? JSON.parse(readFileSync(FLOORS_FILE, 'utf8')) : {};
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir || !existsSync(dir)) {
    console.error(
      'usage: coverage-floors.mjs [--update] <dir of coverage-<group>-editor-<n> folders>',
    );
    return 2;
  }
  const expected = process.env.EDITORS ? JSON.parse(process.env.EDITORS) : null;
  const { found, missing } = shardsByEditor(readdirSync(dir), expected);
  // A shard whose suite found no files to cover uploads nothing; an empty folder counts as missing too.
  for (const names of found.values())
    for (const name of names)
      if (
        !readdirSync(path.join(dir, name), { recursive: true }).some((f) =>
          String(f).endsWith('lcov.info'),
        )
      )
        missing.push(name);

  /** @type {Map<string, Measured>} */
  const measured = new Map();
  for (const [group, names] of [...found].sort(([a], [b]) => a.localeCompare(b))) {
    const started = process.hrtime.bigint();
    measured.set(group, measure(coverageIn(names.map((n) => path.join(dir, n)))));
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const m = measured.get(group);
    console.log(
      `[coverage-floors] ${group}: lines ${m.lines.toFixed(2)}%, branches ${m.branches === null ? 'n/a' : `${m.branches.toFixed(2)}%`} (${names.length} shards, merged in ${ms.toFixed(0)} ms)`,
    );
  }

  const floors = readFloors();
  if (update) {
    if (missing.length > 0) {
      console.error(`[coverage-floors] not updating: missing ${missing.join(', ')}`);
      return 1;
    }
    const next = raise(floors, measured);
    writeFileSync(FLOORS_FILE, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`[coverage-floors] wrote ${path.relative(process.cwd(), FLOORS_FILE)}`);
    return 0;
  }

  if (measured.size === 0 && missing.length === 0) {
    console.log('[coverage-floors] no editor coverage in this run; nothing to check');
    return 0;
  }
  const { failures, notes, rows } = judge(measured, floors);
  for (const name of missing) failures.push(`${name}: this shard kept no coverage`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const table = [
      '## Editor coverage floors',
      '',
      '| Editor | Metric | Coverage | Floor |',
      '| --- | --- | ---: | ---: |',
      ...rows.map(
        (r) =>
          `| ${r.group} | ${r.metric} | ${r.value.toFixed(2)}% | ${r.floor}% ${r.value < (r.floor ?? 0) ? ':x:' : ':white_check_mark:'} |`,
      ),
      '',
    ];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table.join('\n')}\n`);
  }
  const ci = process.env.GITHUB_ACTIONS === 'true';
  for (const n of notes) console.log(ci ? `::notice title=Coverage floor::${n}` : `note: ${n}`);
  for (const f of failures) console.log(ci ? `::error title=Coverage floor::${f}` : `error: ${f}`);
  if (failures.length > 0) return 1;
  console.log('[coverage-floors] every editor is at or above its floor');
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
