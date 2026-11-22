import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNOWNED_PAGE } from '@liveknowledge/knowledge';
import { ANA, BEN, DOC, box, roomWorld, type RoomWorld } from './test-automation-world';
import { NOT_VERIFIED, NO_OWNER, NO_RUN_PAGE } from './kit-knowledge';

// The knowledge steps run end to end in the knowledgebase's real room (docs/specs/013-workspace/automations.md
// "Steps of its own"): each writes the page's fields as Page Health does, by the rule, and fails in words.

const BASE = `/api/documents/${DOC}`;

afterEach(() => {
  vi.restoreAllMocks();
});

async function started(): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const w = roomWorld();
  // Pages with no owner, as an import's are (verification.md "The owner"): each test gives the owner it needs.
  await w.create([
    { id: 't1', name: 'Deploys', elements: [box('a')], knowledge: UNOWNED_PAGE },
    { id: 't2', name: 'Holidays', elements: [], knowledge: UNOWNED_PAGE },
  ]);
  return w;
}

async function runOn(
  w: RoomWorld,
  steps: ({ kind: string } & Record<string, unknown>)[],
  tab?: string,
) {
  const rule = await w.rule({ trigger: { kind: 'manual' }, steps });
  const res = await w.send('POST', `${BASE}/automations/${rule.id}/run`, tab ? { tab } : {});
  const { run } = await res.json<{ run: { result: string; steps: { text: string }[] } }>();
  // The first line says what started it; the rest, each step.
  return { result: run.result, said: run.steps.slice(1).map((s) => s.text) };
}

const fields = (w: RoomWorld, tab: string): Record<string, unknown> => {
  const data = JSON.parse(
    String(w.rows('SELECT data FROM tabs WHERE id = ?', tab)[0]?.['data']),
  ) as {
    knowledge?: Record<string, unknown>;
  };
  return data.knowledge ?? {};
};

describe('Set the Page Owner', () => {
  it('makes the knowledgebase’s owner, or whoever pressed Run Rule, the page’s owner', async () => {
    const w = await started();
    expect(await runOn(w, [{ kind: 'set_owner', tab: 't1', to: { person: ANA } }])).toMatchObject({
      result: 'done',
      said: [expect.stringContaining('the owner of Deploys')],
    });
    expect(fields(w, 't1')).toEqual({ owner: ANA });
    await runOn(w, [{ kind: 'set_owner', tab: 'run', to: { trigger: true } }], 't2');
    expect(fields(w, 't2')).toEqual({ owner: ANA });
  });

  it('refuses someone who cannot open the knowledgebase, and a run with no page', async () => {
    const w = await started();
    const ben = await runOn(w, [{ kind: 'set_owner', tab: 't1', to: { person: BEN } }]);
    expect(ben.result).toBe('failed');
    expect(ben.said.at(-1)).toContain("can't open this knowledgebase");
    expect(fields(w, 't1')).toEqual({});
    const none = await runOn(w, [{ kind: 'set_owner', tab: 'run', to: { trigger: true } }]);
    expect(none.said.at(-1)).toBe(NO_RUN_PAGE);
  });
});

describe('Clear Verification and Always in Context', () => {
  it('clears a verification and keeps the owner; says when there was none', async () => {
    const w = await started();
    await w.send('POST', `${BASE}/pages/t1/verify`);
    expect(fields(w, 't1')).toMatchObject({ verifiedBy: ANA });
    await runOn(w, [{ kind: 'clear_verification', tab: 't1' }]);
    expect(fields(w, 't1')).toEqual({ owner: ANA });
    const again = await runOn(w, [{ kind: 'clear_verification', tab: 't1' }]);
    expect(again).toMatchObject({ result: 'failed', said: [NOT_VERIFIED] });
  });

  it('adds a page to Always in Context and takes it out', async () => {
    const w = await started();
    await runOn(w, [{ kind: 'context', tab: 't1', on: true }]);
    expect(fields(w, 't1')).toEqual({ context: true });
    await runOn(w, [{ kind: 'context', tab: 't1', on: true }]);
    expect(fields(w, 't1')).toEqual({ context: true });
    const out = await runOn(w, [{ kind: 'context', tab: 't1', on: false }]);
    expect(out.said).toEqual(['Removed Deploys from Always in Context']);
    expect(fields(w, 't1')).toEqual({});
  });
});

describe('Email the Page Owner and {{page.owner}}', () => {
  it('needs email, a page and an owner', async () => {
    const w = await started();
    const email = [{ kind: 'email_owner', subject: 'Hi', body: 'There' }];
    expect((await runOn(w, email, 't1')).said).toEqual(["Email isn't set up here"]);
    expect((await runOn(w, email)).said).toEqual([NO_RUN_PAGE]);
    void NO_OWNER;
  });

  it('reads the run’s page’s owner, or Nobody', async () => {
    const w = await started();
    const named = await runOn(
      w,
      [{ kind: 'take_snapshot', name: 'Owned by {{page.owner}}' }],
      't1',
    );
    expect(named.said.join(' ')).toContain('Owned by Nobody');
    await w.send('PUT', `${BASE}/pages/t1/knowledge`, { owner: ANA });
    const owned = await runOn(
      w,
      [{ kind: 'take_snapshot', name: 'Owned by {{page.owner}}' }],
      't1',
    );
    expect(owned.said.join(' ')).toMatch(/Owned by (Someone|Ana)/);
  });
});
