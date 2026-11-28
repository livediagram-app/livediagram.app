import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationStepDoorCall } from '@liveworkspace/index-client';
import { box, DOC, ANA, roomWorld, type RoomWorld } from './test-automation-world';
import { createShape, NOTES_MAX, type Element } from '@livehuddle/document';
import { POST_SIGNER, postBoard, postNote } from './cross-app-door';

// Post in a Space, a rule's step from another app (docs/specs/013-workspace/automations.md "Steps in other apps"):
// a note pinned on the chosen tab's first Notice Board, titled by the rule, written as its author, its event in the
// chain it came in; a tab with no board refuses it.

const board = (id: string, notes = 0): Element => ({
  ...createShape('notice-board', 300, 0),
  id,
  noticeNotes: Array.from({ length: notes }, (_, i) => ({
    id: `n${i}`,
    text: 'Hi',
    author: 'Ana',
    by: 'ana',
    at: i,
  })),
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function started(
  elements: Element[] = [box('a', 'Checkout'), board('nb')],
): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create([{ id: 't1', name: 'Lobby', elements }]);
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
  it('finds the first board and makes the note from the rule', () => {
    expect(postBoard([box('a'), board('b1'), board('b2')])).toBe(1);
    expect(postBoard([box('a')])).toBe(-1);
    expect(postNote(' Ship it ', ' Release ', 'Ana', 5, 'x')).toEqual({
      id: 'x',
      title: 'Automation · Release',
      text: 'Ship it',
      author: 'Ana',
      by: POST_SIGNER,
      at: 5,
    });
    const long = postNote('y'.repeat(400), 'r'.repeat(90), 'A'.repeat(90), 0, 'x');
    expect([long.title!.length, long.text.length, long.author.length]).toEqual([60, 280, 60]);
    expect(postNote('  ', '  ', 'Ana', 0, 'x')).toMatchObject({ title: 'Automation · Untitled' });
  });

  it('writes the note on the tab as the author, in the chain, and answers the tabs', async () => {
    const w = await started();
    const answer = await w.room.automationStep(DOC, call());
    expect(answer).toMatchObject({
      ok: true,
      text: 'Pinned a note on the Notice Board in “Studio”',
    });
    const [row] = w.rows('SELECT data FROM tabs WHERE id = ?', 't1');
    const stored = JSON.parse(String(row?.['data'])) as { elements: Element[] };
    expect(stored.elements.map((e) => e.type)).toEqual(['shape', 'shape']);
    const nb = stored.elements.find((e) => e.id === 'nb') as { noticeNotes?: unknown[] };
    expect(nb.noticeNotes).toEqual([
      expect.objectContaining({
        title: 'Automation · Meeting Ended',
        text: 'Ship it',
        by: POST_SIGNER,
      }),
    ]);
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

  it('refuses a tab with no Notice Board, and a full one', async () => {
    const bare = await started([box('a')]);
    expect(await bare.room.automationStep(DOC, call())).toEqual({
      ok: false,
      code: 'target_gone',
      reason: 'The tab has no Notice Board to post on',
    });
    const full = await started([board('nb', NOTES_MAX)]);
    expect(await full.room.automationStep(DOC, call())).toMatchObject({
      ok: false,
      code: 'failed',
      reason: 'The Notice Board is full',
    });
  });
});
