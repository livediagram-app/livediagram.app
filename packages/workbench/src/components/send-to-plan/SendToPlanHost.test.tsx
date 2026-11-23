// @vitest-environment jsdom
// The editor's Send to Plan host (liveworkspace/docs/specs/004-index/send-to-plan.md): it names the open item to the
// chips' store and opens the picker on a menu's ask, and does nothing at all for a session that cannot send.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const { planSends, listItems } = vi.hoisted(() => ({
  planSends: vi.fn().mockResolvedValue({ sends: [] }),
  listItems: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock('../../lib/index-client', () => ({ indexClient: { planSends, listItems } }));
vi.mock('../../hooks/ui/useToast', () => ({ useToast: () => ({ success: vi.fn() }) }));

import { SendToPlanHost } from './SendToPlanHost';
import {
  canSendHere,
  onSendToPlan,
  openSendToPlan,
  sendFromHere,
  sendPlace,
  type SendRequest,
} from './send-to-plan-entry';

const ask = () =>
  openSendToPlan({
    places: [
      sendPlace({
        app: 'livediagram',
        itemId: 'D',
        kind: 'element',
        elementId: 'e1',
        text: 'Fix it',
      }),
    ],
    noun: 'sticky',
  });

// The picker is lazy: loaded once up front, so the test waits on the host, not on a cold transform under load.
beforeAll(async () => {
  await import('./SendToPlanDialog');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SendToPlanHost', () => {
  it('reads the item’s sends with its link, and opens the picker when asked', async () => {
    render(
      <SendToPlanHost app="livediagram" itemId="D" title="Retro" share={{ code: 'abc' }} enabled />,
    );
    expect(planSends).toHaveBeenCalledWith(
      'D',
      expect.objectContaining({ share: { code: 'abc' } }),
    );
    act(ask);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    act(() => screen.getByRole('button', { name: 'Cancel' }).click());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does nothing for a session that cannot send', () => {
    render(<SendToPlanHost app="livediagram" itemId="D" title="Retro" enabled={false} />);
    act(ask);
    expect(planSends).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lets a menu send the element on the tab shown, only while the host is up', () => {
    const heard = vi.fn<(request: SendRequest) => void>();
    const stop = onSendToPlan(heard);
    const { unmount } = render(
      <SendToPlanHost app="livedesign" itemId="D" tabId="t1" title="R" enabled />,
    );
    expect(canSendHere()).toBe(true);
    sendFromHere('element', 'shape', [
      { elementId: 'e1', text: 'Box', label: 'Frame 1' },
      { elementId: 'e2', text: 'Two' },
    ]);
    expect(heard.mock.calls[0]![0].places).toEqual([
      expect.objectContaining({
        app: 'livedesign',
        itemId: 'D',
        tabId: 't1',
        elementId: 'e1',
        label: 'Frame 1',
      }),
      expect.objectContaining({ elementId: 'e2', label: '' }),
    ]);
    unmount();
    expect(canSendHere()).toBe(false);
    sendFromHere('element', 'shape', [{ elementId: 'e1', text: 'Box' }]);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });
});
