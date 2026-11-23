// @vitest-environment jsdom
// A walkthrough's tier limits in the editor (walkthroughs.md "With Pro on"): the recorder takes its length from the
// server's answer, the list shows the notices in place of Record Walkthrough and after a recording that ran to its
// limit, the offer is only for someone who may upgrade, and with Pro off none of it is there.
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { WALKTHROUGH_MAX_MS, type WalkthroughLimits } from '@liveworkspace/media/walkthrough';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  ME,
  ownerView,
  serviceFetch,
  setProForTests,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import { configureWorkbench, resetWorkbenchForTests } from '@liveworkspace/workbench/bindings';
import { testBindings } from '@liveworkspace/workbench/lib/testing/bindings';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalkthroughHost } from './host';
import { RecordDock } from './ui/RecordDock';
import { WalkthroughsPanel } from './ui/WalkthroughsTools';
import { useWalkthroughs, type Walkthroughs, type WalkthroughsMenu } from './useWalkthroughs';

const FIVE = 5 * 60 * 1000;
const FREE: WalkthroughLimits = { maxMs: FIVE, stored: 5, storedLimit: 5, owner: ME };

const W = {
  id: 'w1',
  title: 'Checkout Flow Tour',
  author: 'Ada',
  durationMs: FIVE,
  mediaType: 'video/webm' as const,
  mediaBytes: 10,
  camera: false,
  screen: true,
  shareCode: null,
  createdAt: Date.UTC(2026, 10, 18),
  mine: true,
  canDelete: true,
};

beforeEach(() => {
  setProForTests(true);
  configureWorkbench(testBindings({ track: vi.fn() }));
});
afterEach(() => {
  setProForTests(null);
  resetWorkbenchForTests();
  vi.unstubAllGlobals();
});

function page(node: ReactNode, action: 'upgrade' | 'none' = 'upgrade') {
  const { fetcher } = serviceFetch({ owners: { [ME]: ownerView(ME, action) } });
  return (
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      {node}
    </SubscriptionProvider>
  );
}

const menu = (over: Partial<WalkthroughsMenu> = {}): WalkthroughsMenu => ({
  available: true,
  list: [W],
  canRecord: true,
  loading: null,
  record: vi.fn(),
  play: vi.fn(),
  remove: vi.fn(async () => true),
  rename: vi.fn(async () => true),
  share: vi.fn(async () => null),
  limits: null,
  limitStop: null,
  ...over,
});

describe('the Walkthroughs list at the stored limit', () => {
  it('puts the notice where Record Walkthrough was, with Upgrade to Pro for the owner', async () => {
    render(page(<WalkthroughsPanel walkthroughs={menu({ limits: FREE })} onClose={() => {}} />));
    expect(screen.queryByText('Record Walkthrough')).toBeNull();
    const notice = await screen.findByRole('status');
    await waitFor(() =>
      expect(notice.textContent).toContain(
        'You have 5 walkthroughs, the most Free keeps. Delete one to record another, or keep as many as you like with Pro.',
      ),
    );
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
  });

  it('tells a collaborator the limit and offers nothing', async () => {
    render(
      page(<WalkthroughsPanel walkthroughs={menu({ limits: FREE })} onClose={() => {}} />, 'none'),
    );
    const notice = await screen.findByRole('status');
    await waitFor(() => expect(notice.textContent).toContain('the most Free keeps'));
    expect(notice.textContent).not.toContain('with Pro');
    expect(screen.queryByRole('button', { name: 'Upgrade to Pro' })).toBeNull();
    expect(screen.queryByText('Record Walkthrough')).toBeNull();
  });

  it('keeps Record Walkthrough under the limit, with no limit, and with Pro off', () => {
    const { rerender } = render(
      page(
        <WalkthroughsPanel
          walkthroughs={menu({ limits: { ...FREE, stored: 4 } })}
          onClose={() => {}}
        />,
      ),
    );
    expect(screen.getByText('Record Walkthrough')).toBeTruthy();
    rerender(
      page(
        <WalkthroughsPanel
          walkthroughs={menu({ limits: { ...FREE, stored: 80, storedLimit: null } })}
          onClose={() => {}}
        />,
      ),
    );
    expect(screen.getByText('Record Walkthrough')).toBeTruthy();
    setProForTests(false);
    rerender(<WalkthroughsPanel walkthroughs={menu()} onClose={() => {}} />);
    expect(screen.getByText('Record Walkthrough')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('the Walkthroughs list’s length note', () => {
  const UNDER: WalkthroughLimits = { ...FREE, stored: 0 };
  it('says how long a recording may run before anything is recorded, with See Pro for the owner', async () => {
    render(
      page(
        <WalkthroughsPanel walkthroughs={menu({ list: [], limits: UNDER })} onClose={() => {}} />,
      ),
    );
    expect(screen.getByText('No walkthroughs yet')).toBeTruthy();
    const note = await screen.findByRole('note');
    await waitFor(() =>
      expect(note.textContent).toContain(
        'Free records up to 5 minutes. Pro records up to 30 minutes.',
      ),
    );
    expect(screen.getByText('Record Walkthrough')).toBeTruthy();
  });

  it('stays under a list, tells a collaborator only the minutes, and is gone at the longest or with Pro off', async () => {
    const { rerender } = render(
      page(
        <WalkthroughsPanel
          walkthroughs={menu({ limits: { ...FREE, stored: 1 } })}
          onClose={() => {}}
        />,
        'none',
      ),
    );
    const note = await screen.findByRole('note');
    await waitFor(() =>
      expect(note.textContent).toContain('A walkthrough here records up to 5 minutes.'),
    );
    rerender(
      page(
        <WalkthroughsPanel
          walkthroughs={menu({ limits: { ...FREE, stored: 1, maxMs: 30 * 60 * 1000 } })}
          onClose={() => {}}
        />,
      ),
    );
    await waitFor(() => expect(screen.queryByRole('note')).toBeNull());
    setProForTests(false);
    rerender(<WalkthroughsPanel walkthroughs={menu()} onClose={() => {}} />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('a recording that ran to its length limit', () => {
  it('says so over the list once saved, with Watch It and See Pro for the owner', async () => {
    const play = vi.fn();
    const onClose = vi.fn();
    render(
      page(
        <WalkthroughsPanel
          walkthroughs={menu({ limits: { ...FREE, stored: 3 }, limitStop: 'w1', play })}
          onClose={onClose}
        />,
      ),
    );
    const notice = await screen.findByRole('status');
    await waitFor(() => expect(notice.textContent).toContain('Pro records up to 30 minutes.'));
    expect(notice.textContent).toContain('Saved at 5:00');
    expect(notice.textContent).toContain(
      'Your walkthrough reached Free’s 5 minutes and is saved in full.',
    );
    expect(screen.getByRole('button', { name: 'See Pro' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Watch It' }));
    expect(play).toHaveBeenCalledWith('w1');
    expect(onClose).toHaveBeenCalled();
  });

  it('tells a collaborator it was saved, with Watch It and no offer', async () => {
    render(
      page(
        <WalkthroughsPanel
          walkthroughs={menu({ limits: { ...FREE, stored: 3 }, limitStop: 'w1' })}
          onClose={() => {}}
        />,
        'none',
      ),
    );
    const notice = await screen.findByRole('status');
    await waitFor(() => expect(notice.textContent).toContain('Free’s 5 minutes'));
    expect(notice.textContent).not.toContain('Pro records');
    expect(screen.getByRole('button', { name: 'Watch It' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'See Pro' })).toBeNull();
  });
});

// The hook over a door that answers the list as the api does.
function host(list: () => unknown): WalkthroughHost {
  return {
    itemId: 'doc',
    api: { base: '/api', fetch: vi.fn(async () => Response.json(list())) },
    viewport: {
      get: () => ({ zoom: 1, offset: { x: 0, y: 0 } }),
      subscribe: () => () => undefined,
      setView: () => undefined,
    },
    canvasRoot: () => null,
    tab: 't1',
    tabName: (t) => t,
    showTab: () => true,
    fingerprint: () => 'same',
    selection: () => [],
    author: 'Grace',
  };
}

describe('the recorder’s length', () => {
  beforeEach(() => vi.stubGlobal('requestIdleCallback', undefined));

  it('is the server’s answer with Pro on, and the dock counts against it', async () => {
    const h = host(() => ({ walkthroughs: [], canRecord: true, limits: FREE }));
    const { result } = renderHook(() => useWalkthroughs(h));
    await waitFor(() => expect(result.current.limits).toEqual(FREE));
    expect(result.current.recorder.maxMs).toBe(FIVE);
    expect(result.current.menu.limits).toEqual(FREE);
    const recording = {
      ...result.current,
      recorder: { ...result.current.recorder, phase: { kind: 'recording', elapsed: 252_000 } },
    } as unknown as Walkthroughs;
    render(<RecordDock walkthroughs={recording} />);
    const bar = screen.getByRole('region', { name: 'Recording' });
    expect(bar.textContent).toContain('4:12 / 5:00');
    // Inside the last minute of five, not of ten.
    expect(bar.textContent).toContain('1 minute left');
  });

  it('is ten minutes with Pro off: a door that answers no limits', async () => {
    setProForTests(false);
    const h = host(() => ({ walkthroughs: [], canRecord: true }));
    const { result } = renderHook(() => useWalkthroughs(h));
    await waitFor(() => expect(result.current.canRecord).toBe(true));
    expect(result.current.limits).toBeNull();
    expect(result.current.recorder.maxMs).toBe(WALKTHROUGH_MAX_MS);
    const recording = {
      ...result.current,
      recorder: { ...result.current.recorder, phase: { kind: 'recording', elapsed: 252_000 } },
    } as unknown as Walkthroughs;
    render(<RecordDock walkthroughs={recording} />);
    const bar = screen.getByRole('region', { name: 'Recording' });
    expect(bar.textContent).toContain('4:12 / 10:00');
    expect(bar.textContent).not.toContain('1 minute left');
  });

  it('reads the server’s count again after a delete, so Record comes back', async () => {
    let stored = 5;
    const h = host(() => ({
      walkthroughs: [W],
      canRecord: true,
      limits: { ...FREE, stored },
    }));
    const { result } = renderHook(() => useWalkthroughs(h));
    await waitFor(() => expect(result.current.limits?.stored).toBe(5));
    stored = 4;
    await act(async () => {
      await result.current.remove('w1');
    });
    await waitFor(() => expect(result.current.limits?.stored).toBe(4));
  });
});
