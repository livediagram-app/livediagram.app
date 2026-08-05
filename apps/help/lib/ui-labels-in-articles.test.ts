import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// When an article puts a control's name in bold it is telling the reader what
// to look for in the editor, so the spelling has to be the editor's. A reader
// scanning a menu for "Auto-Align" does not find it: the item says
// "Auto-align", and four articles had drifted that way.
//
// Only CASE is checked. Whether an article should name a control at all, or
// call it something friendlier, is an editorial decision; a name that matches
// except for capitalisation is just a typo, and that is what this catches.
//
// Titles stay out of it. "Auto-Align" as an article title is the documentation
// name, matching "Layout Cleanup" and "Keyboard Shortcuts", neither of which
// is a control. Only bold text inside the body is treated as a claim about the
// UI.
//
// It reads apps/live from apps/help on purpose, the same way the deep-link
// test does: the article's correctness genuinely depends on the editor's
// strings, so the coupling is real and worth failing on.
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function uiLabels(): Map<string, string> {
  const skip = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', '.turbo']);
  const byLower = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) {
        const src = readFileSync(full, 'utf8');
        // `(?<![\w-])` keeps aria-label out. An aria-label is written for a
        // screen reader, not printed on the control, so it is no evidence of
        // what a sighted reader is hunting for: the Tab Appearance dialog is
        // headed "Tab Appearance" while its aria-label reads "Tab appearance",
        // and taking the latter as truth flags a correct article.
        for (const m of src.matchAll(/(?<![\w-])label="([^"]{3,30})"/g))
          byLower.set(m[1]!.toLowerCase(), m[1]!);
        for (const m of src.matchAll(/menuLabel: '([^']{3,30})'/g))
          byLower.set(m[1]!.toLowerCase(), m[1]!);
      }
    }
  };
  walk(`${ROOT}/apps/live`);
  return byLower;
}

function articles(): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'page.mdx') out.push({ path: full, source: readFileSync(full, 'utf8') });
    }
  };
  walk(`${ROOT}/apps/help/app`);
  return out;
}

// Every string the editor could print, as one lowercase haystack. Deliberately
// cruder than uiLabels(): the check below asks only "does this name exist at
// all", so a control named in a tooltip, a JSX text node or a catalogue entry
// counts as evidence. A narrower corpus would flag correct articles.
function editorSource(): string {
  const skip = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', '.turbo']);
  let all = '';
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) all += readFileSync(full, 'utf8');
    }
  };
  for (const root of ['apps/live', 'apps/mcp', 'packages']) walk(`${ROOT}/${root}`);
  return all.toLowerCase();
}

describe('bold control names in articles match the editor', () => {
  const labels = uiLabels();
  const pages = articles();

  it('reads both sides (guard against this test going blind)', () => {
    // ~175 printed labels once aria-label is excluded. Deliberately not every
    // string a user can read: tooltip titles and rendered JSX text are not
    // collected, so this proves the names it DOES know are spelled right
    // rather than proving every bold name is a real control.
    expect(labels.size).toBeGreaterThan(150);
    expect(pages.length).toBeGreaterThan(100);
  });

  it('differs from a real label by more than capitalisation nowhere', () => {
    const wrong: string[] = [];
    for (const { path, source } of pages) {
      for (const m of source.matchAll(/\*\*([A-Za-z][A-Za-z0-9 …'’-]{2,26})\*\*/g)) {
        const bold = m[1]!.trim().replace(/[.,]$/, '');
        // An exact match is fine, and so is a word that happens to collide
        // with a label while being ordinary emphasis: **edit**, **text**.
        // Those are lowercase, and a control name a reader hunts for is not.
        if (labels.has(bold.toLowerCase()) === false) continue;
        const real = labels.get(bold.toLowerCase())!;
        if (bold === real || bold === bold.toLowerCase()) continue;
        wrong.push(
          `${path.replace(`${ROOT}/apps/help/app/`, '')}: **${bold}** but the UI says "${real}"`,
        );
      }
    }
    expect([...new Set(wrong)]).toEqual([]);
  });
});

// The sibling failure the case check cannot see: a bold name that is not a
// control at all. "Pick up the comment tool", "**Arrowhead type** chooses
// which ends carry a head", "**Hide participant cursors**" — three articles
// sent readers hunting for something the editor has never printed, which is
// worse than a misspelling because there is nothing to find.
//
// Scoped to sentences that make a CLAIM about a named control (an imperative
// in front of it, or a control noun behind it), because that is where a name
// is load-bearing. Ordinary bold emphasis is left alone: "**Cut is copy plus
// delete**" is a sentence, not a button, and a check that flagged it would be
// a check people delete.
const CONTROL_CLAIMS = [
  // "press **Present**", "open **Tools › Session**"
  /(?:press|choose|pick|tap|click|open|select|toggle|flip|switch to|use)\s+\*\*([A-Z][^*]{2,28})\*\*/g,
  // "**Auto-advance** setting", "**Reactions** row"
  /\*\*([A-Z][^*]{2,28})\*\*\s+(?:button|switch|toggle|setting|checkbox|menu|dialog|panel|tab|category|slider|field|row|section|option|control|pill|chip|badge|preset|mode)/g,
  // "with **Hide cursors** on"
  /(?:with|the)\s+\*\*([A-Z][^*]{2,28})\*\*\s+(?:on|off|ticked|checked|enabled|disabled)/g,
  // "**Arrowhead size** offers Small, Medium, Large"
  /\*\*([A-Z][^*]{2,28})\*\*\s+(?:chooses|controls|sets|picks|offers|turns|opens|toggles|shows|hides)\b/g,
];

describe('bold control names in articles exist in the editor', () => {
  const source = editorSource();
  const pages = articles();

  it('reads both sides (guard against this test going blind)', () => {
    expect(source.length).toBeGreaterThan(1_000_000);
    expect(pages.length).toBeGreaterThan(100);
  });

  it('names no control the editor never prints', () => {
    const phantom: string[] = [];
    for (const { path, source: page } of pages) {
      for (const re of CONTROL_CLAIMS) {
        for (const m of page.matchAll(re)) {
          // Whitespace normalised first: prose wraps, so a two-line
          // **Open in a new tab** is one name with a newline in the middle.
          const claim = m[1]!
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[.,:]$/, '');
          // A menu PATH is checked a segment at a time: "Tools › Session" is
          // two real names and never one string in the source.
          const parts = claim.split(/\s*[›>→]\s*/);
          const missing = parts.filter((part) => !source.includes(part.toLowerCase()));
          if (missing.length > 0) {
            phantom.push(
              `${path.replace(`${ROOT}/apps/help/app/`, '')}: **${claim}** (no "${missing[0]}" in the editor)`,
            );
          }
        }
      }
    }
    expect([...new Set(phantom)]).toEqual([]);
  });
});
