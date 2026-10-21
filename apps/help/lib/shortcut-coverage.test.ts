import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every plain key the editor binds must appear in the Keyboard Shortcuts
// article.
//
// The registry sells that article as "The full shortcut reference". It had
// drifted to seven of twenty-eight: the whole number row and the element
// letters were bound and documented nowhere in the help centre. Nothing failed,
// because an article is prose. The in-app shortcuts dialog has had a guard
// against the same tables for a while (shortcut-sections.test.ts) and stayed
// complete throughout, which is the argument for this one existing.
//
// Reading apps/live from apps/help is the same coupling ui-labels-in-articles
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
const KEYS_SRC = `${ROOT}/apps/live/hooks/canvas/editor-shortcut-keys.ts`;
const LISTENER_SRC = `${ROOT}/apps/live/hooks/canvas/useEditorKeyboardShortcuts.ts`;
const SECTIONS_SRC = `${ROOT}/apps/live/components/dialogs/shortcut-sections.ts`;
const ARTICLE = `${ROOT}/apps/help/app/tips-and-tricks/keyboard-shortcuts/page.mdx`;

// The two lookup tables are the editor's own catalogue of plain-key shortcuts:
// VIEW_TOOL_KEYS (allowed for a view-role visitor) and EDIT_KEYS (editors
// only). Modifier chords live in an if-ladder elsewhere in the same file and
// are NOT part of this, which is why the tables are parsed rather than the file.
function boundKeys(): Set<string> {
  const src = readFileSync(KEYS_SRC, 'utf8');
  const keys = new Set<string>();
  for (const table of ['VIEW_TOOL_KEYS', 'EDIT_KEYS']) {
    const body = new RegExp(
      `${table}: Record<string, ShortcutAction> = \\{([\\s\\S]*?)\\n\\};`,
    ).exec(src);
    if (!body) continue;
    for (const m of body[1]!.matchAll(/^\s*'?([a-z0-9])'?: \(l\) =>/gm)) {
      keys.add(m[1]!.toUpperCase());
    }
  }
  return keys;
}

// Keys the article documents, as single-character inline code: `V`, `7`.
function documentedKeys(): Set<string> {
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
    // Twenty-eight bindings when this landed. A collapse toward zero means the
    // table shape changed and every assertion below passes vacuously.
    expect(boundKeys().size).toBeGreaterThan(20);
    expect(documentedKeys().size).toBeGreaterThan(20);
  });

  it('documents every plain key in the lookup tables', () => {
    const documented = documentedKeys();
    const missing = [...boundKeys()].filter((k) => !documented.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('documents every modifier chord the shortcuts dialog lists', () => {
    // The article claimed to be "the full shortcut reference" while naming no
    // chord at all: undo, copy, paste, group and zoom were in the product and
    // in the dialog, and nowhere in the help centre.
    const src = readFileSync(ARTICLE, 'utf8');
    expect(chords().length).toBeGreaterThan(10);
    const missing = chords().filter((c) => !src.includes(`\`${c}\``));
    expect(missing).toEqual([]);
  });

  it('documents the image key, which is bound outside the tables', () => {
    // `9` gets its own branch in the listener because its callback is nullable
    // (a guest deploy with no api worker has nowhere to put the file), so it
    // never reaches the tables above and the parse cannot see it. Asserted
    // here explicitly, together with the reason it is an exception, so this
    // guard's coverage matches what its name claims.
    expect(readFileSync(LISTENER_SRC, 'utf8')).toContain("lower === '9'");
    expect(documentedKeys().has('9')).toBe(true);
  });
});
