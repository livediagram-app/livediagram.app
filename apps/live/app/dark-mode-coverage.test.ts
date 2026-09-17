import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Appearance (spec/07) is only as good as its least-converted screen, and the
// screens that get missed are never the editor — they are the ones a user is
// only ever in for a second: the diagram loading placeholder, the illustrative
// tiles in the New Diagram dialog. Nothing failed when those stayed light. The
// build was green, the types were fine, and the only symptom was a white flash
// on a dark machine, which every automated check in the repo was blind to.
//
// So these read the source. Not elegant, but the alternative is a screenshot
// suite for a handful of rules that are perfectly statable in words.

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.next-dev', 'out', 'dist', '.turbo', 'e2e'].includes(entry))
      continue;
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (/\.tsx$/.test(entry) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const FILES = tsxFiles(ROOT).map((path) => ({
  path: path.slice(ROOT.length),
  source: readFileSync(path, 'utf8'),
}));

/** Every `className="..."` / `className={`...`}` literal in the app. */
function classNames(source: string): string[] {
  return [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
    (m) => m[1] ?? m[2] ?? '',
  );
}

describe('full-screen surfaces in dark chrome', () => {
  // A surface that fills the viewport is the whole screen for as long as it is
  // up: there is no dark-aware chrome around it to carry the appearance, so it
  // has to carry its own. A hover tint on a button inside an already-dark panel
  // is a different thing entirely, which is why this only looks at the
  // full-bleed ones.
  const FULL_SCREEN = /\b(min-h-screen|h-dvh|h-screen|flex-1|inset-0)\b/;
  // The UNPREFIXED token only. `hover:bg-slate-50` is a pointer state on a
  // control, not the surface anything is painted on, and treating it as one
  // flagged three perfectly dark-aware buttons.
  const LIGHT_SURFACE = (cls: string) =>
    cls.split(/\s+/).some((token) => ['bg-white', 'bg-slate-50', 'bg-slate-100'].includes(token));

  it('never paints a light surface with no dark variant', () => {
    const offenders: string[] = [];
    for (const { path, source } of FILES) {
      for (const cls of classNames(source)) {
        if (!LIGHT_SURFACE(cls) || !FULL_SCREEN.test(cls)) continue;
        if (/dark:bg-/.test(cls)) continue;
        // A tile of light-canvas art is re-lit wholesale instead (see below).
        if (/preview-art-tile/.test(cls)) continue;
        offenders.push(`${path}: ${cls.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('tiles of light-canvas illustration art', () => {
  const GLOBALS = readFileSync(`${ROOT}app/globals.css`, 'utf8');

  it('are re-lit by one rule rather than each redrawn', () => {
    // The ~48 template previews and the export-format glyphs are drawn as
    // light-canvas art. One `.dark` rule flips the lot, so a preview nobody
    // has drawn yet is dark-correct the moment it lands.
    expect(GLOBALS).toMatch(/\.dark \.preview-art-tile \{[^}]*filter:[^}]*invert/);
  });

  it('no longer prop up the old light-plate workaround', () => {
    // `dark:bg-slate-200` was the previous answer: keep the plate LIGHT in dark
    // chrome so the light art stays legible. That is what made the New Diagram
    // dialog a grid of white cards on near-black.
    const offenders = FILES.filter(({ source }) =>
      classNames(source).some((cls) => /dark:bg-slate-200\b/.test(cls) && /\bh-1[0-9]\b/.test(cls)),
    ).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('put every template preview on a re-lit tile', () => {
    // A preview rendered on a plain plate would be the one light card left.
    for (const { path, source } of FILES) {
      if (!source.includes('<TemplatePreview')) continue;
      expect(source, `${path} renders a preview outside a re-lit tile`).toContain(
        'preview-art-tile',
      );
    }
  });
});
