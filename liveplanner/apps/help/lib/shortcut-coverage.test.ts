import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every plain key that does something on a Plan tab must appear in the Keyboard Shortcuts
// article.
//
// The registry sells that article as "The full shortcut reference". It had
// drifted to seven of twenty-eight: the whole number row and the element
// letters were bound and documented nowhere in the help centre. Nothing failed,
// because an article is prose. The in-app shortcuts dialog has had a guard
// against the same tables for a while (shortcut-sections.test.ts) and stayed
// complete throughout, which is the argument for this one existing.
//
// Reading apps/editor from apps/help is the same coupling ui-labels-in-articles
// and repo-paths-in-docs already take on: the article's correctness genuinely
// depends on the editor's source, so it is worth failing on.
//
// ONE DIRECTION ONLY: every bound key must be documented. The reverse — every
// backticked letter in the article must be a binding — is deliberately not
// asserted. A dialog contains nothing but shortcuts, so the dialog's guard can
// check both ways; an article contains prose, and a sentence that legitimately
// writes `A` as an example letter would fail a reverse check. A guard that
// fails a correct edit is a guard people delete.
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SECTIONS_SRC = `${ROOT}/apps/editor/components/dialogs/shortcut-sections.ts`;
const ARTICLE = `${ROOT}/apps/help/app/tips-and-tricks/keyboard-shortcuts/page.mdx`;

// The plain keys a Plan tab answers, as the Shortcuts dialog lists them: rows whose one key is a single letter or
// digit (Z for Zen, N for a new card). The editor's canvas tables (VIEW_TOOL_KEYS, EDIT_KEYS) are not read: a Board,
// Sheet, Dashboard or Form covers the canvas, so those keys do nothing there. shortcut-sections.test.ts pins the
// dialog's rows to what the handlers answer on a Plan tab, so this reaches them transitively.
function boundKeys(): Set<string> {
  const src = readFileSync(SECTIONS_SRC, 'utf8');
  return new Set(
    [...src.matchAll(/keys: \['([A-Za-z0-9])'\], label:/g)].map((m) => m[1]!.toUpperCase()),
  );
}

// Keys the article projects, as single-character inline code: `V`, `7`.
function projectedKeys(): Set<string> {
  const src = readFileSync(ARTICLE, 'utf8');
  return new Set([...src.matchAll(/`([A-Z0-9])`/g)].map((m) => m[1]!));
}

// The modifier chords, which the two lookup tables above do NOT hold: they are
// an if-ladder in the same file, with no catalogue to parse. The Shortcuts
// dialog's rows are that catalogue, and shortcut-sections.test.ts pins them to
// the editor, so checking the article against the dialog reaches the bindings
// transitively. Rows whose every key is a modifier or a single character, so
// the chord has one obvious spelling: ⌘Z, ⌘⇧L, ⇧1.
function chords(): string[] {
  const src = readFileSync(SECTIONS_SRC, 'utf8');
  const found: string[] = [];
  // Terminated on `], label:` rather than the first `]`, because two of the
  // rows this must see are the bracket keys themselves (⌘⇧] / ⌘⇧[).
  for (const m of src.matchAll(/keys: \[(.*?)\], label:/g)) {
    const keys = [...m[1]!.matchAll(/'([^']*)'/g)].map((k) => k[1]!);
    if (!keys.some((k) => k === '⌘' || k === '⇧')) continue;
    if (!keys.every((k) => k === '⌘' || k === '⇧' || k.length === 1)) continue;
    found.push(keys.join(''));
  }
  return found;
}

describe('the Keyboard Shortcuts article covers what the editor binds', () => {
  it('parses real tables (guard against this test going blind)', () => {
    // Twenty-eight canvas bindings when this landed; on a Plan tab, Z (Zen) and N (a new card). A collapse to zero
    // means the dialog's shape changed and every assertion below passes vacuously.
    expect(boundKeys().size).toBeGreaterThanOrEqual(2);
    expect(projectedKeys().size).toBeGreaterThanOrEqual(2);
  });

  it('projects every plain key a Plan tab answers', () => {
    const documented = projectedKeys();
    const missing = [...boundKeys()].filter((k) => !documented.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('projects every modifier chord the shortcuts dialog lists', () => {
    // The article claimed to be "the full shortcut reference" while naming no
    // chord at all: undo, copy, paste, group and zoom were in the product and
    // in the dialog, and nowhere in the help centre.
    const src = readFileSync(ARTICLE, 'utf8');
    expect(chords().length).toBeGreaterThan(10);
    const missing = chords().filter((c) => !src.includes(`\`${c}\``));
    expect(missing).toEqual([]);
  });
});
