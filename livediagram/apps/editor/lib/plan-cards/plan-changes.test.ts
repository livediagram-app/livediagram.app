import { PLAN_EDITS_MAX } from '@liveworkspace/index-client';
import type { Element } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { drawnPlanOf, planChangeOffers } from './plan-changes';
import { arrow, box, lane, text } from './test-elements';

// docs/specs/013-workspace/make-plan-cards.md "Changes to the plan": on a drawn tab, an arrow someone drew between two
// card boxes offers a Blocked By, and a box dragged into another lane offers a move to that lane's column. Offers only.
const caption = (url: string): Element => ({
  ...text('plan:caption', 'From the plan'),
  link: { kind: 'url', url },
});
const drawn = (): Element[] => [
  caption('https://www.liveplanner.app/project/P1#t=tab'),
  lane('lane:todo', 'To Do', { x: 0, y: 0, width: 400, height: 100 }),
  lane('lane:done', 'Done', { x: 0, y: 200, width: 400, height: 100 }),
  box('card:todo:c1', 'Design', { x: 10, y: 10 }),
  box('card:todo:c2', 'Build', { x: 200, y: 10 }),
  arrow('dep:c1:c2', 'card:todo:c1', 'card:todo:c2'),
];

describe('drawnPlanOf', () => {
  it("reads the plan from the caption's link, else null", () => {
    expect(drawnPlanOf(drawn())).toBe('P1');
    expect(drawnPlanOf([caption('https://x/project/P2?a=1')])).toBe('P2');
    expect(drawnPlanOf([caption('https://x/project/P3/more')])).toBe('P3');
    expect(drawnPlanOf([caption('https://x/project/')])).toBeNull();
    expect(drawnPlanOf([caption('https://x/elsewhere')])).toBeNull();
    expect(drawnPlanOf([text('plan:caption', 'No link')])).toBeNull();
    expect(drawnPlanOf([box('a', 'A')])).toBeNull();
  });
});

describe('planChangeOffers', () => {
  it('offers nothing for the drawing as the plan drew it', () => {
    expect(planChangeOffers(drawn())).toEqual([]);
  });

  it('offers a Blocked By for a drawn arrow between two cards, either way round, once', () => {
    const offers = planChangeOffers([
      ...drawn(),
      arrow('mine', 'card:todo:c2', 'card:todo:c1'),
      arrow('mine2', 'card:todo:c2', 'card:todo:c1'),
      arrow('back', 'card:todo:c2', 'card:todo:c1', { arrowEnds: 'from' }),
      arrow('both', 'card:todo:c1', 'card:todo:c2', { arrowEnds: 'both' }),
      arrow('self', 'card:todo:c1', 'card:todo:c1'),
      arrow('loose', 'card:todo:c1', 'x'),
      arrow('free', 'card:todo:c1', 'card:todo:c2', { to: { kind: 'free', x: 0, y: 0 } }),
    ]);
    expect(offers).toEqual([
      {
        key: 'block:c2>c1',
        edit: { kind: 'block', card: 'c1', blocker: 'c2' },
        words: 'Design waits on Build',
      },
    ]);
  });

  it('offers no Blocked By for a headless arrow: it says no order', () => {
    const elements = drawn().filter((el) => el.id !== 'dep:c1:c2');
    expect(
      planChangeOffers([
        ...elements,
        arrow('none', 'card:todo:c2', 'card:todo:c1', { arrowEnds: 'none' }),
      ]),
    ).toEqual([]);
  });

  it('offers a move for a card dragged into another lane, never one outside every lane', () => {
    const elements = drawn().map((el) =>
      el.id === 'card:todo:c2'
        ? { ...el, y: 210 }
        : el.id === 'card:todo:c1'
          ? { ...el, y: 900 }
          : el,
    );
    const offers = planChangeOffers(elements);
    expect(offers).toEqual([
      {
        key: 'move:c2>done',
        edit: { kind: 'move', card: 'c2', column: 'Done' },
        words: 'Build moves to Done',
      },
    ]);
    // Dismissed offers stay away.
    expect(planChangeOffers(elements, new Set(['move:c2>done']))).toEqual([]);
  });

  it('names unlabelled cards plainly and skips an unnamed lane', () => {
    const offers = planChangeOffers([
      lane('lane:x', '', { x: 0, y: 0, width: 400, height: 100 }),
      lane('lane:y', 'Y', { x: 0, y: 500, width: 400, height: 100 }),
      box('card:y:a', '', { x: 10, y: 10 }),
      box('card:y:b', '', { x: 200, y: 510 }),
      arrow('mine', 'card:y:a', 'card:y:b'),
    ]);
    expect(offers.map((o) => o.words)).toEqual(['A card waits on another card']);
  });

  it(`holds at most ${PLAN_EDITS_MAX} offers`, () => {
    const cards = Array.from({ length: 30 }, (_, i) =>
      box(`card:todo:k${i}`, `K${i}`, { x: 1000 + i, y: 1000 }),
    );
    const arrows = cards.slice(1).map((c, i) => arrow(`m${i}`, cards[i]!.id, c.id));
    expect(planChangeOffers([...cards, ...arrows])).toHaveLength(PLAN_EDITS_MAX);
  });
});
