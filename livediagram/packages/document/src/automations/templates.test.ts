import { describe, expect, it } from 'vitest';
import { itemPicksLeft, readItemRule, type ItemRuleBody } from '@liveworkspace/automations/item';
import { DOCUMENT_TEMPLATES, KINDS, RETRO_TEMPLATE_ID, TEMPLATE_CATEGORIES } from './index';

// livediagram's ready-made rules (docs/specs/013-workspace/automations.md "Templates"): the table's thirteen, each
// a rule the api would save once what it leaves to pick is picked, and leaving exactly that to pick.

const ITEM = {
  tabs: [{ id: 't1', name: 'Board' }],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
  timeZone: 'Europe/London',
};

// What each template leaves to the person, by template: the spec's "a snapshot, a connection, a template".
const LEFT: Record<string, string[]> = {
  // A step in another app: its target is the person's.
  'session-to-kb': ['steps.1:target'],
  'reset-nightly': ['steps.0:snapshot'],
  'snapshot-friday': [],
  'slack-on-change': ['steps.0:connection'],
  'comments-slack': ['steps.0:connection'],
  'review-finished': [],
  'still-right': [],
  'weekly-summary': [],
  'access-slack': ['steps.0:connection'],
  // The Retrospective template is named, so nothing is left.
  'fresh-retro': [],
  'poll-results-slack': ['steps.0:connection'],
  'questions-slack': ['steps.0:connection'],
  'agent-edits': [],
  'snapshot-release': [],
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

describe('the Templates gallery', () => {
  it('holds the spec’s fourteen, by name', () => {
    expect(DOCUMENT_TEMPLATES.map((t) => t.name)).toEqual([
      'Reset Every Night',
      'Snapshot Every Friday',
      'Tell Slack When This Changes',
      'Session Ended, Summarise into Knowledgebase',
      'Comments to Slack',
      'Review Finished',
      'Is This Still Right?',
      'Weekly Summary by Email',
      'Access Requests to Slack',
      'A Fresh Retro Each Sprint',
      'Poll Results to Slack',
      'Questions to Slack',
      'Tell Me When an Agent Edits',
      'Snapshot Before a Release',
    ]);
    expect(Object.keys(LEFT).sort()).toEqual(DOCUMENT_TEMPLATES.map((t) => t.id).sort());
  });

  it.each(DOCUMENT_TEMPLATES.map((t) => [t.id, t] as const))(
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

  it('builds afresh each time, so one opening never changes the next', () => {
    const first = DOCUMENT_TEMPLATES[0]!.build(ITEM);
    first.picks.length = 0;
    (first.body.steps[0] as Record<string, unknown>)['snapshot'] = 's9';
    const again = DOCUMENT_TEMPLATES[0]!.build(ITEM);
    expect(again.picks).toHaveLength(1);
    expect(again.body.steps[0]).toMatchObject({ snapshot: '' });
  });

  it('puts every template in a category the gallery lists, and leaves no category empty', () => {
    const ids = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    expect(DOCUMENT_TEMPLATES.every((t) => ids.has(t.category))).toBe(true);
    for (const c of TEMPLATE_CATEGORIES)
      expect(
        DOCUMENT_TEMPLATES.some((t) => t.category === c.id),
        c.id,
      ).toBe(true);
  });

  it('keeps each id a telemetry type, and each sentence one line', () => {
    for (const t of DOCUMENT_TEMPLATES) {
      expect(`AutomationTemplate.${t.id}`).toMatch(/^[A-Za-z0-9 ._-]{1,40}$/);
      expect(t.description).toMatch(/^[A-Z].*\.$/);
    }
    expect(new Set(DOCUMENT_TEMPLATES.map((t) => t.id)).size).toBe(DOCUMENT_TEMPLATES.length);
  });

  it('makes A Fresh Retro from the Retrospective template', () => {
    const fresh = DOCUMENT_TEMPLATES.find((t) => t.id === 'fresh-retro')!.build(ITEM);
    expect(fresh.body.steps[0]).toMatchObject({ kind: 'add_tab', template: RETRO_TEMPLATE_ID });
  });
});
