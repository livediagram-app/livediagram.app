import { describe, expect, it } from 'vitest';
import { itemPicksLeft, readItemRule, type ItemRuleBody } from '@liveworkspace/automations/item';
import { DOCUMENT_TEMPLATES, KINDS, TEMPLATE_CATEGORIES } from './index';

// liveknowledge's ready-made rules (docs/specs/013-workspace/automations.md "Templates"): the table's thirteen,
// each a rule the api would save once what it leaves to pick is picked, and leaving exactly that to pick.

const ITEM = {
  tabs: [{ id: 't1', name: 'Letter' }],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
  timeZone: 'Europe/London',
};

// What each template leaves to the person, by template: a connection for each Slack post.
const LEFT: Record<string, string[]> = {
  // A step in another app: its target is the person's.
  'review-card': ['steps.0:target'],
  'review-slack': ['steps.0:connection'],
  'agent-check': [],
  'agent-owner': [],
  'restored-unverify': [],
  'verified-version': [],
  'questions-slack': ['steps.0:connection'],
  'disagree-slack': ['steps.0:connection'],
  'suggestion-owner': [],
  'verified-slack': ['steps.0:connection'],
  'comments-slack': ['steps.0:connection'],
  'access-slack': ['steps.0:connection'],
  'weekly-summary': [],
  'snapshot-monthly': [],
};

// What a person picks, at a step: a tab, a connection; and Restore a Version's version once its tab is picked.
const PICKED = { tab: ['tab', 't1'], connection: ['webhook', 'c1'] } as const;

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
    if (step['kind'] === 'restore_version') step['version'] = 'v1';
  }
  return copy;
}

describe('the Templates gallery', () => {
  it('holds the spec’s fourteen, by name', () => {
    expect(DOCUMENT_TEMPLATES.map((t) => t.name)).toEqual([
      'Review Due to Slack',
      'Review Due, Add a Card for the Owner',
      'Ask the Owner to Check an Agent’s Edit',
      'Agents’ New Pages Get an Owner',
      'A Restored Page Needs Verifying Again',
      'Name a Version When Verified',
      'Unanswered Questions to Slack',
      'Pages That Disagree to Slack',
      'Tell the Owner About a Suggested Edit',
      'Announce Verified Pages',
      'Comments to Slack',
      'Access Requests to Slack',
      'Weekly Summary by Email',
      'Snapshot Every Month',
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

  it('keeps Agents’ New Pages Get an Owner to an agent’s pages, owned by its person', () => {
    const { body } = DOCUMENT_TEMPLATES.find((t) => t.id === 'agent-owner')!.build(ITEM);
    expect(body.trigger).toEqual({ kind: 'tab_added' });
    expect(body.conditions).toEqual([{ kind: 'who', who: [{ role: 'agent' }] }]);
    expect(body.steps[0]).toEqual({ kind: 'set_owner', tab: 'run', to: { trigger: true } });
  });

  it('works on the run’s page wherever the trigger is about one', () => {
    for (const id of ['restored-unverify', 'verified-version', 'agent-owner']) {
      const { body } = DOCUMENT_TEMPLATES.find((t) => t.id === id)!.build(ITEM);
      expect(KINDS.trigger(body.trigger.kind)?.tabbed, id).toBe(true);
      expect(body.steps[0]).toMatchObject({ tab: 'run' });
    }
  });

  it('builds afresh each time, so one opening never changes the next', () => {
    const first = DOCUMENT_TEMPLATES[0]!.build(ITEM);
    first.picks.length = 0;
    (first.body.steps[0] as Record<string, unknown>)['text'] = 'changed';
    const again = DOCUMENT_TEMPLATES[0]!.build(ITEM);
    expect(again.picks).toHaveLength(1);
    expect(again.body.steps[0]).not.toMatchObject({ text: 'changed' });
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
});
