import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEnv } from '../types';
import { writePlanTab } from './plan-diagram-tab';

// View As Diagram's redraw (diagrams-and-plans.md "Live"): the drawn tab replaced as the view's maker, through the
// changeset path, never making a tab someone deleted; a canvas gone or a refused replace told back to the plan.
const doc = vi.hoisted(() => ({ value: { id: 'D' } as unknown }));
const person = vi.hoisted(() => ({ value: { name: 'Ada', color: '#123456' } as unknown }));
const submit = vi.hoisted(() => vi.fn(async (_: unknown) => ({ status: 200 })));
vi.mock('../db', () => ({ getDocument: async () => doc.value }));
vi.mock('../liveworkspace/profiles', () => ({ getParticipant: async () => person.value }));
vi.mock('../changesets/submit', () => ({ submitChangeset: (a: unknown) => submit(a) }));

const env = {} as DocumentEnv;
const write = { tabId: 't1', elements: [], owner: 'user_ada' };

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  doc.value = { id: 'D' };
  person.value = { name: 'Ada', color: '#123456' };
  submit.mockClear();
  submit.mockImplementation(async () => ({ status: 200 }));
});
afterEach(() => vi.restoreAllMocks());

describe('writePlanTab', () => {
  it("replaces the drawn tab as the view's maker, never making a deleted tab again", async () => {
    const waitUntil = vi.fn();
    expect(await writePlanTab(env, 'D', write, waitUntil)).toEqual({ status: 'ok' });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        tabId: 't1',
        mayCreateTab: false,
        waitUntil,
        author: { id: 'user_ada', name: 'Ada', color: '#123456' },
        request: expect.objectContaining({ summary: 'View As Diagram' }),
      }),
    );
  });

  it('writes as Someone when the maker has no participant row', async () => {
    person.value = null;
    await writePlanTab(env, 'D', write);
    expect(submit.mock.calls[0]![0]).toMatchObject({ author: { name: 'Someone' } });
    expect(submit.mock.calls[0]![0]).not.toHaveProperty('waitUntil');
  });

  it('answers a canvas or tab gone as not found, and any other refusal as an invalid graph', async () => {
    doc.value = null;
    expect(await writePlanTab(env, 'D', write)).toEqual({ status: 'not_found' });
    doc.value = { id: 'D' };
    submit.mockImplementation(async () => ({ status: 404 }));
    expect(await writePlanTab(env, 'D', write)).toEqual({ status: 'not_found' });
    submit.mockImplementation(async () => ({ status: 422 }));
    expect(await writePlanTab(env, 'D', write)).toEqual({ status: 'invalid_graph' });
  });
});
