import { describe, expect, it } from 'vitest';
import {
  itemPicksLeft,
  readItemRule,
  ruleLeftToPick,
  type ItemRuleBody,
} from '@liveworkspace/automations/item';
import { DOCUMENT_TEMPLATES, KINDS, TEMPLATE_CATEGORIES } from './index';

// livedocuments' ready-made rules (docs/specs/013-workspace/automations.md "Templates"): the table's eleven, each a
// rule the api would save once what it leaves to pick is picked, and leaving exactly that to pick.

const ITEM = {
  tabs: [{ id: 't1', name: 'Letter' }],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
  timeZone: 'Europe/London',
};

// What each template leaves to the person, by template: the spec's "(pick a tab)", "(pick a tab and a version)"
// and a connection for each Slack post. The version is this app's own reference, asked for by its panel.
const LEFT: Record<string, string[]> = {
  'version-friday': ['steps.0:tab'],
  'email-on-change': [],
  'still-right': [],
  'comments-slack': ['steps.0:connection'],
  'signed-off': [],
  'weekly-summary': [],
  'announce-version': ['steps.0:connection'],
  'agent-writes': [],
  'snapshot-monthly': [],
  'reset-letter': ['steps.0:tab'],
  'access-slack': ['steps.0:connection'],
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
    const [field, id] = PICKED[pick as keyof typeof PICKED];
    step[field] = id;
    if (step['kind'] === 'restore_version') step['version'] = 'v1';
  }
  return copy;
}

describe('the Templates gallery', () => {
  it('holds the spec’s eleven, by name', () => {
    expect(DOCUMENT_TEMPLATES.map((t) => t.name)).toEqual([
      'Name a Version Every Friday',
      'Tell Me When This Changes',
      'Time for a Review',
      'Comments to Slack',
      'Signed Off',
      'Weekly Summary by Email',
      'Announce a New Version',
      'Tell Me When an Agent Writes',
      'Snapshot Every Month',
      'Reset a Form Letter Each Night',
      'Access Requests to Slack',
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

  it('holds Reset a Form Letter off until its version is picked too', () => {
    const reset = DOCUMENT_TEMPLATES.find((t) => t.id === 'reset-letter')!.build(ITEM);
    const tabOnly = structuredClone(reset.body);
    (tabOnly.steps[0] as Record<string, unknown>)['tab'] = 't1';
    expect(readItemRule(tabOnly, KINDS)).toMatchObject({ path: 'steps.0.version' });
    expect(ruleLeftToPick(tabOnly, KINDS)).toBe(true);
  });

  it('names a version of the run’s tab when a review is signed off', () => {
    const signed = DOCUMENT_TEMPLATES.find((t) => t.id === 'signed-off')!.build(ITEM);
    expect(KINDS.trigger('threads_resolved')?.tabbed).toBe(true);
    expect(signed.body.steps[0]).toEqual({
      kind: 'name_version',
      tab: 'run',
      name: 'Reviewed {{now.date}}',
    });
  });

  it('builds afresh each time, so one opening never changes the next', () => {
    const first = DOCUMENT_TEMPLATES[0]!.build(ITEM);
    first.picks.length = 0;
    (first.body.steps[0] as Record<string, unknown>)['tab'] = 't9';
    const again = DOCUMENT_TEMPLATES[0]!.build(ITEM);
    expect(again.picks).toHaveLength(1);
    expect(again.body.steps[0]).toMatchObject({ tab: '' });
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
