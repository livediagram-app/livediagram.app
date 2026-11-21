import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANA, DOC, box, roomWorld, type RoomWorld } from './test-automation-world';

// A knowledgebase's own triggers (docs/specs/013-workspace/automations.md "Triggers of its own"), queued where they
// happen in the knowledgebase's real room: Page Verified and Page Owner Changed from Page Health's routes, Review
// Due from the review check, Unanswered Question from report_gap, and that a verify is never an edit.

const BASE = `/api/documents/${DOC}`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function started(): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create([
    { id: 't1', name: 'Deploys', elements: [box('a')] },
    { id: 't2', name: 'Holidays', elements: [] },
  ]);
  return w;
}

const verify = (w: RoomWorld, tab = 't1') => w.send('POST', `${BASE}/pages/${tab}/verify`);
const kinds = (w: RoomWorld) => w.queued().map((e) => `${e.kind}:${e.tab ?? ''}`);

describe('with no rule on', () => {
  it('queues nothing for a verify, an owner change or a gap', async () => {
    const w = await started();
    expect((await verify(w)).status).toBe(200);
    await w.send('PUT', `${BASE}/pages/t1/knowledge`, { owner: null });
    await w.send('POST', `${BASE}/questions`, { question: 'Where is the VPN guide?' });
    expect(w.rows('SELECT * FROM automation_queue')).toEqual([]);
    expect(w.rows("SELECT * FROM knowledge_email_marks WHERE kind = 'rule-review'")).toEqual([]);
  });
});

describe('Page Verified and Page Owner Changed', () => {
  it('say who verified, and who gave the page an owner, and are no edit', async () => {
    const w = await started();
    await w.rule({ trigger: { kind: 'page_verified' } });
    await w.rule({ trigger: { kind: 'owner_changed' } });
    await w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    expect((await verify(w)).status).toBe(200);
    const [first] = w.queued();
    expect(first).toMatchObject({ kind: 'page_verified', tab: 't1', role: 'editor' });
    expect(first?.by?.id).toBe(ANA);
    // A page made with the knowledgebase has no owner yet: Verify makes its verifier the owner, which is a change.
    expect(kinds(w)).toEqual(['page_verified:t1', 'owner_changed:t1']);
    await w.send('PUT', `${BASE}/pages/t1/knowledge`, { owner: null });
    expect(kinds(w)).toEqual(['page_verified:t1', 'owner_changed:t1', 'owner_changed:t1']);
    // Verified again by its owner-to-be: the owner changes, Verify is heard again.
    await w.send('PUT', `${BASE}/pages/t1/knowledge`, { owner: ANA });
    const before = kinds(w).length;
    // Always in Context moves no owner and verifies nothing.
    await w.send('PUT', `${BASE}/pages/t1/knowledge`, { context: true });
    expect(kinds(w)).toHaveLength(before);
    // None of it is an edit of the writing.
    expect(w.rows('SELECT * FROM automation_edits')).toEqual([]);
  });

  it('names an agent by its token', async () => {
    const w = await started();
    await w.rule({ trigger: { kind: 'owner_changed' } });
    await w.send(
      'PUT',
      `${BASE}/pages/t2/knowledge`,
      { owner: null },
      { token: { name: 'Claude' } },
    );
    await w.send(
      'PUT',
      `${BASE}/pages/t2/knowledge`,
      { owner: ANA },
      { token: { name: 'Claude' } },
    );
    expect(w.queued().at(-1)).toMatchObject({
      kind: 'owner_changed',
      role: 'agent',
      by: { name: 'Claude' },
    });
  });
});

describe('Unanswered Question', () => {
  it('starts once for a group of like questions, the first time it is asked', async () => {
    const w = await started();
    await w.rule({ trigger: { kind: 'question_unanswered' } });
    await w.send('POST', `${BASE}/questions`, { question: 'Where is the VPN guide?' });
    await w.send('POST', `${BASE}/questions`, { question: 'where is the vpn guide' });
    const queued = w.queued().filter((e) => e.kind === 'question_unanswered');
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ data: { question: 'Where is the VPN guide?' } });
    expect(queued[0]?.tab).toBeUndefined();
  });
});

describe('Review Due', () => {
  const DAY = 86_400_000;
  it('marks what is already due on its first look, then starts once per review', async () => {
    const w = await started();
    await verify(w, 't1');
    await verify(w, 't2');
    await w.rule({ trigger: { kind: 'review_due' } });
    // Past both reviews (90 days by default): the first look marks them and starts nothing.
    const later = Date.now() + 91 * DAY;
    vi.useFakeTimers({ now: later, toFake: ['Date'] });
    await w.alarm();
    await w.alarm();
    expect(w.queued().filter((e) => e.kind === 'review_due')).toEqual([]);
    expect(w.runs()).toEqual([]);
    const marks = w.rows(
      "SELECT key FROM knowledge_email_marks WHERE kind = 'rule-review' ORDER BY key",
    );
    expect(marks.map((m) => m['key'])).toEqual(['', 't1', 't2']);
    // Verified again, then due again: told of once.
    vi.useRealTimers();
    vi.useFakeTimers({ now: later + DAY, toFake: ['Date'] });
    await verify(w, 't1');
    vi.setSystemTime(later + 92 * DAY);
    await w.alarm();
    await w.alarm();
    // The first alarm queued it, the second ran it: one run, about t1.
    const runs = w.runs();
    expect(runs).toHaveLength(1);
    expect(JSON.stringify(runs[0])).toContain('t1');
  });
});
