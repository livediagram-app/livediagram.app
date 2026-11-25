// @vitest-environment jsdom
// The host's Send to Knowledge Base side (liveworkspace/docs/specs/004-index/send-to-knowledge.md): with an app's
// summariser it reads the item's sends for the chips and opens the picker on an entry's ask; a knowledgebase reads
// what it received; without a summariser nothing is offered.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  planSends: vi.fn().mockResolvedValue({ sends: [] }),
  listItems: vi.fn().mockResolvedValue({ items: [] }),
  knowledgeSends: vi.fn().mockResolvedValue({ sends: [] }),
  knowledgeReceived: vi.fn().mockResolvedValue({ received: [] }),
}));
vi.mock('../../lib/index-client', () => ({ indexClient: client }));
vi.mock('../../hooks/ui/useToast', () => ({ useToast: () => ({ success: vi.fn() }) }));

import { SendToPlanHost } from './SendToPlanHost';
import {
  canSendKnowledgeHere,
  canSendWordsToKnowledgeHere,
  sendToKnowledge,
  sendWordsToKnowledge,
  type KnowledgeCapture,
} from '../send-to-knowledge/send-to-knowledge-entry';

const capture: KnowledgeCapture = {
  tabId: 't1',
  elementIds: ['a'],
  selection: { items: [{ id: 'a', kind: 'shape', label: 'Cart' }], links: [] },
  heading: 'Cart',
  picture: async () => null,
};
const summarise = vi.fn(async () => ({ ok: true as const, markdown: 'x' }));

// The picker is lazy: loaded once up front, so the test waits on the host, not on a cold transform.
beforeAll(async () => {
  await import('../send-to-knowledge/SendToKnowledgeDialog');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SendToPlanHost with Send to Knowledge Base', () => {
  it('reads the item’s sends and opens the picker on an ask, closing it on Cancel', async () => {
    render(
      <SendToPlanHost
        app="livediagram"
        itemId="D"
        title="Payments"
        share={{ code: 'abc' }}
        knowledge={summarise}
        enabled
      />,
    );
    expect(client.knowledgeSends).toHaveBeenCalledWith(
      'D',
      expect.objectContaining({ share: { code: 'abc' } }),
    );
    expect(client.knowledgeReceived).not.toHaveBeenCalled();
    expect(canSendKnowledgeHere()).toBe(true);
    act(() => sendToKnowledge(capture));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stops offering it once the host goes', () => {
    const { unmount } = render(
      <SendToPlanHost app="livediagram" itemId="D" title="P" knowledge={summarise} enabled />,
    );
    expect(canSendKnowledgeHere()).toBe(true);
    unmount();
    expect(canSendKnowledgeHere()).toBe(false);
  });

  it('offers nothing without a summariser, and a knowledgebase reads what it received', async () => {
    render(<SendToPlanHost app="liveknowledge" itemId="K" title="Wiki" enabled />);
    expect(canSendKnowledgeHere()).toBe(false);
    expect(client.knowledgeSends).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(client.knowledgeReceived).toHaveBeenCalledWith('K', expect.anything()),
    );
    act(() => sendToKnowledge(capture));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("opens the picker on an Ask AI answer's words in any app, no summariser needed", async () => {
    const { unmount } = render(
      <SendToPlanHost app="liveknowledge" itemId="K" title="Wiki" enabled />,
    );
    expect(canSendWordsToKnowledgeHere()).toBe(true);
    // No words, no picker.
    act(() => sendWordsToKnowledge({ heading: 'Why?', markdown: '  ' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => sendWordsToKnowledge({ heading: 'Why?', markdown: 'Because.' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('The answer, as written')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
    expect(canSendWordsToKnowledgeHere()).toBe(false);
  });

  it('offers no words to a session that cannot send', () => {
    render(<SendToPlanHost app="livediagram" itemId="D" title="P" enabled={false} />);
    expect(canSendWordsToKnowledgeHere()).toBe(false);
  });
});
