import { describe, expect, it } from 'vitest';
import { itemPicksLeft, readItemRule, type ItemRuleBody } from '@liveworkspace/automations/item';
import { KINDS, SPACE_TEMPLATES, TEMPLATE_CATEGORIES } from './index';

// livehuddle's ready-made rules (docs/specs/013-workspace/automations.md "Templates"): the table's ten, each a rule
// the api would save once what it leaves to pick is picked, and leaving exactly that to pick.

const ITEM = {
  tabs: [{ id: 't1', name: 'Meeting Room' }],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
  timeZone: 'Europe/London',
};

// What each template leaves to the person, by template: the spec's "(pick one)" snapshot, and a connection for
// each Slack post.
const LEFT: Record<string, string[]> = {
  // A step in another app: its target is the person's.
  'actions-to-plan': ['steps.1:target'],
  'reset-nightly': ['steps.0:snapshot'],
  'tidy-up': ['steps.0:snapshot'],
  'office-open': ['steps.0:connection'],
  'standup-soon': ['steps.0:connection'],
  'meeting-wrap': [],
  'suggestions-slack': ['steps.0:connection'],
  'empty-box': [],
  'visitor-joined': [],
  'snapshot-friday': [],
  'access-slack': ['steps.0:connection'],
};

// What a person picks, at a step: a snapshot, a connection.
const PICKED = { snapshot: ['snapshot', 's1'], connection: ['webhook', 'c1'] } as const;

function filled(
  body: ItemRuleBody,
  picks: readonly { path: string; pick: string }[],
): ItemRuleBody {
  const copy = structuredClone(body);
  for (const { path, pick } of picks) {
    const step = copy.steps[Number(path.split('.')[1])] as Record<string, unknown>;
    if (pick === 'target') {
      // The target picked, and what the step then picks from it (a board, a column).
      step['target'] = { ...(step['target'] as object), item: 'x1', title: 'Picked' };
      if ('board' in step) Object.assign(step, { board: 'b1', column: 'To Do' });
      continue;
    }
    const [field, id] = PICKED[pick as keyof typeof PICKED];
    step[field] = id;
  }
  return copy;
}

const byId = (id: string) => SPACE_TEMPLATES.find((t) => t.id === id)!.build(ITEM);

describe('the Templates gallery', () => {
  it('holds the spec’s eleven, by name, the nightly reset first', () => {
    expect(SPACE_TEMPLATES.map((t) => t.name)).toEqual([
      'Reset Every Night',
      'Tidy Up When Everyone Leaves',
      'The Office Is Open',
      'Stand-Up in Fifteen',
      'Meeting Ended, Send Actions to Plan',
      'Meeting Wrap-Up',
      'Suggestions to Slack',
      'Empty the Suggestion Box Weekly',
      'A Visitor Arrived',
      'Snapshot Every Friday',
      'Access Requests to Slack',
    ]);
    expect(Object.keys(LEFT).sort()).toEqual(SPACE_TEMPLATES.map((t) => t.id).sort());
  });

  it.each(SPACE_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s reads as the api reads it once picked, and leaves exactly its picks',
    (id, template) => {
      const { body, picks } = template.build(ITEM);
      expect(body.name).toBe(template.name);
      expect(body.timeZone).toBe('Europe/London');
      expect(itemPicksLeft(body, picks).map((p) => `${p.path}:${p.pick}`)).toEqual(LEFT[id]);
      const read = readItemRule(filled(body, picks), KINDS);
      expect(read, JSON.stringify(read)).toHaveProperty('body');
      expect(itemPicksLeft(filled(body, picks), picks)).toEqual([]);
    },
  );

  it('puts a room back once it has emptied, and says the office is open once', () => {
    expect(byId('tidy-up').body.trigger).toEqual({ kind: 'everyone_left', minutes: 10 });
    expect(byId('office-open').body.trigger).toEqual({ kind: 'someone_arrived', empty: true });
    expect(byId('meeting-wrap').body.steps[0]).toMatchObject({
      kind: 'email',
      to: { owner: true },
      body: expect.stringContaining('{{visit.people}}'),
    });
    expect(byId('empty-box').body.steps).toEqual([{ kind: 'clear_suggestions' }]);
  });

  it('builds afresh each time, so one opening never changes the next', () => {
    const first = SPACE_TEMPLATES[0]!.build(ITEM);
    first.picks.length = 0;
    (first.body.steps[0] as Record<string, unknown>)['snapshot'] = 's9';
    const again = SPACE_TEMPLATES[0]!.build(ITEM);
    expect(again.picks).toHaveLength(1);
    expect(again.body.steps[0]).toMatchObject({ snapshot: '' });
  });

  it('puts every template in a category the gallery lists, and leaves no category empty', () => {
    const ids = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    expect(SPACE_TEMPLATES.every((t) => ids.has(t.category))).toBe(true);
    for (const c of TEMPLATE_CATEGORIES)
      expect(
        SPACE_TEMPLATES.some((t) => t.category === c.id),
        c.id,
      ).toBe(true);
  });

  it('keeps each id a telemetry type, and each sentence one line', () => {
    for (const t of SPACE_TEMPLATES) {
      expect(`AutomationTemplate.${t.id}`).toMatch(/^[A-Za-z0-9 ._-]{1,40}$/);
      expect(t.description).toMatch(/^[A-Z].*\.$/);
    }
    expect(new Set(SPACE_TEMPLATES.map((t) => t.id)).size).toBe(SPACE_TEMPLATES.length);
  });
});
