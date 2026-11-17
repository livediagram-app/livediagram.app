import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Under a Windows contrast theme the browser repaints every fill as Canvas, so a button whose only shape is its fill
// read as bare centred text (/sign-in's Continue with email, Work Tracker 1080). Every such button on the site takes
// the shared `forced-edge` utility (@liveworkspace/tailwind-config theme.css), a ButtonBorder edge under forced
// colours only (site.md "Behaviour"; livediagram/docs/specs/004-interface-design/forced-colors.md).

const root = fileURLToPath(new URL('.', import.meta.url));

// A solid fill as the control's own colour (not a `hover:` or `dark:` one): the near-black, white, brand and the
// strong hues the site paints its actions with.
const SOLID_FILL = /(?:^|\s)bg-(?:slate-(?:800|900|950)|white|brand-[5-8]00|[a-z]+-[67]00)(?=\s|$)/;
// Something else that draws the control's edge, which forced colours keep.
const OWN_EDGE = /(?:^|\s)(?:border|ring-1|ring-2|forced-edge)(?=\s|$)/;

/** A class string that reads as a fill-only button: a solid fill, a hover state, padding and no edge. */
function isFillOnlyButton(classes: string): boolean {
  return (
    SOLID_FILL.test(classes) &&
    /(?:^|\s)hover:/.test(classes) &&
    /(?:^|\s)px-/.test(classes) &&
    !OWN_EDGE.test(classes)
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/** Every string literal in `source`, quoted with ', " or `, one line at most. */
function literals(source: string): string[] {
  return [...source.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? '',
  );
}

describe('forced colours: a button is never its fill alone', () => {
  it('reads the button shapes it guards', () => {
    expect(
      isFillOnlyButton('rounded-lg bg-slate-900 px-4 text-white hover:bg-slate-800 dark:bg-white'),
    ).toBe(true);
    expect(isFillOnlyButton('rounded-lg forced-edge bg-slate-900 px-4 hover:bg-slate-800')).toBe(
      false,
    );
    expect(
      isFillOnlyButton('rounded-lg border border-slate-200 bg-white px-4 hover:bg-slate-50'),
    ).toBe(false);
    // A fill shown only on hover, or a static chip, is no fill-only button.
    expect(isFillOnlyButton('rounded-md px-2 text-slate-600 hover:bg-slate-100')).toBe(false);
    expect(isFillOnlyButton('rounded-full bg-slate-900 px-1.5 text-white')).toBe(false);
  });

  it('gives every fill-only button on the site the forced-edge utility', () => {
    const offenders = ['components', 'app'].flatMap((dir) =>
      sourceFiles(join(root, dir)).flatMap((file) =>
        literals(readFileSync(file, 'utf8'))
          .filter(isFillOnlyButton)
          .map((classes) => `${file.slice(root.length)}: ${classes.slice(0, 80)}…`),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
