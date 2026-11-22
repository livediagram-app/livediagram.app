import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationStepDoorCall } from '@liveworkspace/index-client';
import { box, DOC, ANA, roomWorld, type RoomWorld } from './test-automation-world';
import { postLabel, postPlace } from './cross-app-door';

// Post in a Space, a rule's step from another app (docs/specs/013-workspace/automations.md "Steps in other apps"):
// a note on the chosen tab, signed by the rule, written as its author, its event in the chain it came in.

afterEach(() => {
  vi.restoreAllMocks();
});

async function started(): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create([{ id: 't1', name: 'Lobby', elements: [box('a', 'Checkout')] }]);
  return w;
}

const call = (over: Record<string, unknown> = {}): AutomationStepDoorCall => ({
  author: ANA,
  rule: { id: 'r1', name: 'Meeting Ended', app: 'liveplanner', item: 'p1' },
  from: { title: 'Launch', url: 'https://liveplanner.app/plan/p1' },
  chain: { id: 'c1', hops: 1, rules: ['liveplanner:p1:r1'] },
  step: {
    kind: 'space_post',
    target: { app: 'livehuddle', item: DOC, title: 'Studio' },
    spaceTab: 't1',
    text: 'Ship it',
    ...over,
  },
});

describe('Post in a Space', () => {
  it('places a note right of the tab’s content and signs it', () => {
    expect(postPlace([])).toEqual({ x: 0, y: 0 });
    expect(
      postPlace([
        { id: 'a', x: 10, y: 20, width: 100, height: 50 },
        { id: 'b', x: 200, y: -5, width: 40, height: 40 },
        { id: 'line' },
      ] as never),
    ).toEqual({ x: 280, y: -5 });
    expect(postLabel(' Ship it ', ' Release ')).toBe('Ship it\n\nAutomation · Release');
    expect(postLabel('x', '  ')).toBe('x\n\nAutomation · Untitled');
  });

  it('writes the note on the tab as the author, in the chain, and answers the tabs', async () => {
    const w = await started();
    const answer = await w.room.automationStep(DOC, call());
    expect(answer).toMatchObject({ ok: true, text: 'Posted a note in “Studio”' });
    const [row] = w.rows('SELECT data FROM tabs WHERE id = ?', 't1');
    expect(String(row?.['data'])).toContain('Automation · Meeting Ended');
    expect(await w.room.automationTarget(DOC)).toEqual({ tabs: [{ id: 't1', name: 'Lobby' }] });
  });

  it('answers a tab gone, and a step it does not take', async () => {
    const w = await started();
    expect(await w.room.automationStep(DOC, call({ spaceTab: 'gone' }))).toMatchObject({
      ok: false,
      code: 'target_gone',
    });
    expect(
      await w.room.automationStep(DOC, { ...call(), step: { kind: 'kb_page' } } as never),
    ).toMatchObject({ ok: false, code: 'invalid' });
  });
});
