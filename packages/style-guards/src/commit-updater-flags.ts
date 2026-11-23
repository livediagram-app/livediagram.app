import { guardedSources, type SourceGuardOptions } from './source-files';

// A handler decides before it commits (each product's docs/specs/003-system-architecture/react-state-and-effects.md):
// a state updater may run after the call returns, so a variable it writes is not yet written when the handler reads
// it on the next line. This scans sources for a `let` that a commit's or tick's updater writes and the code after
// the call reads. It is a scan, not a parser: it looks a little before the call for the `let`, and up to the end of
// the enclosing block after it.

// A call whose first argument is an updater: commit(), commitTabs(), drawCommit(), rawCommitTabs(), tickTabs(), and
// every setState-shaped setter (setHistory(), setPos(), ...); never a timer's callback (setTimeout, setInterval).
const CALL =
  /\b(\w*[cC]ommit\w*|tick\w*|\w*Tick\w*|set(?!Timeout|Interval|Immediate)[A-Z]\w*)\(\s*(?:\([^()]*\)|\w+)\s*=>/g;
const LOOK_BEHIND = 1500;
const LOOK_AHEAD = 800;

// The index of the parenthesis that closes the one at `open`.
function closing(s: string, open: number): number {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === '(') depth++;
    else if (s[k] === ')' && --depth === 0) return k;
  }
  return s.length;
}

/** The updater-written variables a source reads after the call: each one's line and name. */
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

/** Every such variable under the guard's dirs, as `path:line: name`. */
export function checkCommitUpdaterFlags(options: SourceGuardOptions): string[] {
  const offenders: string[] = [];
  for (const { rel, text } of guardedSources(options))
    for (const f of updaterFlags(text)) offenders.push(`${rel}:${f.line}: ${f.name}`);
  return offenders;
}
