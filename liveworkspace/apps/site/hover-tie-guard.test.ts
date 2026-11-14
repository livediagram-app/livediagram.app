import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  COLOUR,
  PAGE_SHEETS,
  REPO,
  read,
  scan,
  tokensOf,
  type Scanned,
} from './lib/stylesheet-scan';
import { relative } from 'node:path';

// The site loads its own stylesheet (app/globals.css) on every page, a page's own after it on three routes, and keeps
// that sheet loaded after a client-side move (liveworkspace/docs/specs/010-site/site.md "Stylesheets"). Two classes
// of one element that set the same colour under different states (`hover:text-slate-900` and
// `aria-[current=page]:text-white`) weigh the same, so the later rule wins, and which is later depends on which sheet
// emitted it: a page sheet that emits only one of them, from another file, puts it after the other. The legal pages'
// current tab lost its text on hover after a move from /community or /explorer (#1688). This guard finds every such
// tie on one element (same property, same mode, the same number of states, different states), and fails when a page
// sheet that doesn't scan the element's file emits exactly one half. The fix is a class that names both states
// (`aria-[current=page]:hover:text-white`), which weighs more than either. A static check only approximates
// Tailwind's ordering, so it reads the class strings the way dark-pair-guard.test.ts does and flags a tie only
// where a sheet splits it.

// Variants that add no weight to a rule (media queries, the dark scope, motion preferences): they set the mode.
const MODE =
  /^(dark|sm|md|lg|xl|2xl|max-.+|min-.+|motion-safe|motion-reduce|print|portrait|landscape|contrast-more|contrast-less|forced-colors|supports-.+|@.+)$/;

type Tie = { file: string; a: string; b: string };
type Clash = Tie & { sheet: string };

// A colour class as a tie sees it: its property, its mode and its states (hover, focus, aria and data attributes,
// group and peer states), each state one pseudo-class or attribute of weight.
function parse(
  token: string,
): { family: string; mode: string; states: string[]; value: string } | null {
  const parts = token.split(':');
  const utility = parts.pop()!.replace(/^!|!$/g, '');
  const match = COLOUR.exec(utility);
  // A state aimed at another element (`[&_th]:`) doesn't tie with one aimed at this one.
  if (!match || parts.some((v) => v.startsWith('['))) return null;
  const mode = parts
    .filter((v) => MODE.test(v))
    .sort()
    .join(':');
  const states = parts.filter((v) => !MODE.test(v)).sort();
  return { family: match[1]!, mode, states, value: utility };
}

// The tied classes one element sets together, in one string or on one line. Two states that set the same colour tie
// harmlessly: whichever rule wins paints the same.
function tiesIn(file: string, text: string): Tie[] {
  if (/\.test\.tsx?$/.test(file)) return [];
  const units = [...text.matchAll(/`[^`]*`/g)].map(([m]) => m).concat(text.split('\n'));
  const ties = new Map<string, Tie>();
  for (const unit of units) {
    const parsed = unit
      .split(/[\s'"`,()]+/)
      .filter(Boolean)
      .map((token) => ({ token, at: parse(token) }))
      .filter((t) => t.at && t.at.states.length > 0);
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const [a, b] = [parsed[i]!, parsed[j]!];
        if (
          a.at!.family === b.at!.family &&
          a.at!.mode === b.at!.mode &&
          a.at!.states.length === b.at!.states.length &&
          a.at!.states.join(':') !== b.at!.states.join(':') &&
          a.at!.value !== b.at!.value &&
          !parsed.some(
            (c) =>
              c.at!.family === a.at!.family &&
              c.at!.mode === a.at!.mode &&
              [...a.at!.states, ...b.at!.states].every((s) => c.at!.states.includes(s)),
          )
        ) {
          const [first, second] = [a.token, b.token].sort();
          ties.set(`${first} ${second}`, { file, a: first!, b: second! });
        }
      }
    }
  }
  return [...ties.values()];
}

// Each page sheet against every tie in a file it doesn't scan: it clashes when it emits exactly one half. A sheet
// that scans the file emits both, in Tailwind's order, as the site's own sheet does.
function clashesOf(pages: Scanned[], ties: Tie[]): Clash[] {
  const out: Clash[] = [];
  for (const { path, files, tokens } of pages) {
    for (const tie of ties) {
      if (files.has(tie.file) || tokens.has(tie.a) === tokens.has(tie.b)) continue;
      out.push({ ...tie, sheet: path });
    }
  }
  return out;
}

describe('same-mode hover ties across stylesheets', () => {
  const globals = scan('app/globals.css');
  const pages = PAGE_SHEETS.map(scan);
  let ties: Tie[] = [];
  let found: Clash[] = [];
  const ms = cpuMsOf(() => {
    const drawn = new Set([globals, ...pages].flatMap(({ files }) => [...files]));
    ties = [...drawn].flatMap((file) => tiesIn(file, read(file)));
    found = clashesOf(pages, ties);
  });

  it('reads every sheet the site loads, within budget', () => {
    for (const { path, files } of [globals, ...pages]) expect(files.size, path).toBeGreaterThan(0);
    console.info(
      `[hover ties] ${ties.length} ties, ${found.length} split by a page sheet, in ${ms.toFixed(0)} ms of CPU`,
    );
    expect(ms).toBeLessThan(cpuBudgetMs(5_000));
  });

  it('has no tie a page sheet splits, so no state wins by which sheet came last', () => {
    expect(found.map((c) => `${c.sheet} ${relative(REPO, c.file)}: ${c.a} ${c.b}`)).toEqual([]);
  });

  it("fails on the legal pages' tab as it was before #1688, and passes once one class names both states", () => {
    const before =
      'rounded-full px-4 py-1.5 text-slate-600 hover:text-slate-900 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white dark:text-slate-300 dark:hover:text-white dark:aria-[current=page]:bg-white dark:aria-[current=page]:text-slate-900';
    const tab = tiesIn('/components/LegalPage.tsx', `<a className="${before}">`);
    expect(tab.map((t) => `${t.a} ${t.b}`)).toEqual([
      'aria-[current=page]:text-white hover:text-slate-900',
      'dark:aria-[current=page]:text-slate-900 dark:hover:text-white',
    ]);
    const page = (text: string, files: string[] = ['/app/telemetry/Page.tsx']): Scanned => ({
      path: 'app/telemetry/telemetry.css',
      files: new Set(files),
      tokens: new Set(tokensOf(text)),
    });
    // A page sheet that emits the hover from its own file and not the aria half.
    expect(clashesOf([page("<b className='hover:text-slate-900'>")], tab)).toEqual([
      { ...tab[0], sheet: 'app/telemetry/telemetry.css' },
    ]);
    // Not when it emits both, nor when it scans the tab's file, nor when it emits neither.
    expect(clashesOf([page('hover:text-slate-900 aria-[current=page]:text-white')], tab)).toEqual(
      [],
    );
    expect(clashesOf([page('hover:text-slate-900', ['/components/LegalPage.tsx'])], tab)).toEqual(
      [],
    );
    expect(clashesOf([page('hover:text-slate-200')], tab)).toEqual([]);
    // The fix names both states, which weighs more than either: no tie left.
    const fixed = `${before} aria-[current=page]:hover:text-white dark:aria-[current=page]:hover:text-slate-900`;
    expect(tiesIn('/components/LegalPage.tsx', `<a className="${fixed}">`)).toEqual([]);
  });

  it('ties only classes of one property and mode with the same number of states', () => {
    const at = (text: string) => tiesIn('/x.tsx', text).map((t) => `${t.a} ${t.b}`);
    expect(at("'hover:bg-slate-100 focus-visible:bg-slate-200'")).toEqual([
      'focus-visible:bg-slate-200 hover:bg-slate-100',
    ]);
    // Another property, another mode, a plain class, or a class naming one more state: no tie.
    expect(at("'hover:text-slate-900 aria-[current=page]:bg-white'")).toEqual([]);
    expect(at("'hover:bg-slate-100 dark:focus-visible:bg-slate-800'")).toEqual([]);
    expect(at("'bg-white hover:bg-slate-100'")).toEqual([]);
    expect(at("'hover:bg-slate-100 aria-[current=page]:hover:bg-white'")).toEqual([]);
    // The same state twice (a class and its opacity step) is the same state set, not a tie.
    expect(at("'hover:bg-slate-100 hover:bg-slate-200'")).toEqual([]);
    expect(tiesIn('/x.test.tsx', "'hover:bg-a-100 focus:bg-b-100'")).toEqual([]);
  });
});
