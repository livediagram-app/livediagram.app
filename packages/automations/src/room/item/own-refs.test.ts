import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OWN_KINDS } from '../../item/own-refs.test';
import type { ItemRoomKit } from './kit';
import { handleItemAutomationRoutes } from './routes';
import type { ItemListedRule } from './route-kit';
import { ANA, world } from './test-kit';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function app(over: Partial<ItemRoomKit> = {}) {
  const w = world({ kinds: OWN_KINDS, ...over });
  w.addTab('t1', 'Letter');
  const call = async (method: string, path: string, body?: unknown) => {
    const url = new URL(`https://app.example/api/documents/item-1/automations${path}`);
    const res = await handleItemAutomationRoutes({
      engine: w.engine,
      method,
      segments: url.pathname.split('/').slice(5),
      url,
      caller: { editor: true, signedIn: true, person: ANA, reader: true },
      request: new Request(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    });
    return { status: res!.status, body: await res!.json<Record<string, unknown>>() };
  };
  const restore = (id: string, version: string) =>
    w.rule({ id, enabled: false, steps: [{ kind: 'restore_version', tab: 't1', version }] });
  const needs = async () =>
    ((await call('GET', '')).body['rules'] as ItemListedRule[]).map((r) => r.needs);
  return { w, call, restore, needs };
}

describe('a reference of the app’s own in the Rules list', () => {
  it('is said to be gone when the item lacks it, and to pick when empty', async () => {
    const owns = vi.fn(
      async (_field: string, ids: readonly string[]) => new Set(ids.filter((v) => v === 'v1')),
    );
    const { restore, needs, w } = app({ owns });
    restore('r1', 'v1');
    restore('r2', 'v-gone');
    restore('r3', '');
    w.rule({ id: 'r4' });
    expect(await needs()).toEqual([[], ['Version v-gone is gone'], ['Pick a version'], []]);
    expect(owns).toHaveBeenCalledTimes(1);
    expect(owns).toHaveBeenCalledWith('version', ['v1', 'v-gone']);
  });

  it('is not asked for while no rule names one, or of a kit that cannot say', async () => {
    const owns = vi.fn(async () => new Set<string>());
    const asked = app({ owns });
    asked.w.rule({ id: 'r1' });
    asked.restore('r2', '');
    expect(await asked.needs()).toEqual([[], ['Pick a version']]);
    expect(owns).not.toHaveBeenCalled();
    const mute = app();
    mute.restore('r1', 'v-any');
    expect(await mute.needs()).toEqual([[]]);
  });

  it('keeps a rule off until it is picked', async () => {
    const { restore, call } = app();
    restore('r1', '');
    const refused = await call('POST', '/r1/toggle', { enabled: true });
    expect(refused.status).toBe(400);
    expect(refused.body['message']).toBe('pick what the rule still needs before turning it on');
    restore('r2', 'v1');
    expect((await call('POST', '/r2/toggle', { enabled: true })).status).toBe(200);
  });
});
