import { describe, expect, it } from 'vitest';
import { planActions, type PlannedRun } from './plan-actions';
import type { AutomationAction, AutomationStep } from './types';
import { BUG, NOTE, OUTLINE, bug, ctxFor } from './test-fixtures';
import type { ItemTypeDef } from '../item-types';
import type { Item, ItemFieldValue } from '../item';

// docs/specs/026-plan/automations.md "Actions" (Change Card Type, Copy Card, Add a Checklist, Link Cards) and
// "Wait": the actions after Phase 3 planned, pure.
const done = (r: PlannedRun) => {
  if ('failed' in r) throw new Error(r.failed);
  return r;
};
const failed = (r: PlannedRun) => ('failed' in r ? r.failed : null);
const run = (steps: AutomationStep[], card: Item = bug(), extra = {}) =>
  planActions(steps, ctxFor(card, extra));
const note = (fields: Record<string, ItemFieldValue> = {}, extra: Partial<Item> = {}): Item => ({
  ...bug({ 'f-severity': undefined, ...fields }),
  type: 'note',
  ...extra,
});

describe('Change Card Type', () => {
  it('changes the type in the patch, and later steps read the card as its new type', () => {
    const r = done(run([{ kind: 'set_type', type: 'note' }]));
    expect(r.patch).toEqual({ type: 'note' });
    expect(r.lines).toEqual([{ kind: 'action', ok: true, text: 'Change to Note' }]);
    expect(
      failed(
        run([
          { kind: 'set_type', type: 'note' },
          { kind: 'move', status: 'done' },
        ]),
      ),
    ).toBe("A Note card can't go in Done");
  });

  it('is Already so for a card of that type', () => {
    const r = done(run([{ kind: 'set_type', type: 'bug' }]));
    expect(r.patch).toEqual({});
    expect(r.lines[0]).toMatchObject({ text: 'Change to Bug', already: true });
  });

  it.each([
    [{ kind: 'set_type', type: 'epic' }, bug(), 'Card type epic is gone'],
    [{ kind: 'set_type', type: 'note' }, bug({ status: 'done' }), "A Note card can't be in Done"],
  ] as [AutomationAction, Item, string][])('fails %o', (action, card, reason) => {
    expect(failed(run([action], card))).toBe(reason);
  });
});

describe('Copy Card', () => {
  it('plans a card of its type with its fields, in its own column or the one chosen', () => {
    const card = bug({ labels: ['a'], archived: true, status: 'doing' });
    const same = done(run([{ kind: 'copy_card' }], card));
    expect(same.created).toEqual([
      {
        type: 'bug',
        status: 'doing',
        fields: { title: 'Login fails', 'f-severity': 'High', labels: ['a'] },
      },
    ]);
    expect(same.lines[0]!.text).toBe('Copy Card "Login fails"');
    expect(same.patch).toEqual({});
    const moved = done(run([{ kind: 'copy_card', status: 'done' }], card));
    expect(moved.created[0]!.status).toBe('done');
    const loose = done(run([{ kind: 'copy_card' }], bug({ status: undefined })));
    expect(loose.created[0]).not.toHaveProperty('status');
  });

  it.each([
    [{ kind: 'copy_card', status: 'qa' }, bug(), 'Column qa is gone'],
    [{ kind: 'copy_card', status: 'done' }, note(), "A Note card can't go in Done"],
  ] as [AutomationAction, Item, string][])('fails %o', (action, card, reason) => {
    expect(failed(run([action], card))).toBe(reason);
  });

  it('makes at most one card a run, a copy included', () => {
    expect(
      failed(run([{ kind: 'create_card', type: 'note', title: 't' }, { kind: 'copy_card' }])),
    ).toBe('A run makes up to 1 card');
  });
});

describe('Add a Checklist', () => {
  const LISTED: ItemTypeDef = { ...NOTE, fields: [...NOTE.fields, 'checklist'] };
  const outline = { ...OUTLINE, types: [BUG, LISTED] };

  it('adds the items the checklist lacks, unticked, after the ones it holds', () => {
    const card = note({ checklist: [{ text: 'Write tests', done: true }] });
    const r = done(
      run(
        [
          {
            kind: 'add_checklist',
            items: [' write tests ', '{{card.title}}', '{{card.due}}', 'Ship'],
          },
        ],
        card,
        { outline },
      ),
    );
    expect(r.patch.set!['checklist']).toEqual([
      { text: 'Write tests', done: true },
      { text: 'Login fails', done: false },
      { text: 'Ship', done: false },
    ]);
    expect(r.lines[0]).toEqual({ kind: 'action', ok: true, text: 'Add 2 checklist items' });
  });

  it('says one item, and is Already so when the card holds them all', () => {
    const one = done(run([{ kind: 'add_checklist', items: ['Ship'] }], note(), { outline }));
    expect(one.patch.set!['checklist']).toEqual([{ text: 'Ship', done: false }]);
    expect(one.lines[0]!.text).toBe('Add 1 checklist item');
    const had = note({ checklist: [{ text: 'Ship', done: false }] });
    const again = done(run([{ kind: 'add_checklist', items: ['ship'] }], had, { outline }));
    expect(again.patch).toEqual({});
    expect(again.lines[0]).toMatchObject({ text: 'Add 0 checklist items', already: true });
  });

  it('fails a card with no Checklist, and one past the checklist limit', () => {
    expect(failed(run([{ kind: 'add_checklist', items: ['x'] }]))).toBe(
      'A Bug card has no Checklist',
    );
    const full = note({
      checklist: Array.from({ length: 50 }, (_, i) => ({ text: `t${i}`, done: false })),
    });
    expect(failed(run([{ kind: 'add_checklist', items: ['more'] }], full, { outline }))).toBe(
      'A checklist holds up to 50 items',
    );
  });
});

describe('Link Cards', () => {
  const target = bug({ title: 'Target' });

  it('adds the card to a field of several, once, naming it on the line', () => {
    const card = note();
    const link: AutomationAction = { kind: 'link_card', field: 'f-links', to: { card: target.id } };
    const r = done(run([link, link], card, { items: [card, target] }));
    expect(r.patch).toEqual({ set: { 'f-links': [target.id] } });
    expect(r.lines.map((l) => [l.text, 'already' in l])).toEqual([
      [`Link Links to #${target.key}`, false],
      [`Link Links to #${target.key}`, true],
    ]);
  });

  it('replaces a single Card field, and names "a card" without the plan’s cards', () => {
    const r = done(
      run(
        [{ kind: 'link_card', field: 'f-parent', to: { card: 'c-other' } }],
        bug({ 'f-parent': 'c-old' }),
      ),
    );
    expect(r.patch).toEqual({ set: { 'f-parent': 'c-other' } });
    expect(r.lines[0]!.text).toBe('Link Parent Bug to a card');
  });

  it.each([
    [
      'a field its type lacks',
      { field: 'f-links', to: { card: 'x' } },
      bug(),
      'A Bug card has no Card field f-links',
    ],
    [
      'a field that is not a Card field',
      { field: 'f-points', to: { card: 'x' } },
      bug(),
      'A Bug card has no Card field f-points',
    ],
    [
      'a card that is gone',
      { field: 'f-parent', to: { card: 'gone' } },
      bug(),
      'The card to link is gone',
    ],
    [
      'no card that started it',
      { field: 'f-parent', to: { trigger: true } },
      bug(),
      'No card to link',
    ],
  ] as [string, object, Item, string][])('fails %s', (_, a, card, reason) => {
    expect(
      failed(
        run([{ kind: 'link_card', ...a } as AutomationAction], card, { items: [card, target] }),
      ),
    ).toBe(reason);
  });

  it('never links a card to itself', () => {
    const card = bug();
    expect(
      failed(
        run([{ kind: 'link_card', field: 'f-parent', to: { card: card.id } }], card, {
          items: [card],
        }),
      ),
    ).toBe("A card can't link to itself");
  });

  it('links each related card back to the card that started the rule', () => {
    const parent = bug({ title: 'Epic' });
    const kid = bug({ title: 'Kid', 'f-parent': parent.id });
    const r = done(
      planActions(
        [
          {
            kind: 'for',
            related: { kind: 'children' },
            conditions: [],
            then: [{ kind: 'link_card', field: 'f-parent', to: { trigger: true } }],
          },
        ],
        ctxFor(parent, { items: [parent, kid] }),
      ),
    );
    expect(r.related[0]!.patch).toEqual({});
    expect(r.lines[1]).toMatchObject({
      text: `#${kid.key} Link Parent Bug to #${parent.key}`,
      already: true,
    });
  });

  it('refuses a Blocked By link that would close a loop, and allows one that does not', () => {
    const BLOCKED: ItemTypeDef = {
      ...NOTE,
      fields: [...NOTE.fields, 'f-blocked'],
      custom: [
        { id: 'f-blocked', label: 'Blocked By', kind: 'card', multiple: true, blocks: true },
      ],
    };
    const outline = { ...OUTLINE, types: [BUG, BLOCKED] };
    const b = note();
    const a = note({ 'f-blocked': [b.id] });
    const c = note();
    const link = (to: Item): AutomationAction => ({
      kind: 'link_card',
      field: 'f-blocked',
      to: { card: to.id },
    });
    const items = [a, b, c];
    expect(failed(run([link(a)], b, { outline, items }))).toBe(
      'That link would close a Blocked By loop',
    );
    expect(done(run([link(c)], b, { outline, items })).patch).toEqual({
      set: { 'f-blocked': [c.id] },
    });
  });
});

describe('Wait', () => {
  const steps: AutomationStep[] = [
    { kind: 'flag' },
    { kind: 'wait', hours: 50 },
    { kind: 'unflag' },
  ];

  it('ends the plan at a Wait, saying how long and the step the rest goes on from', () => {
    const r = done(run(steps));
    expect(r.patch).toEqual({ set: { flagged: true } });
    expect(r.wait).toEqual({ hours: 50, from: 2 });
    expect(r.lines.map((l) => l.text)).toEqual(['Flag', 'Wait 2 Days 2 Hours']);
  });

  it('goes on from the step after it later', () => {
    const r = done(planActions(steps, ctxFor(bug({ flagged: true })), { from: 2 }));
    expect(r.patch).toEqual({ clear: ['flagged'] });
    expect(r.wait).toBeUndefined();
  });

  it('plans past every Wait for Test on a Card', () => {
    const r = done(planActions(steps, ctxFor(bug()), { through: true }));
    expect(r.wait).toBeUndefined();
    expect(r.patch).toEqual({});
    expect(r.lines.map((l) => l.text)).toEqual([
      'Flag',
      'Would wait 2 days 2 hours, then:',
      'Unflag',
    ]);
  });
});
