import { describe, expect, it } from 'vitest';
import { planActions, type PlannedRun } from './plan-actions';
import { automationPerson, type AutomationStep } from './types';
import { ALI, SAM, bug, ctxFor } from './test-fixtures';
import type { Item } from '../item';

// docs/specs/026-plan/automations.md "For Related Cards", "Assign in turn", "Outgoing actions": the Phase 2 steps
// planned, pure.
const done = (r: PlannedRun) => {
  if ('failed' in r) throw new Error(r.failed);
  return r;
};

describe('a branch', () => {
  const parent = bug({ title: 'Epic' });
  const kids = [
    bug({ title: 'One', 'f-parent': parent.id }),
    bug({ title: 'Two', 'f-parent': parent.id, status: 'done' }),
    bug({ title: 'Three', 'f-parent': parent.id }),
  ];
  const items: Item[] = [parent, ...kids];
  const branch = (then: AutomationStep[], conditions = [] as never[]): AutomationStep => ({
    kind: 'for',
    related: { kind: 'children' },
    conditions,
    then: then as never,
  });
  const ctx = (extra = {}) =>
    ctxFor(parent, { items, urlOf: (id: string) => `https://app.test/c/${id}`, ...extra });

  it('plans one patch per related card that matches, with the triggering card’s values', () => {
    const r = done(
      planActions(
        [
          branch(
            [
              { kind: 'flag' },
              {
                kind: 'comment',
                text: '{{trigger.key}} {{trigger.title}} {{trigger.url}} / {{card.title}} {{card.url}}',
              },
            ],
            [{ kind: 'column', statuses: ['todo'] }] as never,
          ),
        ],
        ctx(),
      ),
    );
    expect(r.patch).toEqual({});
    expect(r.related.map((x) => x.card.id)).toEqual([kids[0]!.id, kids[2]!.id]);
    expect(r.related[0]!.patch).toEqual({ set: { flagged: true } });
    expect(r.related[0]!.comments).toEqual([
      `#${parent.key} Epic https://app.test/project/p1?card=x / One https://app.test/c/${kids[0]!.id}`,
    ]);
    expect(r.lines[0]).toEqual({
      kind: 'branch',
      ok: true,
      text: 'For each Child Card: on 3 related cards',
      cards: 3,
    });
    expect(r.lines.map((l) => l.text)).toContain(`#${kids[0]!.key} Flag`);
    expect(r.lines.find((l) => l.kind === 'condition')!.text).toBe(
      `#${kids[1]!.key} Column is To Do (Done)`,
    );
  });

  it('fails a related card alone, keeping its steps before, and names it on the line', () => {
    const r = done(
      planActions([branch([{ kind: 'flag' }, { kind: 'move', status: 'gone' }])], ctx()),
    );
    expect(r.related).toHaveLength(3);
    expect(r.related.every((x) => x.failed === 'Column gone is gone')).toBe(true);
    // What is gone rides with each related card's failure and its line, for the editor's words.
    expect(r.related.every((x) => x.gone?.kind === 'column' && x.gone.id === 'gone')).toBe(true);
    expect(
      r.lines.filter((l) => l.kind === 'action' && !l.ok).map((l) => 'gone' in l && l.gone),
    ).toEqual(r.related.map(() => ({ kind: 'column', id: 'gone' })));
    expect(r.related[0]!.patch).toEqual({ set: { flagged: true } });
    expect(r.lines[0]).toMatchObject({ ok: false, text: expect.stringContaining('failed on #') });
  });

  it('says one card, a capped count, and finds none without the plan’s cards', () => {
    const one = done(
      planActions(
        [
          {
            ...(branch([{ kind: 'flag' }]) as object),
            related: { kind: 'linked', field: 'f-parent' },
          } as never,
        ],
        ctxFor(kids[0]!, { items }),
      ),
    );
    expect(one.lines[0]!.text).toBe('For each Linked Card: on 1 related card');
    const many = Array.from({ length: 105 }, () => bug({ 'f-parent': parent.id }));
    const capped = done(
      planActions([branch([{ kind: 'flag' }])], ctxFor(parent, { items: [parent, ...many] })),
    );
    expect(capped.lines[0]!.text).toBe('For each Child Card: on 100 of 105 related cards');
    expect(capped.related).toHaveLength(100);
    expect(done(planActions([branch([{ kind: 'flag' }])], ctxFor(parent))).related).toEqual([]);
  });

  it('counts its actions once toward the rule’s, and lets an unexpected error through', () => {
    const big = Array.from({ length: 10 }, () => ({ kind: 'flag' as const }));
    const flags = Array.from({ length: 11 }, () => ({ kind: 'flag' as const }));
    const r = planActions([branch(big), ...flags], ctx());
    expect('failed' in r && r.failed).toBe('A run makes up to 20 changes');
    const bad = {
      ...ctx(),
      urlOf: () => {
        throw new TypeError('boom');
      },
    };
    expect(() => planActions([branch([{ kind: 'flag' }])], bad)).toThrow('boom');
  });
});

describe('Assign in Turn', () => {
  const rotate = (ids: string[]): AutomationStep => ({ kind: 'assign', to: { rotate: ids } });

  it('assigns whose turn it is, and says how many turns it took', () => {
    const at = (turn: number) =>
      done(planActions([rotate([SAM.id, ALI.id])], ctxFor(bug(), { turn })));
    expect(at(0).patch.set?.['assignee']).toEqual(SAM);
    expect(at(0).turns).toBe(1);
    expect(at(1).patch.set?.['assignee']).toEqual(ALI);
    expect(at(2).patch.set?.['assignee']).toEqual(SAM);
    expect(at(1).lines[0]!.text).toBe('Assign Ali (in turn)');
    // No turn kept yet: the first.
    expect(
      done(planActions([rotate([ALI.id, SAM.id])], ctxFor(bug()))).patch.set?.['assignee'],
    ).toEqual(ALI);
  });

  it('passes over someone who left, using their turn too', () => {
    const r = done(planActions([rotate(['p-gone', ALI.id])], ctxFor(bug(), { turn: 0 })));
    expect(r.patch.set?.['assignee']).toEqual(ALI);
    expect(r.turns).toBe(2);
  });

  // Spec "Assign in turn": left means gone from the plan's people, which hold everyone a card names. A teammate taken
  // off the team who is still a card's assignee is among them, so their turn is kept (nothing tells them from a
  // share link's Editor).
  it('keeps the turn of someone a card still names', () => {
    const r = done(planActions([rotate([ALI.id, SAM.id])], ctxFor(bug(), { turn: 0 })));
    expect(r.patch.set?.['assignee']).toEqual(ALI);
    expect(r.turns).toBe(1);
  });

  it('carries the run’s turns into a rest planned afresh after an AI step', () => {
    const r = done(
      planActions([rotate([SAM.id, ALI.id])], ctxFor(bug(), { turn: 0 }), {
        carry: { actions: 1, turns: 1, made: 0 },
      }),
    );
    expect(r.patch.set?.['assignee']).toEqual(ALI);
    expect(r.turns).toBe(2);
  });

  it('fails when nobody in turn is left', () => {
    const r = planActions([rotate(['p-x', 'p-y'])], ctxFor(bug()));
    expect('failed' in r && r.failed).toBe('Nobody in turn is in the plan any more');
  });
});

describe('outgoing actions', () => {
  it('plans the message filled in, with its step, its line and its webhook', () => {
    const r = done(
      planActions(
        [
          { kind: 'flag' },
          {
            kind: 'notify',
            via: 'slack',
            webhook: 'wh1',
            name: 'Launch Channel',
            text: 'Shipped {{card.title}}',
          },
          { kind: 'notify', via: 'webhook', webhook: 'wh2', text: 'x' },
        ],
        ctxFor(bug({ title: 'Pricing' })),
      ),
    );
    expect(r.sends).toEqual([
      {
        step: 1,
        via: 'slack',
        webhook: 'wh1',
        name: 'Launch Channel',
        text: 'Shipped Pricing',
        line: 1,
      },
      { step: 2, via: 'webhook', webhook: 'wh2', text: 'x', line: 2 },
    ]);
    expect(r.lines[1]!.text).toBe('Post to Slack Launch Channel');
    expect(r.lines[2]!.text).toBe('Send to Webhook');
  });

  it('reads Automation as the person behind a time trigger or a rule', () => {
    const r = done(
      planActions(
        [{ kind: 'comment', text: 'By {{person}}' }],
        ctxFor(bug(), { by: automationPerson('Nudge'), role: 'system' }),
      ),
    );
    expect(r.comments).toEqual(['By Automation']);
  });
});

describe('a branch’s edges', () => {
  it('lets an unexpected error inside a related card’s step through', () => {
    const parent = bug();
    const kid = bug({ 'f-parent': parent.id });
    const ctx = ctxFor(parent, { items: [parent, kid] });
    const outline = { ...ctx.outline };
    Object.defineProperty(outline, 'statuses', {
      get() {
        throw new TypeError('boom');
      },
    });
    const step: AutomationStep = {
      kind: 'for',
      related: { kind: 'children' },
      conditions: [],
      then: [{ kind: 'move', status: 'done' }],
    };
    expect(() => planActions([step], { ...ctx, outline })).toThrow('boom');
  });
});
