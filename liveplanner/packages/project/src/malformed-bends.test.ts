import { describe, expect, it } from 'vitest';
import { createArrow } from './factories';
import { migrateIncomingTab } from './stored-tab';
import { elementValidationIssue, isValidTab } from './validate';
import { arrowPathD } from './arrow-path';
import { dropMalformedBends, MAX_CURVE_POINTS } from './malformed-bends';
import type { ArrowElement, Element, Tab } from './index';

// An arrow's bends are { dx, dy } deltas (docs/specs/008-canvas/arrow-bending.md "Stored bends").
const arrow = (fields: Record<string, unknown>) =>
  ({
    ...createArrow(0, 0, 100, 0),
    ...fields,
  }) as unknown as Element;

const JUNK = [
  'x',
  1,
  null,
  {},
  [null],
  [{ dx: 1 }],
  [{ dx: 'a', dy: 1 }],
  { dx: Number.NaN, dy: 0 },
];

describe('dropMalformedBends', () => {
  it('keeps well-formed bends and hands the same array back', () => {
    const els = [
      arrow({
        arrowStyle: 'curved',
        curvePoints: [{ dx: 1, dy: 2 }],
        curveOffset: { dx: 0, dy: 3 },
      }),
      arrow({ arrowStyle: 'angled', elbowOffset: { dx: 4, dy: 5 } }),
    ];
    expect(dropMalformedBends(els)).toBe(els);
  });

  it.each(JUNK)('drops a malformed bend field (%j) and keeps the rest', (bad) => {
    for (const field of ['curvePoints', 'curveOffset', 'elbowOffset']) {
      const [out] = dropMalformedBends([arrow({ [field]: bad, label: 'keep' })]);
      expect(field in out!).toBe(false);
      expect((out as ArrowElement).label).toBe('keep');
    }
  });

  it('drops a bend list longer than the limit', () => {
    const many = Array.from({ length: MAX_CURVE_POINTS + 1 }, () => ({ dx: 0, dy: 0 }));
    const [out] = dropMalformedBends([arrow({ curvePoints: many })]);
    expect('curvePoints' in out!).toBe(false);
  });
});

describe('a malformed bend on the way in', () => {
  it('is refused by validation with the rule it breaks', () => {
    expect(elementValidationIssue(arrow({ curvePoints: 'x' }))?.field).toBe('curvePoints');
    expect(elementValidationIssue(arrow({ curveOffset: { dx: 1 } }))?.field).toBe('curveOffset');
    expect(elementValidationIssue(arrow({ elbowOffset: [] }))?.field).toBe('elbowOffset');
    expect(elementValidationIssue(arrow({ curvePoints: [{ dx: 1, dy: 2 }] }))).toBeNull();
  });

  it('is repaired by the incoming-tab migration, so the tab validates and draws', () => {
    for (const style of ['curved', 'angled']) {
      const tab = migrateIncomingTab({
        id: 't',
        name: 'T',
        elements: [arrow({ arrowStyle: style, curvePoints: [null, 'x'], curveOffset: 'x' })],
      }) as Tab;
      expect(isValidTab(tab)).toBe(true);
      const a = tab.elements[0] as ArrowElement;
      expect(() =>
        arrowPathD(
          style as 'curved',
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          a.from,
          a.to,
          a.curveOffset,
          a.elbowOffset,
          a.curvePoints,
        ),
      ).not.toThrow();
    }
  });
});
