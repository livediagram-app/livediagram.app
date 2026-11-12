import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_TEXT_MAX,
  WEBHOOK_BODY_MAX,
  type AutomationStep,
} from '@liveplanner/items';
import type { AutomationSecretResponse } from '@liveplanner/api-schema';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, type AutomationWorld } from './test-automation-world';

// What an Incoming Webhook call costs the plan (docs/specs/026-plan/automations.md "Incoming Webhook"; blueprint
// automations.md "Phase 3", "Tests"): the worst call, a 16 KB body signed and checked, read for a rule whose twenty
// comments each name as many webhook values as 2,000 characters hold, then the wake that fills them on ten cards.
// CPU time, never wall-clock (testing.md).
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

// `{{webhook.k123}}` after `{{webhook.k123}}`, as many as a comment holds.
function valuesText(from: number): { text: string; next: number } {
  let text = '';
  let n = from;
  for (;;) {
    const value = `{{webhook.k${n}}}`;
    if (text.length + value.length > AUTOMATION_TEXT_MAX) return { text, next: n };
    text += value;
    n += 1;
  }
}

describe('an Incoming Webhook call at its limits', () => {
  it('verifies a 16 KB signed body, reads every value its rule names and fills them on 10 cards', async () => {
    const cards = [];
    for (let i = 0; i < 10; i += 1) cards.push(await w.make('A', { title: `Card ${i}` }));
    const steps: AutomationStep[] = [];
    let n = 0;
    for (let i = 0; i < AUTOMATION_ACTIONS_MAX; i += 1) {
      const next = valuesText(n);
      steps.push({ kind: 'comment', text: next.text });
      n = next.next;
    }
    const rule = await w.rule({ name: 'Wide', trigger: { kind: 'incoming_webhook' }, steps });
    const made = await w.call('POST', `/${rule.id}/secret`);
    const { secret } = await made.json<AutomationSecretResponse>();
    // A body as near 16 KB as it goes: as many of the values the rule names as fit (the rest read nothing, and are
    // looked for all the same), then padding.
    const payload: Record<string, unknown> = { cards: cards.map((c) => c.key) };
    let size = JSON.stringify(payload).length;
    for (let k = 0; k < n; k += 1) {
      const entry = `,"k${k}":"v${k}"`.length;
      if (size + entry > WEBHOOK_BODY_MAX - 32) break;
      payload[`k${k}`] = `v${k}`;
      size += entry;
    }
    payload['pad'] = 'x'.repeat(Math.max(0, WEBHOOK_BODY_MAX - size - 12));
    const body = JSON.stringify(payload);
    expect(body.length).toBeLessThanOrEqual(WEBHOOK_BODY_MAX);
    expect(body.length).toBeGreaterThan(WEBHOOK_BODY_MAX - 64);
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

    let status = 0;
    const call = await cpuMsOfAsync(async () => {
      const res = await w.raw(
        new Request(`https://api.test/api/hooks/automations/A/${rule.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Liveplanner-Signature': signature },
          body,
        }),
      );
      status = res.status;
    });
    expect(status).toBe(202);
    const wake = await cpuMsOfAsync(() => w.plans.get('A')!.room.alarm());
    const threads = w.plans.get('A')!.db.prepare('SELECT COUNT(*) AS n FROM card_threads').get();
    expect(threads).toEqual({ n: 10 * AUTOMATION_ACTIONS_MAX });
    // Measured on an M-series Mac: the call 10.5 to 11.5 ms, the wake (10 runs, 200 comments) 79 to 88 ms.
    expect(call).toBeLessThan(cpuBudgetMs(100));
    expect(wake).toBeLessThan(cpuBudgetMs(1000));
  });
});
