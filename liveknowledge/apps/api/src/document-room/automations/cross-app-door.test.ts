import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNOWNED_PAGE } from '@liveknowledge/knowledge';
import type { AutomationStepDoorCall } from '@liveworkspace/index-client';
import type { DocumentGrant } from '../../index-service';
import { ANA, DOC, box, identityOf, roomWorld, type RoomWorld } from './test-automation-world';

// Write a Page in a Knowledgebase, a rule's step from another app (docs/specs/013-workspace/automations.md "Steps in
// other apps"): the page is made through the knowledgebase's own route as the author, stamped Written by a Rule
// with the rule and where it lives, owned by the author and never verified.

afterEach(() => {
  vi.restoreAllMocks();
});

async function started(): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create([{ id: 't1', name: 'Deploys', elements: [box('a')], knowledge: UNOWNED_PAGE }]);
  return w;
}

const grant = (level = 'edit') => identityOf({ level: level as never }).grant as DocumentGrant;
const call = (over: Record<string, unknown> = {}): AutomationStepDoorCall => ({
  author: ANA,
  rule: { id: 'r1', name: 'Release Note', app: 'liveplanner', item: 'p1' },
  from: { title: 'Launch', url: 'https://liveplanner.app/plan/p1' },
  chain: { id: 'c1', hops: 1, rules: ['liveplanner:p1:r1'] },
  step: {
    kind: 'kb_page',
    target: { app: 'liveknowledge', item: DOC, title: 'Handbook' },
    title: 'Search shipped',
    body: '# Search\n\nIt shipped.',
    ...over,
  },
});

const pageData = (w: RoomWorld, name: string) => {
  const row = w.rows('SELECT data FROM tabs WHERE name = ?', name)[0];
  return row ? (JSON.parse(String(row['data'])) as { knowledge?: Record<string, unknown> }) : null;
};

describe('Write a Page in a Knowledgebase', () => {
  it('writes the page as the author, by the rule, owned by them and never verified', async () => {
    const w = await started();
    expect(await w.room.automationStep(DOC, call(), grant())).toMatchObject({
      ok: true,
      text: 'Wrote “Search shipped” in “Handbook”',
    });
    const knowledge = pageData(w, 'Search shipped')?.knowledge ?? {};
    expect(knowledge['owner']).toBe(ANA);
    expect(knowledge['verifiedAt'] ?? null).toBeNull();
    const [tab] = w.rows('SELECT id FROM tabs WHERE name = ?', 'Search shipped');
    expect(
      w.rows(
        'SELECT created_by, created_agent, created_via FROM page_authors WHERE tab = ?',
        String(tab!['id']),
      ),
    ).toEqual([
      { created_by: ANA, created_agent: 'Release Note in Launch', created_via: 'automation' },
    ]);
    const { pages } = await w.room.automationTarget(DOC);
    expect(pages?.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Deploys', 'Search shipped']),
    );
  });

  it('answers no access for a grant that may not write, a parent gone, and a step it does not take', async () => {
    const w = await started();
    expect(await w.room.automationStep(DOC, call(), grant('view'))).toMatchObject({
      ok: false,
      code: 'no_access',
    });
    expect(await w.room.automationStep(DOC, call({ parent: 'gone' }), grant())).toMatchObject({
      ok: false,
    });
    expect(
      await w.room.automationStep(
        DOC,
        { ...call(), step: { kind: 'space_post' } } as never,
        grant(),
      ),
    ).toMatchObject({ ok: false, code: 'invalid' });
  });
});
