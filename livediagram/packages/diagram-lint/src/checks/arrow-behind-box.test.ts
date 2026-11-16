import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

describe('arrow-behind-box', () => {
  it('fires on an arrow through a box it does not connect, listing every such box', () => {
    const report = lint(
      tabOf(
        box('a', 0, 0),
        box('m', 200, 0),
        box('n', 400, 0),
        box('b', 600, 0),
        arrow('x', 'a', 'b'),
      ),
    );
    expect(of(report, 'arrow-behind-box')).toEqual([
      {
        code: 'arrow-behind-box',
        severity: 'warning',
        refs: ['x', 'm', 'n'],
        message: 'a→b passes behind m, n',
        // No style clears two boxes in line with both ends: move the first off the line, the shorter way.
        fix: 'move m by=0,46',
      },
    ]);
    expect(report.measures.behind).toBe(1);
  });

  it('suggests a style only when its route clears every box, else a move, per arrow, and a graph change', () => {
    // A diagonal through m: angled goes round it.
    const diagonal = arrow('x', 'a', 'b', ['s', 'w']);
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('m', 200, 100), box('b', 500, 300), diagonal)),
        'arrow-behind-box',
      )[0]!.fix,
    ).toBe('set a->b line=angled');
    // Angled and level, nothing clears m: a move, never curved and back again.
    const angled = arrow('x', 'a', 'b', ['e', 'w'], { arrowStyle: 'angled' });
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('m', 200, 0), box('b', 400, 0), angled)),
        'arrow-behind-box',
      )[0]!.fix,
    ).toBe('move m by=0,46');
    const twice = lint(
      tabOf(
        box('a', 0, 0),
        box('m', 200, 0),
        box('b', 400, 0),
        arrow('x', 'a', 'b'),
        arrow('y', 'a', 'b'),
      ),
    );
    // Two arrows on one anchor are drawn fanned apart, so each clears m its own way.
    expect(of(twice, 'arrow-behind-box').map((f) => f.fix)).toEqual([
      'move m by=0,39',
      'move m by=0,-39',
    ]);
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('m', 200, 0), box('b', 400, 0), arrow('x', 'a', 'b')), {
          source: 'graph',
        }),
        'arrow-behind-box',
      )[0]!.fix,
    ).toBe('drop the groups, or lines: angled');
  });

  it('names an arrow with a free end by its ref', () => {
    const half = { ...arrow('x', 'a', 'b'), to: { kind: 'free', x: 500, y: 30 } } as never;
    expect(
      of(lint(tabOf(box('a', 0, 0), box('m', 200, 0), half)), 'arrow-behind-box')[0]!.message,
    ).toBe('x passes behind m');
  });

  it('stays quiet for an arrow between neighbours, and never counts its own ends', () => {
    expect(
      of(lint(tabOf(box('a', 0, 0), box('b', 300, 0), arrow('x', 'a', 'b'))), 'arrow-behind-box'),
    ).toEqual([]);
  });

  // Work Tracker 1033: shipped templates draw these correctly, so the lint says nothing of them.
  describe('what a line passes under by design', () => {
    const behind = (...els: Element[]) =>
      of(
        lint(tabOf(box('a', 0, 0), box('b', 600, 0), arrow('x', 'a', 'b'), ...els)),
        'arrow-behind-box',
      );
    const onTheLine = (id: string, extra: Record<string, unknown> = {}, y = 0) =>
      box(id, 300, y, extra);

    it('fires on a box over the line, for contrast', () => {
      expect(behind(onTheLine('m'))).toHaveLength(1);
    });

    it('passes a mark on the line: a step, a badge, a sticker or an icon', () => {
      for (const shape of ['step', 'badge', 'sticker', 'icon'])
        expect(behind(onTheLine('m', { shape, width: 30, height: 30 }))).toEqual([]);
    });

    it('passes a thin unlabelled bar (a lifeline or an activation), but not a labelled one', () => {
      expect(behind(onTheLine('m', { label: '', width: 14, height: 400 }))).toEqual([]);
      expect(behind(onTheLine('m', { label: '', width: 100, height: 12 }, 24))).toEqual([]);
      expect(behind(onTheLine('m', { label: 'Bar', width: 14, height: 400 }))).toHaveLength(1);
      expect(behind(onTheLine('m', { label: '', width: 100, height: 40 }))).toHaveLength(1);
    });

    it('passes a group’s unlabelled backdrop panel, which holds a member wholly', () => {
      const panel = box('panel', 250, -100, { label: '', width: 300, height: 260 });
      const member = box('member', 300, 120, { width: 80, height: 30 });
      expect(behind(panel, member)).toEqual([]);
      // Nothing inside it: an empty box on the line is still behind.
      expect(behind(onTheLine('m', { label: '', width: 100, height: 40 }))).toHaveLength(1);
      // A labelled box holding another is content, not a backdrop.
      const labelled = box('panel', 250, -100, { label: 'Team', width: 300, height: 260 });
      expect(behind(labelled, member).map((f) => f.refs)).toEqual([['x', 'panel']]);
    });

    it('says nothing of a rule: a line with free ends and no heads', () => {
      const rule = {
        ...arrow('r', 'a', 'b'),
        from: { kind: 'free', x: 350, y: -200 },
        to: { kind: 'free', x: 350, y: 200 },
        arrowEnds: 'none',
      } as never;
      expect(of(lint(tabOf(box('m', 300, 0), rule)), 'arrow-behind-box')).toEqual([]);
      // With a head it is an arrow, and passes behind.
      const headed = { ...(rule as object), arrowEnds: 'end' } as never;
      expect(of(lint(tabOf(box('m', 300, 0), headed)), 'arrow-behind-box')).toHaveLength(1);
    });
  });
});
