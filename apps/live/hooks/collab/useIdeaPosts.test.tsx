// @vitest-environment jsdom
// An idea post from the press until the room answers it (docs/specs/012-collaboration/idea-box.md "Racing for
// the last card", blueprint idea-box-race.md "Behaviour and state"): answered, gone quietly, or refused with
// the notice when a peer's earlier card took its place.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IDEA_MAX_CARDS, type ShapeElement, type Tab } from '@livediagram/document';
import type { RoomOp } from '@livediagram/api-schema';
import { applyRoomOpToTabs } from '@/app/document/[id]/room-op-apply';
import { IDEA_BOX_FULL_MESSAGE, useIdeaPosts } from './useIdeaPosts';

const box = (n: number, over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'box',
  type: 'shape',
  shape: 'idea-box',
  x: 0,
  y: 0,
  width: 340,
  height: 420,
  ideaCards: Array.from({ length: n }, (_, i) => `seed ${i}`),
  ...over,
});

const peerCard: RoomOp = {
  kind: 'el-delta',
  tabId: 't1',
  elementId: 'box',
  delta: { kind: 'idea', text: 'Peer', id: 'peer-card' },
};

// A tiny editor: tabs in state, a room whose answers the test releases by hand.
function setup(start: ShapeElement, room: 'live' | 'none' = 'live') {
  const answers: ((ok: boolean) => void)[] = [];
  const sent: RoomOp[] = [];
  const roomRef = {
    current:
      room === 'live'
        ? ({
            sequence: (op: RoomOp) => {
              sent.push(op);
              return new Promise<boolean>((resolve) => answers.push(resolve));
            },
          } as never)
        : null,
  };
  const onRefused = vi.fn();
  let tabs: Tab[] = [{ id: 't1', name: 'T', elements: [start] }];
  const hook = renderHook(
    ({ tabs: ts }: { tabs: Tab[] }) =>
      useIdeaPosts({
        tabs: ts,
        tickTabs: (fn) => {
          tabs = fn(tabs);
          hook.rerender({ tabs });
        },
        roomRef,
        onRefused,
      }),
    { initialProps: { tabs } },
  );
  const peer = (op: RoomOp) =>
    act(() => {
      tabs = applyRoomOpToTabs(tabs, op, hook.result.current.pendingIdeaIds);
      hook.rerender({ tabs });
    });
  const el = () => tabs[0]!.elements[0] as ShapeElement;
  return { hook, answers, sent, onRefused, peer, el, setTabs: (t: Tab[]) => (tabs = t) };
}

describe('useIdeaPosts', () => {
  it('puts the card in with a fresh id, sends it, and answers true once the room does', async () => {
    const s = setup(box(0));
    let landed: Promise<boolean> | undefined;
    act(() => {
      landed = s.hook.result.current.post('t1', box(0), 'Coffee');
    });
    const id = s.el().ideaCardIds![0]!;
    expect(s.el().ideaCards).toEqual(['Coffee']);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.sent[0]).toMatchObject({
      kind: 'el-delta',
      delta: { kind: 'idea', text: 'Coffee', id },
    });
    expect(s.hook.result.current.pendingIdeaIds('t1', 'box')).toEqual([id]);
    await act(async () => s.answers[0]!(true));
    expect(await landed).toBe(true);
    expect(s.hook.result.current.pendingIdeaIds('t1', 'box')).toEqual([]);
  });

  it('gives its card up for a peer card numbered first, and says so', async () => {
    const s = setup(box(IDEA_MAX_CARDS - 1));
    let landed: Promise<boolean> | undefined;
    act(() => {
      landed = s.hook.result.current.post('t1', box(IDEA_MAX_CARDS - 1), 'Mine');
    });
    expect(s.el().ideaCards).toHaveLength(IDEA_MAX_CARDS);
    s.peer(peerCard);
    expect(await landed).toBe(false);
    expect(s.onRefused).toHaveBeenCalledWith(IDEA_BOX_FULL_MESSAGE);
    expect(s.el().ideaCards!.at(-1)).toBe('Peer');
    expect(s.el().ideaCards).not.toContain('Mine');
    // The room's late answer changes nothing.
    await act(async () => s.answers[0]!(true));
    expect(s.onRefused).toHaveBeenCalledOnce();
  });

  it('keeps an answered card: a peer card after the answer is the one refused', async () => {
    const s = setup(box(IDEA_MAX_CARDS - 1));
    act(() => {
      void s.hook.result.current.post('t1', box(IDEA_MAX_CARDS - 1), 'Mine');
    });
    await act(async () => s.answers[0]!(true));
    s.peer(peerCard);
    expect(s.el().ideaCards!.at(-1)).toBe('Mine');
    expect(s.onRefused).not.toHaveBeenCalled();
  });

  it('answers true at once with no live room', async () => {
    const s = setup(box(0), 'none');
    let landed: Promise<boolean> | undefined;
    act(() => {
      landed = s.hook.result.current.post('t1', box(0), 'Solo');
    });
    expect(await landed).toBe(true);
    expect(s.el().ideaCards).toEqual(['Solo']);
  });

  it('says nothing when the box is emptied for a new round meanwhile', async () => {
    const s = setup(box(3, { collabRound: 'r1' }));
    let landed: Promise<boolean> | undefined;
    act(() => {
      landed = s.hook.result.current.post('t1', box(3, { collabRound: 'r1' }), 'Mine');
    });
    const cleared: Tab[] = [
      { id: 't1', name: 'T', elements: [box(0, { collabRound: 'r2', ideaCardIds: [] })] },
    ];
    act(() => {
      s.setTabs(cleared);
      s.hook.rerender({ tabs: cleared });
    });
    expect(await landed).toBe(true);
    expect(s.onRefused).not.toHaveBeenCalled();
  });
});
