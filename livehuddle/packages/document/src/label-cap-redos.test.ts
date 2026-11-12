import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import { capLabel } from './label-cap';

// Untrusted text reaches the label cap from any API token: a changeset's
// `set` and `add` cap a shape's label inside the api worker
// (docs/specs/024-agents/agent-changesets.md). Every pass over it must stay linear: a pattern that
// backtracks over a long run of one character (spaces, brackets, dashes, quotes) turns one request
// into seconds of CPU. Each sample is fed with such a run inserted at every token boundary, and
// the slowest cases are timed again at four times the length: linear work grows about four times,
// quadratic work sixteen.

const RUN = 20_000;
// The sweeps time a few hundred inputs of tens of thousands of characters: under a second here, but over vitest's 5 s
// default on a loaded CI runner under coverage (5.3 s, main 2026-10-14), so each has room. Linearity is what the test
// holds, by growth, not by this limit.
const TIMEOUT_MS = 30_000;
const FILLS = [' ', '(', '[', '-', '.', '=', '"', ',', '|', '{'];

type Case = { build: (n: number) => string };

function cases(samples: string[], prefix = ''): Case[] {
  return samples.flatMap((sample) => {
    const gaps = [0, ...[...sample.matchAll(/\s/g)].map((m) => m.index), sample.length];
    return gaps.flatMap((at) =>
      FILLS.map((fill) => ({
        build: (n: number) =>
          prefix + sample.slice(0, at) + fill.repeat(n) + 'x' + sample.slice(at),
      })),
    );
  });
}

// One run's CPU time: wall-clock time also counts waiting for a core while other suites run, which read as growth
// under CI coverage (cpu-time.js).
function timeOf(text: string, run: (text: string) => unknown, reps = 1): number {
  return cpuMsOf(() => {
    for (let i = 0; i < reps; i++) void run(text);
  });
}

// Each growth sample runs the cap this many times, so the smaller sample takes milliseconds, not a fraction of
// one, and a timer tick or a collection cannot read as growth.
const REPS = 4;

// Four times the text, under eight times the CPU.
const RATIO_CEILING = cpuRatioCeiling(8);

// The sweep only picks the three slowest cases, so one timing each will do; the two sizes compared for growth, one
// and four times the sweep's length, are built outside the timing, warmed and timed in turns (cpuGrowthRatio), each
// sample running the cap REPS times. Kept small: the larger input grows V8's memory handling costs faster than the
// text (at sixteen times, four times the text cost seven to nine times the CPU), and two to eight read 8.13 once on
// a CI runner (main 2026-11-12). One to four measures 3.4 to 3.9 here, and a quadratic scan still reads 16.
function expectLinear(all: Case[], run: (text: string) => unknown): void {
  const slowest = all
    .map((c) => ({ c, ms: timeOf(c.build(RUN), run) }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3);
  for (const { c } of slowest) {
    const small = c.build(RUN);
    const large = c.build(RUN * 4);
    const ratio = cpuGrowthRatio(
      () => timeOf(small, run, REPS),
      () => timeOf(large, run, REPS),
      { ceiling: RATIO_CEILING },
    );
    expect(ratio, c.build(8)).toBeLessThan(RATIO_CEILING);
  }
}

describe('untrusted graph text stays linear', () => {
  it('caps a label in linear time whatever it repeats', { timeout: TIMEOUT_MS }, () => {
    const samples = [
      'Web client (React SPA served from the CDN) for customers',
      'Orders service, which creates orders; and more.',
      'A [bracketed] aside, then words to cut at a boundary',
    ];
    expectLinear(cases(samples), (t) => capLabel(t));
    expectLinear([{ build: (n) => `${'a'.repeat(n)} ${'() '.repeat(n)}` }], (t) => capLabel(t));
  });
});

// The scans read exactly as the patterns they replaced, checked against those patterns on short
// generated strings, where the patterns are safe: the oracles.
function* generated(alphabet: string[], count: number, seed = 7): Generator<string> {
  for (let n = 0; n < count; n += 1) {
    let text = '';
    const length = 4 + (n % 40);
    for (let i = 0; i < length; i += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      text += alphabet[seed % alphabet.length];
    }
    yield text;
  }
}

describe('the linear scans read exactly as the patterns they replaced', () => {
  it('caps labels as before', () => {
    const oracle = (text: string, max = 40) => {
      const whole = text.replace(/\s+/g, ' ').trim();
      if (whole.length <= max) return { label: whole, cut: false };
      const clean = whole.replace(/\s*[([][^)\]]*[)\]]/g, '').trim() || whole;
      if (clean.length <= max) return { label: clean, cut: true };
      const clause =
        /\s(?:which|that|who|whom|whose|where|when|for|to|with|by|holding|sending|serving|served|handling|storing|running|using|used|responsible)\s/i.exec(
          clean,
        );
      if (clause) {
        const head = clean.slice(0, clause.index).replace(/[\s,;:.-]+$/, '');
        if (head.length <= max && head.includes(' ')) return { label: head, cut: true };
      }
      const room = clean.slice(0, max - 1);
      const space = room.lastIndexOf(' ');
      const head = space > max * 0.5 ? room.slice(0, space) : room;
      return { label: `${head.replace(/[\s,;:.-]+$/, '')}…`, cut: true };
    };
    const alphabet = [
      'a',
      'b',
      ' ',
      ' ',
      '(',
      ')',
      '[',
      ']',
      ',',
      '.',
      '-',
      ';',
      ':',
      '\t',
      'for',
      'which',
    ];
    for (const text of generated(alphabet, 3000)) {
      const long = text.repeat(3);
      expect(capLabel(long), JSON.stringify(long)).toEqual(oracle(long));
    }
  });
});
