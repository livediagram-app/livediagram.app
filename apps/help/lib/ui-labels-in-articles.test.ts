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
