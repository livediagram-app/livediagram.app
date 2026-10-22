import { describe, expect, it } from 'vitest';
import { box, lint, of, tabOf } from '../fixtures/build';

describe('duplicate-label', () => {
  it('fires once a label shared by boxes, ignoring case and spacing', () => {
    const report = lint(
      tabOf(
        box('a', 0, 0, { label: 'Orders  DB' }),
        box('b', 300, 0, { label: ' orders db' }),
        box('c', 600, 0, { label: 'ORDERS DB' }),
      ),
    );
    expect(of(report, 'duplicate-label')).toEqual([
      {
        code: 'duplicate-label',
        severity: 'info',
        refs: ['a', 'b', 'c'],
        message: 'a, b, c share "Orders DB"',
        fix: 'set b label="<text>"',
      },
    ]);
  });

  it("counts a card's title and subtitle", () => {
    const card = (id: string, x: number, sub: string) =>
      box(id, x, 0, { shape: 'card', pageTitle: 'ECS', pageSubtitle: sub, label: 'Web + API' });
    expect(
      of(lint(tabOf(card('a', 0, 'AZ A'), card('b', 300, 'AZ B'))), 'duplicate-label'),
    ).toEqual([]);
    expect(
      of(lint(tabOf(card('a', 0, 'AZ A'), card('b', 300, 'AZ A'))), 'duplicate-label'),
    ).toHaveLength(1);
  });

  it('never matches blank labels or different ones', () => {
    expect(
      of(
        lint(tabOf(box('a', 0, 0, { label: '' }), box('b', 300, 0, { label: '' }))),
        'duplicate-label',
      ),
    ).toEqual([]);
    expect(
      of(
        lint(tabOf(box('a', 0, 0, { label: undefined }), box('b', 300, 0, { label: undefined }))),
        'duplicate-label',
      ),
    ).toEqual([]);
    expect(of(lint(tabOf(box('a', 0, 0), box('b', 300, 0))), 'duplicate-label')).toEqual([]);
  });
});
