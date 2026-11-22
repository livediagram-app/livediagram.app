import { describe, expect, it } from 'vitest';
import {
  automationStepDoorPath,
  automationTargetDoorPath,
  CROSS_APP_CHAIN_RULES_MAX,
  CROSS_APP_HOPS_MAX,
  CROSS_APP_KIND_APPS,
  isCrossAppKind,
  isCrossAppRefusal,
  ruleKeyOf,
  type AutomationStepPush,
} from './automation-steps';
import { createIndexAppClient, createIndexClient } from './client';

describe('steps in other apps: the wire', () => {
  it('names a rule across apps, and the kinds and refusals it knows', () => {
    expect(ruleKeyOf('liveplanner', 'p1', 'r1')).toBe('liveplanner:p1:r1');
    expect(isCrossAppKind('kb_page')).toBe(true);
    expect(isCrossAppKind('notify')).toBe(false);
    expect(isCrossAppKind(3)).toBe(false);
    expect(isCrossAppRefusal('no_access')).toBe(true);
    expect(isCrossAppRefusal('nope')).toBe(false);
    expect(CROSS_APP_CHAIN_RULES_MAX).toBe(CROSS_APP_HOPS_MAX + 1);
    expect(CROSS_APP_KIND_APPS.doc_tab).toEqual(['livedocuments', 'livediagram']);
    expect(automationStepDoorPath('a b')).toBe('/api/internal/items/a%20b/automation-step');
    expect(automationTargetDoorPath('k1')).toBe('/api/internal/items/k1/automation-target');
  });

  it('pushes a step as the app, and reads a target as the person', async () => {
    const seen: { url: string; method: string; body: unknown; auth: string | null }[] = [];
    const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      seen.push({
        url: String(input),
        method: init.method ?? 'GET',
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        auth: new Headers(init.headers).get('Authorization'),
      });
      return String(input).includes('automation-target')
        ? Response.json({ app: 'liveknowledge', title: 'Docs', pages: [] })
        : Response.json({ ok: true, text: 'Wrote a page' });
    }) as typeof fetch;
    const push: AutomationStepPush = {
      key: 'run:1',
      author: 'user_a',
      rule: { id: 'r1', name: 'Release Note' },
      from: { title: 'Plan', url: 'https://liveplanner.app/project/p1' },
      chain: { id: 'c1', hops: 0, rules: [] },
      step: {
        kind: 'kb_page',
        target: { app: 'liveknowledge', item: 'k1', title: 'Docs' },
        title: 'Shipped',
        body: 'It shipped.',
      },
    };
    const app = createIndexAppClient({ app: 'liveplanner', key: 'k', baseUrl: '/i', fetch: doFetch });
    expect(await app.pushAutomationStep('p1', push)).toEqual({ ok: true, text: 'Wrote a page' });
    expect(seen[0]).toMatchObject({
      url: '/i/app/items/p1/automation-steps',
      method: 'POST',
      body: push,
      auth: 'Bearer k',
    });
    const person = createIndexClient({ baseUrl: '/i', getToken: () => 't', fetch: doFetch });
    expect(await person.automationTarget('k 1')).toEqual({
      app: 'liveknowledge',
      title: 'Docs',
      pages: [],
    });
    expect(seen[1]).toMatchObject({ url: '/i/items/k%201/automation-target', auth: 'Bearer t' });
  });
});
