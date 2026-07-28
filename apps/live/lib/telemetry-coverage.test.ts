import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TELEMETRY_ACTIONS, TELEMETRY_CATEGORIES } from '@livediagram/api-schema';
import { EMITTED_EVENT_PAIRS } from './telemetry-manifest';

// Event-completeness guard (spec/22, issue #30).
//
// The concern this answers: telemetry drifts silently. An event gets renamed,
// a call site is deleted with the feature it belonged to, a new one lands
// undocumented — and nothing fails, because emitting is fire-and-forget by
// design. The public /telemetry dashboard only ever shows what ARRIVED, so a
// missing event looks exactly like a feature nobody used.
//
// So the editor's `category·action` vocabulary is pinned to a checked-in
// manifest. Adding, removing, or renaming an emitted pair fails this test
// until `telemetry-manifest.ts` is updated — and the manifest's own comment
// points at spec/22, so the taxonomy gets updated in the same change.
//
// Scope is deliberately the PAIR, not the `type`. Types are open-ended by
// design (a shape kind, a template id, an article slug) and pinning them
// would fail on every new shape. The palette types — the ones the dashboard
// buckets by, where drift is invisible and costly — get their own stricter
// check in palette-telemetry-coverage.test.ts.

const APP_ROOT = join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.next-dev', 'out', '.turbo']);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...sourceFiles(path));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    found.push(path);
  }
  return found;
}

// `track('Category', <action expr>` — the action expression runs to the next
// comma at depth zero or the closing paren, which covers the ternary form
// (`track('Element', anyUnlocked ? 'Locked' : 'Unlocked')`) as well as a
// plain literal. Every quoted string inside it is a possible action.
function pairsIn(source: string): string[] {
  const pairs: string[] = [];
  for (const match of source.matchAll(/\btrack\(\s*'([A-Za-z]+)'\s*,/g)) {
    const category = match[1]!;
    // Take the rest of the call's argument list and pull the action
    // literal(s) out of the SECOND argument only.
    const rest = source.slice(match.index + match[0].length);
    const secondArg = takeArgument(rest);
    for (const literal of secondArg.matchAll(/'([A-Za-z]+)'/g)) {
      pairs.push(`${category}·${literal[1]}`);
    }
  }
  return pairs;
}

// Read one argument off the head of an argument list: up to the next
// top-level comma or the call's closing paren, respecting nesting so a
// ternary containing a call or an object still reads as one argument.
function takeArgument(source: string): string {
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return source.slice(0, i);
      depth--;
    } else if (c === ',' && depth === 0) return source.slice(0, i);
  }
  return source;
}

const emitted = (() => {
  const pairs = new Set<string>();
  for (const file of sourceFiles(APP_ROOT)) {
    for (const pair of pairsIn(readFileSync(file, 'utf8'))) pairs.add(pair);
  }
  return [...pairs].sort();
})();

describe('telemetry coverage', () => {
  it('found call sites at all', () => {
    // Guards the scanner itself: a regex that silently stops matching would
    // make every other assertion below vacuously pass.
    expect(emitted.length).toBeGreaterThan(50);
  });

  it('emits exactly the manifest of category·action pairs', () => {
    // Failing here is not necessarily a bug — it means the editor's event
    // vocabulary changed. Update EMITTED_EVENT_PAIRS in telemetry-manifest.ts
    // AND the taxonomy in specs/22-telemetry.md, in the same change.
    expect(emitted).toEqual([...EMITTED_EVENT_PAIRS].sort());
  });

  it('only uses categories and actions from the closed vocabulary', () => {
    const categories = new Set<string>(TELEMETRY_CATEGORIES);
    const actions = new Set<string>(TELEMETRY_ACTIONS);
    const invalid = emitted.filter((pair) => {
      const [category, action] = pair.split('·');
      return !categories.has(category!) || !actions.has(action!);
    });
    // An event outside the enums is dropped by the api worker's validator,
    // so this would be a silent total loss for that event.
    expect(invalid).toEqual([]);
  });
});
