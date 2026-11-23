// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanSend } from '@liveworkspace/index-client';
import {
  addSends,
  setSendSource,
} from '@liveworkspace/workbench/components/send-to-plan/send-store';
import {
  onSendToPlan,
  setSendHere,
  type SendRequest,
} from '@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry';
import { CardThreads } from './CardThreads';
import { card, comment, liveThreads, PLAN, thread } from './thread-test-kit';

// Send to Plan from a card's own thread (docs/specs/013-workspace/send-to-plan.md "What it sends", "Who sees it"):
// on each thread's tile, for every role that reads the card, the card as the place and the thread as its part.

const sent = (ref: string): PlanSend => ({
  id: `ps_${ref}`,
  ref,
  kind: 'thread',
  plan: { id: 'P2', title: 'Roadmap' },
  card: { id: 'c9', title: 'Follow up', column: 'To Do', done: false },
  link: 'https://www.liveplanner.app/project/P2#item=c9',
  at: 1,
});

let heard: SendRequest[] = [];
let stop: () => void = () => {};
const up = () => {
  setSendSource(PLAN, null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'liveplanner', tabId: 'board-tab' });
};

beforeEach(() => {
  heard = [];
  stop = onSendToPlan((r) => heard.push(r));
});
afterEach(() => {
  cleanup();
  stop();
  setSendSource(null);
  setSendHere(null);
});

const ROLES = {
  Editor: { isEditor: true, canComment: true },
  Participant: { isEditor: false, canComment: true },
  Viewer: { isEditor: false, canComment: false },
} as const;

function show(threads = [thread('th-a')], role: keyof typeof ROLES = 'Editor') {
  const live = liveThreads(threads, ROLES[role]);
  render(
    <live.Live>
      <CardThreads item={card()} />
    </live.Live>,
  );
}

const sendButtons = () => screen.queryAllByRole('button', { name: 'Send this thread to a plan' });

describe("a card thread's Send to Plan", () => {
  it('is on every role’s tile, sending the card with the thread as its part and no tab', () => {
    up();
    for (const role of ['Editor', 'Participant', 'Viewer'] as const) {
      heard = [];
      show([thread('th-a', { comments: [comment('c1', { text: 'Call the supplier' })] })], role);
      const [button] = sendButtons();
      expect(button).toBeTruthy();
      fireEvent.click(button!);
      expect(heard).toHaveLength(1);
      expect(heard[0]!.noun).toBe('thread');
      expect(heard[0]!.places).toEqual([
        {
          app: 'liveplanner',
          itemId: PLAN,
          kind: 'thread',
          tabId: null,
          elementId: 'card-1',
          part: 'th-a',
          label: '',
          text: 'Call the supplier',
        },
      ]);
      cleanup();
    }
  });

  it('is not offered while the session may not send, nor on a thread with no words', () => {
    show();
    expect(sendButtons()).toHaveLength(0);
    cleanup();
    up();
    show([thread('th-a', { comments: [comment('c1', { text: '   ' })] })]);
    expect(sendButtons()).toHaveLength(0);
  });

  it('gives each thread on the card its own chip once sent', async () => {
    up();
    show([thread('th-a'), thread('th-b')], 'Viewer');
    expect(sendButtons()).toHaveLength(2);
    // The opening read (none sent) lands first, as the editor's does.
    await act(async () => {});
    await act(async () => addSends([sent('thread::card-1:th-a')]));
    // th-a's tile now shows its chip; th-b keeps its button.
    expect(sendButtons()).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Open the card “Follow up”/ })).toHaveLength(1);
  });
});
