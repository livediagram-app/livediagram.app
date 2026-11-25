// @vitest-environment jsdom
// Connect as tabs' row (connected-tabs.md "Linked from a Send to"): the switch on by default, a tick for files already
// connected, gone for a file sent into itself; the read aborted when another destination is picked; nothing linked
// when off.
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock('../../hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { LinkTabsOption } from './LinkTabsOption';
import { useLinkTabs } from './useLinkTabs';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const client = (source = 'can', target = 'can') => ({
  linkedTabs: vi.fn().mockResolvedValue({ source, target }),
  linkTabs: vi.fn().mockResolvedValue({ source: 'made', target: 'made' }),
});

function Row({ c, targetId }: { c: ReturnType<typeof client>; targetId: string | null }) {
  const link = useLinkTabs({ sourceId: 'S', targetId, client: c });
  return (
    <LinkTabsOption
      link={link}
      sourceApp="livediagram"
      targetApp="liveplanner"
      names={{ source: 'Retro', target: 'Sprint' }}
    />
  );
}

describe('LinkTabsOption', () => {
  it('is a switch, on by default, that turns off and lights the pair only while on', async () => {
    render(<Row c={client()} targetId={null} />);
    const row = screen.getByRole('switch', { name: 'Connect as tabs' });
    expect(row.getAttribute('aria-checked')).toBe('true');
    expect(row.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.querySelector('[data-link-tabs-pair="lit"]')).toBeTruthy();
    fireEvent.click(row);
    expect((await screen.findByRole('switch')).getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('[data-link-tabs-pair="dim"]')).toBeTruthy();
  });

  it('shows a tick for files already connected', async () => {
    render(<Row c={client('connected', 'connected')} targetId="P" />);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText('Connected as tabs')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('is not shown for the source itself, and reads nothing', () => {
    const c = client();
    render(<Row c={c} targetId="S" />);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(c.linkedTabs).not.toHaveBeenCalled();
  });
});

describe('useLinkTabs', () => {
  it('aborts the read of a destination no longer picked, and offers on a failed read', async () => {
    const c = client();
    c.linkedTabs.mockImplementation((_s: string, t: string, o: { signal: AbortSignal }) =>
      t === 'A'
        ? new Promise((_, no) => o.signal.addEventListener('abort', () => no(new Error('x'))))
        : Promise.reject(new Error('down')),
    );
    const { result, rerender } = renderHook(
      ({ t }) => useLinkTabs({ sourceId: 'S', targetId: t, client: c }),
      { initialProps: { t: 'A' } },
    );
    expect(result.current.state.kind).toBe('loading');
    rerender({ t: 'B' });
    await waitFor(() => expect(result.current.state.kind).toBe('failed'));
    expect(result.current.view).toBe('offer');
    expect((c.linkedTabs.mock.calls[0]![2] as { signal: AbortSignal }).signal.aborted).toBe(true);
  });

  it('links nothing when switched off or for the source, and says nothing when both hold', async () => {
    const c = client();
    c.linkTabs.mockResolvedValueOnce({ source: 'made', target: 'connected' });
    const { result } = renderHook(() => useLinkTabs({ sourceId: 'S', targetId: null, client: c }));
    expect(await result.current.finish('S', { source: 'a', target: 'b' })).toBeNull();
    expect(await result.current.finish('P', { source: 'a', target: 'b' })).toEqual({
      source: 'made',
      target: 'connected',
    });
    act(() => result.current.setOn(false));
    expect(await result.current.finish('P', { source: 'a', target: 'b' })).toBeNull();
    expect(c.linkTabs).toHaveBeenCalledTimes(1);
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
