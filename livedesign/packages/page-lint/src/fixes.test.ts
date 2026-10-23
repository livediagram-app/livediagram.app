import { describe, expect, it } from 'vitest';
import { LINT_CODES } from '@livedesign/api-schema';
import type { Element, Tab } from '@livedesign/design';
import { applyEditOperations, parseEditOperations } from '@livedesign/edit-operations';
import { box, lint, text } from './fixtures/build';

const LONG = 'An extremely long label that cannot possibly fit in this small box';

// One drawing per fault, each drawing it.
const DRAWINGS: Element[][] = [
  [box('a', 0, 0, { label: LONG, textSize: 'md' }), box('b', 0, 300, { label: LONG })],
  [
    box('c', 0, 0, {
      shape: 'card',
      width: 120,
      height: 120,
      pageTitle: 'ElastiCache',
      pageSubtitle: 'A subtitle far too long to fit',
      label: 'Sessions',
    }),
  ],
  [
    text('a', 0, 0, 'A heading long enough to wrap onto three or more lines in its box', {
      textSize: 'lg',
    }),
  ],
  [text('a', 0, 0, '£4.6bn', { width: 70, height: 120, textSize: 'lg' })],
  [text('a', 0, 0, 'One'), text('b', 0, 8, 'Two')],
];

describe('tab fixes', () => {
  const findings = DRAWINGS.map((elements): Tab => ({ id: 't', name: 'T', elements })).flatMap(
    (tab) => lint(tab).findings.map((finding) => ({ finding, tab })),
  );

  it('cover every code', () => {
    expect(new Set(findings.map(({ finding }) => finding.code))).toEqual(new Set(LINT_CODES));
  });

  it.each(findings.map(({ finding, tab }) => [finding.code, finding.fix, tab] as const))(
    '%s: "%s" parses and applies as edit operations',
    (_, fix, tab) => {
      const parsed = parseEditOperations(fix.replaceAll('<text>', 'Shorter'));
      expect(parsed).not.toHaveProperty('errors');
      if ('errors' in parsed) return;
      const outcome = applyEditOperations(tab, parsed.operations);
      expect('errors' in outcome ? outcome.errors : []).toEqual([]);
    },
  );
});
