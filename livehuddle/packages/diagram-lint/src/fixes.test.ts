import { describe, expect, it } from 'vitest';
import { LINT_CODES, type LintCode } from '@livehuddle/api-schema';
import type { Element, Tab } from '@livehuddle/document';
import { applyEditOperations, parseEditOperations } from '@livehuddle/edit-operations';
import { box, lint } from './fixtures/build';

// One drawing per code that still fires, each drawing that code's fault. The arrow codes went with the arrows, with
// box-overlap and aspect-extreme, which judged the graph they drew (part 4 of the element engine): the codes stay on
// the wire.
const DRAWINGS: Element[][] = [
  [
    box('a', 0, 0, {
      label: 'An extremely long label that cannot possibly fit in this small box',
      textSize: 'md',
    }),
    box('b', 0, 300, {
      label: 'An extremely long label that cannot possibly fit in this small box',
    }),
  ],
  [box('a', 0, 0, { label: 'Same' }), box('b', 300, 0, { label: 'same' })],
  [box('a', 0, 0, { fillColor: '#123456', strokeColor: '#654321' })],
];

const FIRING: readonly LintCode[] = [
  'label-overflow',
  'duplicate-label',
  'colour-on-themed',
  'text-overflow',
];

// Two texts printed over each other (text-overflow).
const OVERPRINT: Element[] = [
  { id: 'a', type: 'text', x: 0, y: 0, width: 200, height: 40, label: 'One' },
  { id: 'b', type: 'text', x: 0, y: 8, width: 200, height: 40, label: 'Two' },
];

describe('tab fixes', () => {
  const findings = [
    ...DRAWINGS.map((elements): Tab => ({ id: 't', name: 'T', theme: 'ocean', elements })),
    { id: 't', name: 'T', elements: OVERPRINT } satisfies Tab,
  ].flatMap((tab) => lint(tab).findings.map((finding) => ({ finding, tab })));

  it('cover every code that still fires', () => {
    expect(new Set(findings.map(({ finding }) => finding.code))).toEqual(new Set(FIRING));
    expect(FIRING.every((code) => LINT_CODES.includes(code))).toBe(true);
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
