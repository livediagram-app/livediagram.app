import { describe, expect, it } from 'vitest';
import { itemPicksLeft, readItemRule, type ItemRuleBody } from '@liveworkspace/automations/item';
import { DESIGN_TEMPLATES, KINDS, TEMPLATE_CATEGORIES } from './index';

// livedesign's ready-made rules (docs/specs/013-workspace/automations.md "Templates"): the table's ten, each a rule
// the api would save once what it leaves to pick is picked, and leaving exactly that to pick.

const ITEM = {
  tabs: [{ id: 't1', name: 'Logo' }],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
  timeZone: 'Europe/London',
};

// What each template leaves to the person, by template: a connection for each Slack post, nothing else.
const LEFT: Record<string, string[]> = {
  'feedback-slack': ['steps.0:connection'],
  'feedback-done': [],
  'ready-for-build': ['steps.1:connection'],
  'slack-on-change': ['steps.0:connection'],
  'library-updated': ['steps.0:connection'],
  'snapshot-friday': [],
  'weekly-summary': [],
  'agent-edits': [],
  'still-current': [],
  'access-slack': ['steps.0:connection'],
};

const PICKED = { connection: ['webhook', 'c1'] } as const;

function filled(
  body: ItemRuleBody,
  picks: readonly { path: string; pick: string }[],
): ItemRuleBody {
  const copy = structuredClone(body);
  for (const { path, pick } of picks) {
    const step = copy.steps[Number(path.split('.')[1])] as Record<string, unknown>;
    const [field, id] = PICKED[pick as keyof typeof PICKED];
    step[field] = id;
  }
  return copy;
}

describe('the Templates gallery', () => {
  it('holds the spec’s ten, by name', () => {
    expect(DESIGN_TEMPLATES.map((t) => t.name)).toEqual([
      'Feedback to Slack',
      'Feedback Addressed',
      'Ready for Build',
      'Tell Slack When This Changes',
      'Library Updated',
      'Snapshot Every Friday',
      'Weekly Summary by Email',
      'Tell Me When an Agent Edits',
      'Is This Still Current?',
      'Access Requests to Slack',
    ]);
    expect(Object.keys(LEFT).sort()).toEqual(DESIGN_TEMPLATES.map((t) => t.id).sort());
  });

  it.each(DESIGN_TEMPLATES.map((t) => [t.id, t] as const))(
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

  it('hears any main for Library Updated, with the changed one’s name in the post', () => {
    const library = DESIGN_TEMPLATES.find((t) => t.id === 'library-updated')!.build(ITEM);
    expect(library.body.trigger).toEqual({ kind: 'component_changed' });
    expect(JSON.stringify(library.body.steps)).toContain('{{component.name}}');
  });

  it('builds afresh each time, so one opening never changes the next', () => {
    const first = DESIGN_TEMPLATES[0]!.build(ITEM);
    first.picks.length = 0;
    (first.body.steps[0] as Record<string, unknown>)['webhook'] = 'c9';
    const again = DESIGN_TEMPLATES[0]!.build(ITEM);
    expect(again.picks).toHaveLength(1);
    expect(again.body.steps[0]).toMatchObject({ webhook: '' });
  });

  it('puts every template in a category the gallery lists, and leaves no category empty', () => {
    const ids = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    expect(DESIGN_TEMPLATES.every((t) => ids.has(t.category))).toBe(true);
    for (const c of TEMPLATE_CATEGORIES)
      expect(
        DESIGN_TEMPLATES.some((t) => t.category === c.id),
        c.id,
      ).toBe(true);
  });

  it('keeps each id a telemetry type, and each sentence one line', () => {
    for (const t of DESIGN_TEMPLATES) {
      expect(`AutomationTemplate.${t.id}`).toMatch(/^[A-Za-z0-9 ._-]{1,40}$/);
      expect(t.description).toMatch(/^[A-Z].*\.$/);
    }
    expect(new Set(DESIGN_TEMPLATES.map((t) => t.id)).size).toBe(DESIGN_TEMPLATES.length);
  });
});
