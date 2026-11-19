// The editor's notices end to end (useInboxNotices.tsx, InboxNotice.tsx, InboxCountBadge.tsx; inbox-notices.md): a new
// row of each kind shows, rows arriving together group, the reader's own moves never show, a row shown or dismissed in
// one tab never shows in another, the Inbox list reading a row closes its notice, and the count.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { InboxResponse, InboxThread } from '@liveworkspace/index-client';
import { createNoticeCenter, NOTICE_SHOW_MS } from './center';
import { InboxCountBadge, inboxButtonLabel } from './InboxCountBadge';
import { createSeenStore, type SeenStore } from './seen';
import { useInboxNotices, type InboxNoticesOptions } from './useInboxNotices';
import type { InboxWatch } from './watch';

const ME = 'user_me';
const NOW = 50_000_000;

const thread = (over: Partial<InboxThread> = {}): InboxThread => ({
  app: 'livediagram',
  itemId: 'd1',
  itemTitle: 'Roadmap',
  itemTeamId: null,
  tabId: 't1',
  tabName: 'Q3',
  elementId: 'e1',
  elementLabel: 'Box',
  card: null,
  resolved: false,
  commentCount: 1,
  latestText: 'Can you check the totals?',
  latestAuthorName: 'Priya',
  latestAuthorColor: '#f00',
  latestAuthorId: 'user_p',
  mentionsYou: true,
  mentionedBy: { id: 'user_p', name: 'Priya' },
  youCommented: false,
  onYourItem: false,
  firstAt: NOW - 100,
  latestAt: NOW - 100,
  ...over,
});

// A watch whose answers the test hands in, as the page's would hear them.
function fakeWatch() {
  let data: InboxResponse | null = null;
  const listeners = new Set<() => void>();
  const watch: InboxWatch = {
    current: () => ({ data, at: data ? 1 : 0 }),
    touch: () => {},
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  const answer = (next: Partial<InboxResponse>) =>
    act(() => {
      data = { threads: [], actions: [], forms: [], ...next };
      listeners.forEach((l) => l());
    });
  return { watch, answer, listeners };
}

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

function Door(props: InboxNoticesOptions & { name?: string }) {
  const { count, notices } = useInboxNotices(props);
  return (
    <>
      <button type="button" className="relative" aria-label={inboxButtonLabel('Explorer', count)}>
        <InboxCountBadge count={count} />
      </button>
      {notices}
    </>
  );
}

function setup(over: Partial<InboxNoticesOptions> = {}) {
  const w = fakeWatch();
  const storage = memoryStorage();
  const seen = createSeenStore(ME, { storage, now: () => NOW - 1000, win: null });
  const center = createNoticeCenter();
  const onTelemetry = vi.fn();
  const props: InboxNoticesOptions = {
    client: {} as never,
    app: 'livediagram',
    viewerId: ME,
    watch: w.watch,
    seen,
    center,
    onTelemetry,
    now: () => NOW,
    ...over,
  };
  const view = render(<Door {...props} />);
  return { ...w, seen, center, onTelemetry, view, storage, props };
}

const notice = () => document.querySelector<HTMLElement>('[data-inbox-notice]');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a new row shows', () => {
  it('a mention: who and what, the quote, the place, Open in Inbox at the row', () => {
    const t = setup();
    t.answer({ threads: [thread()] });
    const card = notice()!;
    expect(card.textContent).toContain('Priya mentioned you');
    expect(card.textContent).toContain('“Can you check the totals?”');
    expect(card.textContent).toContain('Roadmap › Q3');
    const open = screen.getByRole('link', { name: 'Open in Inbox' });
    expect(open.getAttribute('href')).toBe('/explorer/inbox?at=t%3Alivediagram%3Ad1%3At1%3Ae1');
    expect(screen.getByRole('status').textContent).toBe('Priya mentioned you');
  });

  it('a card handed over, an access request and a share', () => {
    const t = setup();
    t.answer({
      actions: [
        {
          app: 'liveplanner',
          itemId: 'p1',
          itemTitle: 'Sprint',
          itemTeamId: null,
          tabId: '~cards',
          tabName: '',
          elementId: 'c1',
          actionId: 'c1',
          elementLabel: 'Card',
          name: 'Fix login',
          description: '',
          status: 'open',
          assigneeId: ME,
          assigneeName: 'Me',
          assignerId: 'user_b',
          assignerName: 'Bo',
          teamId: null,
          card: { key: 3, title: 'Fix login', type: 't', typeLabel: 'Task', board: null } as never,
          createdAt: NOW - 90,
          updatedAt: NOW - 90,
        },
      ],
    });
    expect(notice()!.textContent).toContain('Bo assigned you a card');
    expect(notice()!.textContent).toContain('Sprint › #3 Fix login');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    t.answer({
      accessRequests: [
        {
          id: 'r1',
          app: 'livediagram',
          itemId: 'd9',
          itemTitle: 'Budget',
          itemTeamId: null,
          requesterId: 'user_a',
          requesterName: 'Ana',
          note: null,
          askedAt: NOW - 50,
        },
      ],
    });
    expect(notice()!.textContent).toContain('Ana asked for access');
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/document/d9');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    t.answer({
      shares: [
        {
          id: 'r2',
          app: 'livediagram',
          itemId: 'd8',
          itemTitle: 'Poster',
          itemTeamId: null,
          sharedById: 'user_a',
          sharedByName: 'Ana',
          sharedAt: NOW - 40,
        },
      ],
    });
    expect(notice()!.textContent).toContain('Ana shared it with you');
    expect(notice()!.textContent).toContain('Poster');
  });

  it('rows arriving together are one notice, three listed and the rest counted', () => {
    const t = setup();
    t.answer({
      threads: [1, 2, 3, 4, 5].map((i) =>
        thread({
          elementId: `e${i}`,
          latestAt: NOW - i,
          latestAuthorName: `P${i}`,
          mentionedBy: null,
        }),
      ),
    });
    const card = notice()!;
    expect(card.textContent).toContain('5 New in Your Inbox');
    expect(card.querySelectorAll('li a')).toHaveLength(3);
    expect(card.textContent).toContain('and 2 more');
    expect(screen.getByRole('link', { name: 'Open Inbox' }).getAttribute('href')).toBe(
      '/explorer/inbox',
    );
    // A row arriving while it shows joins it.
    t.answer({
      threads: [0, 1, 2, 3, 4, 5].map((i) =>
        thread({
          elementId: `e${i}`,
          latestAt: NOW - i,
          latestAuthorName: `P${i}`,
          mentionedBy: null,
        }),
      ),
    });
    expect(notice()!.textContent).toContain('6 New in Your Inbox');
    expect(notice()!.querySelector('li a')!.textContent).toContain('P0 mentioned you');
  });
});

describe('never noise', () => {
  it('the reader’s own moves, and what was there when this browser first watched', () => {
    const t = setup();
    t.answer({
      threads: [thread({ latestAuthorId: ME }), thread({ elementId: 'old', latestAt: NOW - 5000 })],
    });
    expect(notice()).toBeNull();
  });

  it('nothing for a guest, or an app without an Inbox', () => {
    const guest = setup({ viewerId: null });
    expect(guest.listeners.size).toBe(0);
    cleanup();
    const huddle = setup({ app: 'livehuddle' });
    expect(huddle.listeners.size).toBe(0);
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeTruthy();
  });

  it('in a hidden tab it waits, and shows on coming back while still news', () => {
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const t = setup();
    t.answer({ threads: [thread()] });
    expect(notice()).toBeNull();
    hidden.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(notice()).not.toBeNull();
    hidden.mockRestore();
  });
});

describe('going away', () => {
  it('on its own after its time, held while the pointer is on it', () => {
    vi.useFakeTimers();
    const t = setup();
    t.answer({ threads: [thread()] });
    fireEvent.pointerEnter(notice()!);
    act(() => {
      vi.advanceTimersByTime(NOTICE_SHOW_MS * 2);
    });
    expect(notice()).not.toBeNull();
    fireEvent.pointerLeave(notice()!);
    act(() => {
      vi.advanceTimersByTime(NOTICE_SHOW_MS);
    });
    expect(notice()).toBeNull();
    expect(t.onTelemetry).not.toHaveBeenCalled();
    // Seen: the same row never shows again.
    t.answer({ threads: [thread()] });
    expect(notice()).toBeNull();
  });

  it('holds while focus is in it, and Escape dismisses', () => {
    vi.useFakeTimers();
    const t = setup();
    t.answer({ threads: [thread()] });
    const open = screen.getByRole('link', { name: 'Open in Inbox' });
    fireEvent.focus(open);
    act(() => {
      vi.advanceTimersByTime(NOTICE_SHOW_MS * 2);
    });
    expect(notice()).not.toBeNull();
    fireEvent.blur(open, { relatedTarget: screen.getByRole('button', { name: 'Dismiss' }) });
    fireEvent.keyDown(notice()!, { key: 'Enter' });
    expect(notice()).not.toBeNull();
    fireEvent.keyDown(notice()!, { key: 'Escape' });
    expect(notice()).toBeNull();
    expect(t.onTelemetry).toHaveBeenCalledWith('Removed');
    expect(t.seen.gone({ key: 't:livediagram:d1:t1:e1', at: NOW - 100 })).toBe(true);
  });

  it('following a link settles it', () => {
    const t = setup();
    t.answer({ threads: [thread()] });
    fireEvent.click(screen.getByRole('link', { name: 'Open in Inbox' }));
    expect(notice()).toBeNull();
    expect(t.onTelemetry).toHaveBeenCalledWith('Opened');
  });

  it('dismissed in one tab, it closes in another and never shows there', () => {
    // Two tabs of one address: one storage, and each hears the other's writes as storage events.
    const storage = memoryStorage();
    const heard = new Set<(e: StorageEvent) => void>();
    const win = {
      addEventListener: (_t: string, l: (e: StorageEvent) => void) => void heard.add(l),
      removeEventListener: (_t: string, l: (e: StorageEvent) => void) => void heard.delete(l),
    } as never;
    const here = createSeenStore(ME, { storage, now: () => NOW - 1000, win });
    const t = setup({ seen: here });
    t.answer({ threads: [thread()] });
    expect(notice()).not.toBeNull();
    const row = { key: 't:livediagram:d1:t1:e1', at: NOW - 100 };
    // The other tab heard the same answer: the row was seen here, so it shows nothing there.
    const there: SeenStore = createSeenStore(ME, { storage, now: () => NOW, win: null });
    expect(there.has(row)).toBe(true);
    // It is dismissed there (or read in its Inbox): this tab hears the write, and its notice closes.
    there.mark([row], true);
    const key = `liveworkspace:inbox-notices:${ME}`;
    act(() => heard.forEach((l) => l({ key, newValue: storage.getItem(key) } as StorageEvent)));
    expect(notice()).toBeNull();
  });

  it('signing out leaves no notice behind', () => {
    const t = setup();
    t.answer({ threads: [thread()] });
    expect(notice()).not.toBeNull();
    t.view.rerender(<Door {...t.props} viewerId={null} />);
    expect(notice()).toBeNull();
  });
});

describe('the count', () => {
  it('rides the button, its name saying it, 9+ past nine, nothing at 0', () => {
    const t = setup();
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeTruthy();
    t.answer({ threads: [thread({ latestAt: NOW - 5000 })] });
    expect(screen.getByRole('button', { name: 'Explorer, 1 in Inbox' })).toBeTruthy();
    expect(document.querySelector('[data-inbox-count]')!.textContent).toBe('1');
    t.answer({
      threads: Array.from({ length: 12 }, (_, i) =>
        thread({ elementId: `x${i}`, latestAt: NOW - 5000 }),
      ),
    });
    expect(screen.getByRole('button', { name: 'Explorer, 9+ in Inbox' })).toBeTruthy();
    t.answer({ threads: [] });
    expect(document.querySelector('[data-inbox-count]')).toBeNull();
  });

  it('one notice layer however many doors a page draws', () => {
    const t = setup();
    render(<Door {...t.props} />);
    t.answer({ threads: [thread()] });
    expect(document.querySelectorAll('[data-inbox-notice]')).toHaveLength(1);
  });
});

describe('where it hangs', () => {
  it('under the corner card, read on show and on resize', () => {
    const corner = document.createElement('div');
    corner.setAttribute('data-corner-actions', '');
    let bottom = 58;
    corner.getBoundingClientRect = () => ({ bottom }) as DOMRect;
    document.body.appendChild(corner);
    const t = setup();
    t.answer({ threads: [thread()] });
    expect(notice()!.style.top).toBe('66px');
    bottom = 70;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(notice()!.style.top).toBe('78px');
    corner.remove();
  });

  it('12px from the top with no corner card', () => {
    const t = setup();
    t.answer({ threads: [thread()] });
    expect(notice()!.style.top).toBe('12px');
    // The animation class carries the motion; reduced motion fades it only (explorer.css).
    expect(notice()!.className).toContain('lw-inbox-notice');
  });
});

describe('cost', () => {
  it('an answer of 200 rows, shown as one grouped notice, stays within budget', () => {
    const t = setup();
    const many = Array.from({ length: 200 }, (_, i) =>
      thread({ elementId: `p${i}`, latestAt: NOW - 1 - i, mentionedBy: null }),
    );
    const per =
      cpuMsOf(() => {
        for (let i = 0; i < 10; i++) {
          t.answer({ threads: many.map((r) => ({ ...r, latestAt: r.latestAt + i * 1000 })) });
        }
      }) / 10;
    expect(notice()!.querySelectorAll('li a')).toHaveLength(3);
    expect(per).toBeLessThan(cpuBudgetMs(40));
  });
});

describe('under a dialog', () => {
  it('waits while one is open, its time held, and shows when it closes', async () => {
    vi.useFakeTimers();
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    const t = setup();
    t.answer({ threads: [thread()] });
    expect(notice()).toBeNull();
    expect(t.center.current()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(NOTICE_SHOW_MS * 2);
    });
    expect(t.center.current()).not.toBeNull();
    dialog.remove();
    await act(async () => {
      await Promise.resolve();
    });
    expect(notice()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(NOTICE_SHOW_MS);
    });
    expect(notice()).toBeNull();
  });

  it('an open <dialog> holds it too, and one opening while it shows hides it', async () => {
    const t = setup();
    t.answer({ threads: [thread()] });
    expect(notice()).not.toBeNull();
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);
    await act(async () => {
      dialog.setAttribute('open', '');
      await Promise.resolve();
    });
    expect(notice()).toBeNull();
    await act(async () => {
      dialog.removeAttribute('open');
      await Promise.resolve();
    });
    expect(notice()).not.toBeNull();
    dialog.remove();
  });
});

describe('a mention of the reader', () => {
  it('quotes their name, not their handle', () => {
    const t = setup({ viewerName: 'Ada Quinn' });
    t.answer({ threads: [thread({ latestText: '@ada-quinn can you check?' })] });
    expect(notice()!.textContent).toContain('“@Ada Quinn can you check?”');
  });
});
