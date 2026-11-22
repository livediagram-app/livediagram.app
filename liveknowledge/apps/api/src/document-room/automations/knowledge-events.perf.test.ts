import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { ANA, DOC, box, roomWorld, type RoomWorld } from './test-automation-world';

// docs/specs/013-workspace/blueprints/automations.md "Cost on the hot paths": a Page Health save (verify, owner,
// Always in Context) and a logged question (report_gap, an agent's empty search, Ask) are the knowledgebase's own
// triggers' call sites. With no rule on, each pays one Set lookup and reads nothing; with a rule on, a save adds the
// queue's insert and a question one indexed SELECT on its key. Timed in CPU time per call through the real room on
// node:sqlite, as the fastest of several rounds. Measured on an M-series Mac under a load average of 6 to 8, per whole
// request: a save 0.82 to 0.93 ms with no rule, 0.67 to 0.75 ms with one queueing on each (within the noise); a
// logged question 0.28 to 0.46 ms with none, 0.29 to 0.35 ms with one. The budget is what a rule may add: 2 ms.

const BASE = `/api/documents/${DOC}`;
const N = 40;

afterEach(() => vi.restoreAllMocks());

async function started(): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create([{ id: 't1', name: 'Deploys', elements: [box('a')] }]);
  return w;
}

// The fastest of 3 rounds of N calls, per call.
async function perCall(call: (i: number) => Promise<unknown>): Promise<number> {
  let best = Infinity;
  for (let r = 0; r < 3; r++)
    best = Math.min(
      best,
      await cpuMsOfAsync(async () => {
        for (let i = 0; i < N; i++) await call(r * N + i);
      }),
    );
  return best / N;
}

const owner = (w: RoomWorld, i: number) =>
  w.send('PUT', `${BASE}/pages/t1/knowledge`, { owner: i % 2 === 0 ? null : ANA });
const gap = (w: RoomWorld, i: number) =>
  w.send('POST', `${BASE}/questions`, { question: `Where is guide number ${i}?` });

describe('the knowledge call sites', () => {
  // Each save moves the owner, so with the rule on every one queues Page Owner Changed.
  it('cost a save and a logged question little, with no rule on and with one', async () => {
    const off = await started();
    const saveOff = await perCall((i) => owner(off, i));
    const askOff = await perCall((i) => gap(off, i));

    const on = await started();
    await on.rule({ trigger: { kind: 'owner_changed' } });
    await on.rule({ trigger: { kind: 'question_unanswered' } });
    const saveOn = await perCall((i) => owner(on, i));
    const askOn = await perCall((i) => gap(on, i + 1000));
    expect(on.queued().length).toBeGreaterThan(3 * N);
    // Whole requests through the room: the budget bounds what a rule adds, generously for CI.
    expect(saveOn).toBeLessThan(saveOff + cpuBudgetMs(2));
    expect(askOn).toBeLessThan(askOff + cpuBudgetMs(2));
  });
});
