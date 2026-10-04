import { describe, expect, it } from 'vitest';
import { capLabel } from './graph-input';
import { parseMermaid } from './mermaid';
import { decodeLabel } from './mermaid-shared';
import { readFlowchartHeader, readInlineLabel } from './mermaid-scan';

// Untrusted text reaches the label cap and the Mermaid parser from any API token: a changeset's
// `replace` compiles graph and Mermaid input inside the api worker
// (docs/specs/024-agents/agent-changesets.md). Every pass over it must stay linear: a pattern that
// backtracks over a long run of one character (spaces, brackets, dashes, quotes) turns one request
// into seconds of CPU. Each sample is fed with such a run inserted at every token boundary, and
// the slowest cases are timed again at four times the length: linear work grows about four times,
// quadratic work sixteen.

const RUN = 20_000;
const FILLS = [' ', '(', '[', '-', '.', '=', '"', ',', '|', '{'];

type Case = { build: (n: number) => string };

function cases(samples: string[], prefix = ''): Case[] {
  return samples.flatMap((sample) => {
    const gaps = [0, ...[...sample.matchAll(/\s/g)].map((m) => m.index!), sample.length];
    return gaps.flatMap((at) =>
      FILLS.map((fill) => ({
        build: (n: number) =>
          prefix + sample.slice(0, at) + fill.repeat(n) + 'x' + sample.slice(at),
      })),
    );
  });
}

// Best of `tries`, so one scheduling hiccup does not read as growth.
function timeOf(text: string, run: (text: string) => unknown, tries = 3): number {
  let best = Infinity;
  for (let i = 0; i < tries; i += 1) {
    const start = performance.now();
    run(text);
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

// The sweep only picks the three slowest cases, so one timing each will do; the two times compared
// for growth are each best of three.
function expectLinear(all: Case[], run: (text: string) => unknown): void {
  const slowest = all
    .map((c) => ({ c, ms: timeOf(c.build(RUN), run, 1) }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3);
  for (const { c } of slowest) {
    const ms = timeOf(c.build(RUN), run);
    const grown = timeOf(c.build(RUN * 4), run);
    expect(grown, c.build(8)).toBeLessThan(ms * 8 + 5);
  }
}

describe('untrusted graph text stays linear', () => {
  it('caps a label in linear time whatever it repeats', () => {
    const samples = [
      'Web client (React SPA served from the CDN) for customers',
      'Orders service, which creates orders; and more.',
      'A [bracketed] aside, then words to cut at a boundary',
    ];
    expectLinear(cases(samples), (t) => capLabel(t));
    expectLinear([{ build: (n) => `${'a'.repeat(n)} ${'() '.repeat(n)}` }], (t) => capLabel(t));
  });

  it('parses a flowchart in linear time whatever a line repeats', () => {
    const lines = [
      'graph TD',
      'A["Start"] -- yes --> B(Done)',
      'A -. maybe .-> C{Check}',
      'A == strong ==> D[(Store)]',
      'B -->|label| C',
      'C & D --> E',
      'subgraph s1 [Title]',
      'click A href "https://example.com"',
      'E@{ shape: stadium, label: "Hi" }',
    ];
    expectLinear(cases(lines, 'graph TD\n'), (t) => parseMermaid(t));
    expectLinear([{ build: (n) => `graph${' '.repeat(n)}x\nA --> B` }], (t) => parseMermaid(t));
  });

  it('parses state and ER diagrams in linear time whatever a line repeats', () => {
    const state = ['[*] --> Idle', 'Idle --> Busy : start work', 'state "Long name" as L'];
    const er = ['CUSTOMER ||--o{ ORDER : places', 'ORDER { string id PK "the id" }'];
    expectLinear(cases(state, 'stateDiagram-v2\n'), (t) => parseMermaid(t));
    expectLinear(cases(er, 'erDiagram\n'), (t) => parseMermaid(t));
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

  it('reads flowchart headers as before', () => {
    const pattern = /^\s*(?:flowchart|graph)\b\s*([A-Za-z]{2})?\s*$/i;
    const alphabet = ['graph', 'flowchart', 'Graph', ' ', '\t', 'TD', 'LR', 'x', 'abc', '-', 'g'];
    for (const text of generated(alphabet, 3000)) {
      const m = pattern.exec(text);
      expect(readFlowchartHeader(text), JSON.stringify(text)).toBe(m ? (m[1] ?? '') : null);
    }
  });

  it('reads inline edge labels as before', () => {
    const forms = [
      { re: /^\s*--\s+(.+?)\s+(-{2,})([>ox])?/, line: 'solid' },
      { re: /^\s*-\.\s+(.+?)\s+\.+(-)([>ox])?/, line: 'dashed' },
      { re: /^\s*==\s+(.+?)\s+(={2,})([>ox])?/, line: 'thick' },
    ] as const;
    const oracle = (s: string) => {
      for (const { re, line } of forms) {
        const m = re.exec(s);
        if (m) return { label: m[1]!, ...(m[3] ? { trail: m[3] } : {}), line, length: m[0].length };
      }
      return null;
    };
    const alphabet = [' ', ' ', '--', '-.', '==', '-', '.', '=', '>', 'o', 'x', 'yes', 'a b', '\t'];
    let matched = 0;
    for (const text of generated(alphabet, 6000, 11)) {
      const expected = oracle(text);
      if (expected) matched += 1;
      expect(readInlineLabel(text), JSON.stringify(text)).toEqual(expected);
    }
    // The generator reaches the matching cases, not only the refusals.
    expect(matched).toBeGreaterThan(50);
    expect(decodeLabel(readInlineLabel('-- yes -->')!.label)).toBe('yes');
  });
});
