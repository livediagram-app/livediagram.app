import type { AutomationStepDoorCall } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEMPLATE_GONE } from './app/kit-add-tab';
import {
  CROSS_APP_NOT_HERE,
  readTargetStep,
  takeCrossAppStep,
  takeDocTab,
} from './cross-app-target';
import { ANA, queued, world } from './item/test-kit';

afterEach(() => vi.restoreAllMocks());

const target = { app: 'livediagram' as const, item: 'd1', title: 'Board' };
const tab = { kind: 'doc_tab' as const, target, docTemplate: 'flowchart', name: 'Release' };
const callOf = (step: unknown, hops = 1): AutomationStepDoorCall =>
  ({
    author: 'user_ana',
    rule: { id: 'r1', name: 'Release Note', app: 'liveplanner', item: 'p1' },
    from: { title: 'Launch', url: 'https://liveplanner.app/project/p1' },
    chain: { id: 'c1', hops, rules: ['liveplanner:p1:r1'] },
    step,
  }) as AutomationStepDoorCall;

describe('a step from another app at its target', () => {
  it('runs the app’s write in the step’s chain, as the automation’s', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    const host = { AUTOMATIONS: w.engine };
    const answer = await takeCrossAppStep(
      host,
      callOf(tab),
      {
        doc_tab: (step) =>
          takeDocTab(
            step,
            async (_t, name) => {
              w.addTab('t9');
              return { id: 't9', name };
            },
            (id) => `https://x/d1?tab=${id}`,
          ),
      },
      ANA,
    );
    expect(answer).toEqual({
      ok: true,
      text: 'Added a tab “Release” to “Board”',
      link: 'https://x/d1?tab=t9',
    });
    expect(queued(w.sql)).toMatchObject([
      { tab: 't9', role: 'automation', cross: { id: 'c1', hops: 1 } },
    ]);
  });

  it('refuses a step it cannot read, one it does not take, and a chain past its hops', async () => {
    const host = {};
    expect(await takeCrossAppStep(host, callOf(tab, 4), {})).toMatchObject({ code: 'chain_long' });
    expect(await takeCrossAppStep(host, callOf({ ...tab, name: '' }), {})).toMatchObject({
      code: 'invalid',
      reason: 'step.name must be text of 1 to 200 characters',
    });
    expect(await takeCrossAppStep(host, callOf(tab), {})).toEqual({
      ok: false,
      code: 'invalid',
      reason: CROSS_APP_NOT_HERE,
    });
    expect(readTargetStep(null)).toBe(CROSS_APP_NOT_HERE);
    expect(readTargetStep({ kind: 'inbox_notice' })).toBe(CROSS_APP_NOT_HERE);
    expect(() =>
      readTargetStep({
        kind: 'doc_tab',
        get target() {
          throw new Error('x');
        },
      }),
    ).toThrow('x');
  });

  it('says a template gone is the target’s, and any other failure is the step’s', async () => {
    expect(
      await takeDocTab(
        tab,
        async () => ({ failed: TEMPLATE_GONE }),
        () => null,
      ),
    ).toEqual({
      ok: false,
      code: 'target_gone',
      reason: TEMPLATE_GONE,
    });
    expect(
      await takeDocTab(
        tab,
        async () => ({ failed: 'Too many' }),
        () => null,
      ),
    ).toEqual({
      ok: false,
      code: 'failed',
      reason: 'Too many',
    });
    expect(
      await takeDocTab(
        { ...tab, target: { ...target, title: '' } },
        async () => ({ id: 't', name: 'N' }),
        () => null,
      ),
    ).toEqual({ ok: true, text: 'Added a tab “N” to “Untitled”' });
  });
});
