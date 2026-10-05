import { describe, expect, it } from 'vitest';
import { LINT_CODES } from '@livediagram/api-schema';
import type { Element, Tab } from '@livediagram/document';
import { applyEditOperations, parseEditOperations } from '@livediagram/edit-operations';
import { arrow, box, frame, lint } from './fixtures/build';

// One drawing per code, each drawing that code's fault.
const DRAWINGS: Element[][] = [
  [box('a', 0, 0), box('b', 60, 20)],
  [box('a', 0, 0), arrow('gone', 'a', 'missing')],
  [box('a', 0, 0), box('m', 200, 0), box('b', 400, 0), arrow('x', 'a', 'b')],
  (() => {
    const els: Element[] = [];
    for (let i = 0; i < 4; i++) els.push(box(`s${i}`, 0, i * 100), box(`t${i}`, 600, i * 100));
    for (let i = 0; i < 4; i++) els.push(arrow(`x${i}`, `s${i}`, `t${3 - i}`));
    return els;
  })(),
  [
    box('a', 0, 0),
    box('b', 160, 0),
    arrow('x', 'a', 'b', ['e', 'w'], { label: 'A long label that will not fit' }),
  ],
  [
    box('a', 0, 0, {
      label: 'An extremely long label that cannot possibly fit in this small box',
      textSize: 'md',
    }),
    box('b', 0, 300, {
      label: 'An extremely long label that cannot possibly fit in this small box',
    }),
  ],
  [box('a', 0, 0), box('b', 300, 0), arrow('x', 'a', 'b'), box('alone', 0, 200)],
  [frame('f', 0, 0, 200, 200), box('a', 120, 20)],
  [
    frame('core', 0, 0, 200, 400),
    box('a', 40, 40),
    box('b', 40, 300),
    box('x', 400, 40),
    box('y', 400, 300),
    box('z', 400, 500),
    arrow('1', 'a', 'x'),
    arrow('2', 'b', 'y'),
    arrow('3', 'a', 'z'),
  ],
  [box('a', 0, 0, { label: 'Same' }), box('b', 300, 0, { label: 'same' })],
  [
    box('a', 0, 0),
    box('b', 0, 200),
    box('c', 0, 400),
    box('d', 0, 600),
    arrow('1', 'a', 'b', ['s', 'n']),
    arrow('2', 'b', 'c', ['s', 'n']),
    arrow('3', 'c', 'd', ['s', 'n']),
    arrow('ret', 'd', 'a', ['n', 's']),
  ],
  [box('a', 0, 0), box('b', 600, 0), box('c', 1200, 0)],
  [box('a', 0, 0, { fillColor: '#123456', strokeColor: '#654321' })],
];

describe('tab fixes', () => {
  const findings = DRAWINGS.flatMap((elements) => {
    const tab: Tab = { id: 't', name: 'T', theme: 'ocean', elements };
    return lint(tab).findings.map((finding) => ({ finding, tab }));
  });

  it('cover every code', () => {
    expect(new Set(findings.map(({ finding }) => finding.code))).toEqual(new Set(LINT_CODES));
  });

  it.each(findings.map(({ finding, tab }) => [finding.code, finding.fix, tab] as const))(
    '%s: "%s" parses and applies as edit operations',
    (_, fix, tab) => {
      const text = fix
        .replaceAll('<ref>', 'a')
        .replaceAll('<text>', 'Shorter')
        .split('; ')
        .join('\n');
      const parsed = parseEditOperations(text);
      expect(parsed).not.toHaveProperty('errors');
      if ('errors' in parsed) return;
      const outcome = applyEditOperations(tab, parsed.operations);
      expect('errors' in outcome ? outcome.errors : []).toEqual([]);
    },
  );
});
