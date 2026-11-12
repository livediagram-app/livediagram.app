import { describe, expect, it } from 'vitest';
import { planActions, type PlannedRun } from './plan-actions';
import { automationPerson, type AutomationAction, type AutomationStep } from './types';
import { ALI, OUTLINE, SAM, bug, ctxFor } from './test-fixtures';
import type { Item } from '../item';

// docs/specs/026-plan/automations.md "Actions"; blueprint "The run" (one patch per card, Already so).
const run = (steps: AutomationStep[], card: Item = bug(), extra = {}) =>
  planActions(steps, ctxFor(card, extra));
const done = (r: PlannedRun) => {
  if ('failed' in r) throw new Error(r.failed);
  return r;
};
const failed = (r: PlannedRun) => ('failed' in r ? r.failed : null);
const one = (a: AutomationAction, card?: Item, extra = {}) => run([a], card, extra);

describe('one patch for the card', () => {
  it('folds every step into one patch, in order, a later step undoing an earlier', () => {
    const r = done(
      run([
        { kind: 'move', status: 'done' },
        { kind: 'add_label', label: 'shipped' },
        { kind: 'flag' },
        { kind: 'set_field', field: 'priority', value: { text: 'High' } },
        { kind: 'unflag' },
        { kind: 'clear_field', field: 'due' },
        { kind: 'set_field', field: 'due', value: { date: { today: 2 } } },
      ]),
    );
    expect(r.patch).toEqual({
      set: { status: 'done', labels: ['shipped'], priority: 'high', due: '2026-11-13' },
    });
    expect(r.lines.map((l) => l.text)).toEqual([
      'Move to Done',
      'Add Label shipped',
      'Flag',
      'Set Priority to High',
      'Unflag',
      'Clear Deadline',
      'Set Deadline to 13 Nov 2026',
    ]);
  });

  it('marks a step that changes nothing Already so, and keeps it out of the patch', () => {
    const card = bug({ labels: ['a'], status: 'done', flagged: true });
    const r = done(
      run(
        [
          { kind: 'move', status: 'done' },
          { kind: 'add_label', label: 'a' },
          { kind: 'remove_label', label: 'z' },
          { kind: 'flag' },
          { kind: 'clear_field', field: 'due' },
          { kind: 'assign', to: { nobody: true } },
        ],
        card,
      ),
    );
    expect(r.patch).toEqual({});
    expect(r.lines.every((l) => l.kind === 'action' && l.already)).toBe(true);
  });

  it('clears what a step empties, and sets it again when a later one fills it', () => {
    const card = bug({ labels: ['a'], assignee: SAM, archived: false });
    const r = done(
      run(
        [
          { kind: 'remove_label', label: 'a' },
          { kind: 'assign', to: { nobody: true } },
          { kind: 'assign', to: { person: 'p-ali' } },
          { kind: 'archive' },
        ],
        card,
      ),
    );
    expect(r.patch).toEqual({ set: { assignee: ALI, archived: true }, clear: ['labels'] });
    expect(r.lines.map((l) => l.text)).toEqual([
      'Remove Label a',
      'Unassign',
      'Assign Ali',
      'Archive',
    ]);
  });
});

describe('Set Field', () => {
  it('fills values and reads them as the field takes them', () => {
    const r = done(
      run(
        [
          { kind: 'set_field', field: 'title', value: { text: '{{card.title}} ({{card.key}})' } },
          { kind: 'set_field', field: 'f-when', value: { text: '{{now + 1d}}' } },
          { kind: 'set_field', field: 'f-points', value: { text: ' 8 ' } },
          { kind: 'set_field', field: 'f-tags', value: { text: 'a' } },
          { kind: 'set_field', field: 'f-owner', value: { text: 'sam lee' } },
          { kind: 'set_field', field: 'estimate', value: { number: 5 } },
          { kind: 'set_field', field: 'labels', value: { list: ['x', 'y'] } },
          { kind: 'set_field', field: 'f-parent', value: { from: 'f-parent' } },
          { kind: 'set_field', field: 'f-x', value: { from: 'title' } },
          { kind: 'set_field', field: 'assignee', value: { text: 'p-ali' } },
          { kind: 'set_field', field: 'f-y', value: { text: 'plain' } },
        ],
        bug({}, { key: 7 }),
      ),
    );
    expect(r.patch.set).toMatchObject({
      title: 'Login fails (#7)',
      'f-when': '2026-11-12',
      'f-points': 8,
      'f-tags': ['a'],
      'f-owner': SAM,
      estimate: 5,
      labels: ['x', 'y'],
      'f-x': 'Login fails (#7)',
      assignee: ALI,
      'f-y': 'plain',
    });
    expect(r.lines.at(-4)).toEqual({
      kind: 'action',
      ok: true,
      text: 'Clear Parent Bug',
      already: true,
    });
  });

  it('clears the field when the filled text is empty', () => {
    const r = done(
      one(
        { kind: 'set_field', field: 'f-points', value: { text: '{{card.assignee}}' } },
        bug({ 'f-points': 2 }),
      ),
    );
    expect(r.patch).toEqual({ clear: ['f-points'] });
  });

  it.each([
    [
      { kind: 'set_field', field: 'due', value: { text: 'soon' } },
      'Deadline needs a day, not "soon"',
    ],
    [
      { kind: 'set_field', field: 'f-points', value: { text: 'many' } },
      'Points needs a number, not "many"',
    ],
    [{ kind: 'set_field', field: 'priority', value: { text: 'Meh' } }, 'Priority has no "Meh"'],
    [
      { kind: 'set_field', field: 'f-owner', value: { text: 'Zed' } },
      'Nobody called "Zed" can be set',
    ],
    [
      { kind: 'set_field', field: 'f-calc', value: { number: 1 } },
      'Score is worked out, never set',
    ],
    [
      { kind: 'set_field', field: 'estimate', value: { text: '-5' } },
      "Estimate can't hold that value",
    ],
    [{ kind: 'clear_field', field: 'f-severity' }, 'Bug cards need Severity'],
  ] as [AutomationAction, string][])('fails a value the field refuses: %o', (action, reason) => {
    expect(failed(one(action))).toBe(reason);
  });

  it('clears a required field that is already empty without a fuss', () => {
    expect(
      done(one({ kind: 'clear_field', field: 'f-severity' }, bug({ 'f-severity': undefined })))
        .patch,
    ).toEqual({});
  });
});

describe('Move, Assign, Labels', () => {
  it('fails a move to a column the type leaves out, or one that is gone', () => {
    const note = { ...bug(), type: 'note' };
    expect(failed(one({ kind: 'move', status: 'done' }, note))).toBe(
      "A Note card can't go in Done",
    );
    expect(failed(one({ kind: 'move', status: 'qa' }))).toBe('Column qa is gone');
  });

  it('assigns whoever triggered it, unless no person did', () => {
    expect(done(one({ kind: 'assign', to: { trigger: true } }, bug(), { by: ALI })).patch).toEqual({
      set: { assignee: ALI },
    });
    expect(failed(one({ kind: 'assign', to: { trigger: true } }, bug(), { role: 'system' }))).toBe(
      'Nobody to assign: no person made the change',
    );
    expect(
      failed(one({ kind: 'assign', to: { trigger: true } }, bug(), { by: automationPerson('r') })),
    ).toBe('Nobody to assign: no person made the change');
    expect(
      failed(one({ kind: 'assign', to: { trigger: true } }, bug(), { role: 'automation' })),
    ).not.toBeNull();
    expect(failed(one({ kind: 'assign', to: { person: 'p-gone' } }))).toBe('That person is gone');
  });

  it('fails a label past the card’s limit', () => {
    const full = bug({ labels: Array.from({ length: 12 }, (_, i) => `l${i}`) });
    expect(failed(one({ kind: 'add_label', label: 'more' }, full))).toBe(
      'A card holds up to 12 labels',
    );
  });
});

describe('Comments, emails and Create Card', () => {
  it('gathers comments and emails, filled in from the card as the steps left it', () => {
    const r = done(
      run(
        [
          { kind: 'assign', to: { person: 'p-ali' } },
          { kind: 'comment', text: 'Over to {{card.assignee}}' },
          {
            kind: 'email',
            to: { assignee: true },
            subject: '{{card.key}} is yours',
            body: '{{card.title}}',
          },
          { kind: 'email', to: { trigger: true }, subject: 's', body: 'x'.repeat(2100) },
          { kind: 'email', to: { person: 'p-gone' }, subject: 's', body: 'b' },
          { kind: 'assign', to: { nobody: true } },
          { kind: 'email', to: { assignee: true }, subject: 's', body: 'b' },
        ],
        bug({}, { key: 4 }),
      ),
    );
    expect(r.comments).toEqual(['Over to Ali']);
    expect(r.emails[0]).toEqual({ to: ALI, subject: '#4 is yours', body: 'Login fails' });
    expect(r.emails[1]!.to).toEqual(SAM);
    expect(r.emails[1]!.body).toHaveLength(2000);
    expect(r.emails[2]!.to).toBeNull();
    expect(r.emails[3]!.to).toBeNull();
    expect(r.lines.slice(2, 5).map((l) => l.text)).toEqual([
      'Send Email to Ali',
      'Send Email to Sam Lee',
      'Send Email (nobody to send it to)',
    ]);
  });

  it('plans one card, copying what it asks and linking back through a Card field', () => {
    const card = bug({ labels: ['a'], assignee: SAM }, { id: 'c1' });
    const r = done(
      run(
        [
          {
            kind: 'create_card',
            type: 'bug',
            title: 'Follow up {{card.key}}',
            status: 'todo',
            copy: ['labels', 'assignee', 'due'],
            linkField: 'f-parent',
          },
        ],
        card,
      ),
    );
    expect(r.created).toEqual([
      {
        type: 'bug',
        status: 'todo',
        fields: { title: `Follow up #${card.key}`, labels: ['a'], assignee: SAM, 'f-parent': 'c1' },
      },
    ]);
    expect(r.lines[0]!.text).toBe(`Create Bug "Follow up #${card.key}"`);
    const notes = done(
      run(
        [{ kind: 'create_card', type: 'note', title: '{{card.assignee}}', linkField: 'f-links' }],
        card,
      ),
    );
    expect(notes.created[0]).toEqual({
      type: 'note',
      fields: { title: 'Sam Lee', 'f-links': ['c1'] },
    });
    const untitled = done(
      run([{ kind: 'create_card', type: 'note', title: '{{card.due}}' }], card),
    );
    expect(untitled.created[0]!.fields['title']).toBe('New note');
  });

  it.each([
    [{ kind: 'create_card', type: 'epic', title: 't' }, 'Card type epic is gone'],
    [{ kind: 'create_card', type: 'bug', title: 't', status: 'qa' }, 'Column qa is gone'],
    [
      { kind: 'create_card', type: 'note', title: 't', linkField: 'f-nope' },
      'A Note card has no Card field f-nope',
    ],
  ] as [AutomationAction, string][])('fails a card it cannot make: %o', (action, reason) => {
    expect(failed(one(action))).toBe(reason);
  });

  it('makes at most one card a run', () => {
    const make: AutomationAction = { kind: 'create_card', type: 'note', title: 't' };
    expect(failed(run([make, make]))).toBe('A run makes up to 1 card');
  });
});

describe('If / Else, failing and the action limit', () => {
  it('takes Then when its conditions hold against the card so far, else Else, with their lines', () => {
    const steps: AutomationStep[] = [
      { kind: 'move', status: 'done' },
      {
        kind: 'if',
        conditions: [{ kind: 'column', statuses: ['done'] }],
        then: [{ kind: 'flag' }],
        else: [{ kind: 'add_label', label: 'open' }],
      },
    ];
    const r = done(run(steps));
    expect(r.patch.set).toEqual({ status: 'done', flagged: true });
    expect(r.lines[1]).toEqual({ kind: 'condition', ok: true, text: 'Column is Done (Done)' });
    const other = done(run([steps[1]!]));
    expect(other.patch.set).toEqual({ labels: ['open'] });
  });

  it('stops at the failed step, keeping the lines before it', () => {
    const r = run([{ kind: 'flag' }, { kind: 'move', status: 'qa' }, { kind: 'unflag' }]);
    expect(r).toEqual({
      failed: 'Column qa is gone',
      lines: [
        { kind: 'action', ok: true, text: 'Flag' },
        { kind: 'action', ok: false, text: 'Column qa is gone' },
      ],
      // The Flag before it stays done; the Unflag after it never ran.
      done: {
        patch: { set: { flagged: true } },
        comments: [],
        created: [],
        emails: [],
        mentions: [],
        related: [],
        resolve: false,
        sends: [],
        turns: 0,
      },
    });
  });

  it('stops past the most actions a run makes', () => {
    const steps = Array.from({ length: 21 }, (): AutomationAction => ({ kind: 'flag' }));
    expect(failed(run(steps))).toBe('A run makes up to 20 changes');
  });

  it('lets an unexpected error through to the caller', () => {
    const outline = { ...OUTLINE };
    Object.defineProperty(outline, 'statuses', {
      get() {
        throw new TypeError('boom');
      },
    });
    expect(() =>
      planActions([{ kind: 'move', status: 'done' }], ctxFor(bug(), { outline })),
    ).toThrow('boom');
  });
});
