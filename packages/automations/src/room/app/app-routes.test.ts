import { describe, expect, it, vi } from 'vitest';
import { ANA, world } from '../item/test-kit';
import {
  itemAutomationPath,
  itemCallerOf,
  serveItemAutomations,
  type ItemCallerFacts,
} from './app-routes';

describe('the path after …/automations', () => {
  it('is one the engine serves, or null', () => {
    expect(itemAutomationPath([])).toEqual([]);
    expect(itemAutomationPath([undefined, undefined])).toEqual([]);
    expect(itemAutomationPath(['runs'])).toEqual(['runs']);
    for (const verb of ['toggle', 'duplicate', 'run', 'secret'])
      expect(itemAutomationPath(['r1', verb])).toEqual(['r1', verb]);
    expect(itemAutomationPath(['r1', 'explode'])).toBeNull();
    expect(itemAutomationPath(['r1', 'run', 'now'])).toBeNull();
  });
});

describe('the caller', () => {
  const facts = (over: Partial<ItemCallerFacts> = {}): ItemCallerFacts => ({
    editor: true,
    signedIn: true,
    token: null,
    callerId: ANA.id,
    person: vi.fn(async () => ANA),
    reader: true,
    ...over,
  });

  it('is named only when the gate lets them through', async () => {
    expect(await itemCallerOf(facts())).toEqual({
      editor: true,
      signedIn: true,
      person: ANA,
      reader: true,
    });
    for (const refused of [{ editor: false }, { signedIn: false }, { callerId: null }]) {
      const f = facts(refused);
      const caller = await itemCallerOf(f);
      expect(caller.person).toEqual({ id: f.callerId ?? '', name: 'Someone', color: '#94a3b8' });
      expect(f.person).not.toHaveBeenCalled();
    }
  });

  it('carries a token, and whether it only reads', async () => {
    expect((await itemCallerOf(facts({ token: {} }))).token).toEqual({ readOnly: false });
    expect((await itemCallerOf(facts({ token: { readOnly: true } }))).token).toEqual({
      readOnly: true,
    });
    expect(await itemCallerOf(facts({ token: undefined }))).not.toHaveProperty('token');
  });
});

describe('the routes', () => {
  const ask = (rest: string[], engine?: ReturnType<typeof world>['engine'], editor = true) =>
    serveItemAutomations({
      engine,
      request: new Request('https://api.test/api/items/i1/automations'),
      url: new URL('https://api.test/api/items/i1/automations'),
      rest,
      caller: async () => ({ editor, signedIn: true, person: ANA, reader: true }),
    });

  it('answer 503 outside an item’s room', async () => {
    const res = await ask([]);
    expect(res!.status).toBe(503);
    expect(await res!.json()).toEqual({ error: 'automations_unavailable' });
  });

  it('are the engine’s: the list for an Editor, 403 for anyone else, null for a path it lacks', async () => {
    const w = world();
    expect((await ask([], w.engine))!.status).toBe(200);
    const refused = await ask([], w.engine, false);
    expect(refused!.status).toBe(403);
    expect(await ask(['a', 'b', 'c'], w.engine)).toBeNull();
  });
});
