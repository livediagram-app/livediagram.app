// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';
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
import { ElementReader } from './ElementReader';

// Send to Plan from a sticky read while walking (docs/specs/013-workspace/send-to-plan.md "What it sends", "Who sees
// it"): a walking click opens the reader and selects nothing, so the reader's footer is a Participant's and a Viewer's
// way in, as it is an Editor's. Read on the Space is enough: the reader is the same for every role, and shows the
// button only while the session may send.

const box = (over: Record<string, unknown>) =>
  ({ id: 's1', x: 0, y: 0, width: 200, height: 100, ...over }) as unknown as Element;
const sticky = box({ type: 'sticky', label: 'Book the venue' });

let heard: SendRequest[] = [];
let stop: () => void = () => {};
const up = () => {
  setSendSource('S', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'livehuddle', tabId: 't1' });
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

const sendButton = () => screen.queryByRole('button', { name: /Send to Plan/ });

describe("a walking reader's Send to Plan", () => {
  it('sends the sticky read, closing the reader as the picker opens', () => {
    up();
    const onClose = vi.fn();
    render(<ElementReader element={sticky} onClose={onClose} />);
    fireEvent.click(sendButton()!);
    expect(onClose).toHaveBeenCalled();
    expect(heard[0]).toMatchObject({
      noun: 'sticky',
      places: [
        expect.objectContaining({
          app: 'livehuddle',
          itemId: 'S',
          tabId: 't1',
          elementId: 's1',
          text: 'Book the venue',
        }),
      ],
    });
  });

  it('offers nothing while the session may not send, on an empty sticky, or on a piece that is not words', () => {
    const { unmount } = render(<ElementReader element={sticky} onClose={() => {}} />);
    expect(sendButton()).toBeNull();
    unmount();
    up();
    for (const element of [
      box({ type: 'sticky', label: '  ' }),
      box({ type: 'shape', shape: 'jukebox' }),
    ]) {
      const shown = render(<ElementReader element={element} onClose={() => {}} />);
      expect(sendButton()).toBeNull();
      shown.unmount();
    }
  });

  it('shows the card once sent, live, in place of the button', async () => {
    up();
    render(<ElementReader element={box({ type: 'text', label: 'Agenda' })} onClose={() => {}} />);
    expect(sendButton()).toBeTruthy();
    await act(async () => {});
    const sent: PlanSend = {
      id: 'ps_1',
      ref: 'element:t1:s1:',
      kind: 'element',
      plan: { id: 'P', title: 'Sprint' },
      card: { id: 'c1', title: 'Agenda', column: 'To Do', done: false },
      link: 'https://lp/x',
      at: 1,
    };
    act(() => addSends([sent]));
    expect(sendButton()).toBeNull();
    expect(screen.getByRole('button', { name: /Open the card “Agenda”/ })).toBeTruthy();
  });
});
