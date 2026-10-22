import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A handler decides before it commits (docs/specs/003-system-architecture/react-state-and-effects.md): a state
// updater may run after the call returns, so a variable it writes is not yet written when the handler reads it on the
// next line. This scans the editor's sources for a `let` that a commit's or tick's updater writes and the code after
// the call reads. It is a scan, not a parser: it looks a little before the call for the `let`, and up to the end of
// the enclosing block after it.

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = ['app', 'components', 'hooks', 'lib'];
// A call whose first argument is an updater: commit(), commitTabs(), drawCommit(), rawCommitTabs(), tickTabs(), and
// every setState-shaped setter (setHistory(), setPos(), ...); never a timer's callback (setTimeout, setInterval).
const CALL =
  /\b(\w*[cC]ommit\w*|tick\w*|\w*Tick\w*|set(?!Timeout|Interval|Immediate)[A-Z]\w*)\(\s*(?:\([^()]*\)|\w+)\s*=>/g;
const LOOK_BEHIND = 1500;
const LOOK_AHEAD = 800;

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

// The index of the parenthesis that closes the one at `open`.
function closing(s: string, open: number): number {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === '(') depth++;
    else if (s[k] === ')' && --depth === 0) return k;
  }
  return s.length;
}

export function updaterFlags(source: string): { line: number; name: string }[] {
  const found: { line: number; name: string }[] = [];
  for (const m of source.matchAll(CALL)) {
    const start = m.index;
    const end = closing(source, source.indexOf('(', start));
    const body = source.slice(start + m[0].length, end);
    const lets = new Set(
      // Indented: a `let` inside a function. A module's counter (`let nextId = 1` at the margin) is state the
      // updater owns, never a flag a handler reads back.
      [...source.slice(Math.max(0, start - LOOK_BEHIND), start).matchAll(/\n[ \t]+let (\w+)/g)].map(
        (l) => l[1]!,
      ),
    );
    let after = source.slice(end + 1, end + 1 + LOOK_AHEAD);
    const block = /\n\s{0,4}\};?\n/.exec(after);
    if (block) after = after.slice(0, block.index);
    for (const name of lets) {
      const written = new RegExp(`(?<![\\w.])${name}\\s*(=[^=>]|\\+\\+|\\+=|\\.push\\()`).test(
        body,
      );
      if (written && new RegExp(`(?<![\\w.])${name}\\b`).test(after))
        found.push({ line: source.slice(0, start).split('\n').length, name });
    }
  }
  return found;
}

describe('a handler decides before it commits', () => {
  it('finds a flag written in an updater and read after it', () => {
    const bad = `const f = () => {\n  let done = false;\n  commit((els) => {\n    done = true;\n    return els;\n  });\n  if (done) track('x');\n};\n`;
    expect(updaterFlags(bad)).toEqual([{ line: 3, name: 'done' }]);
    const good = `const f = () => {\n  const done = check(els);\n  commit((els) => els);\n  if (done) track('x');\n};\n`;
    expect(updaterFlags(good)).toEqual([]);
    // Any setState-shaped setter, and a commit named in the middle.
    const setter = `const m = () => {\n  let settled = true;\n  setPos((prev) => {\n    settled = false;\n    return prev;\n  });\n  return settled;\n};\n`;
    expect(updaterFlags(setter)).toEqual([{ line: 3, name: 'settled' }]);
    expect(updaterFlags(setter.replace('setPos', 'rawCommitTabs'))).toHaveLength(1);
  });

  it('reads no updater-written variable after a commit, anywhere in the editor', () => {
    const offenders: string[] = [];
    for (const dir of DIRS)
      for (const file of sources(join(ROOT, dir)))
        for (const f of updaterFlags(readFileSync(file, 'utf8')))
          offenders.push(`${file.slice(ROOT.length)}:${f.line}: ${f.name}`);
    expect(offenders).toEqual([]);
  });
});
