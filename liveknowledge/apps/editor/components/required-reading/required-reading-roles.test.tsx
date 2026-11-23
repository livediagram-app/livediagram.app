// @vitest-environment jsdom
// docs/specs/030-knowledgebase/required-reading.md "Where it shows" and "Share roles", as the editor draws them. The
// api decides who may do what and sends names only to an Editor and the page's owner (its half is
// apps/api/src/routes/knowledge-reading-routes.test.ts); here each role's answer draws the right banner, Page Info
// section and presses, and nothing names anyone for a reader who may not see who has read it.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageReadingResponse } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';

const chrome = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const api = vi.hoisted(() => ({ read: vi.fn(), set: vi.fn(), press: vi.fn(), remind: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
const tracked = vi.hoisted(() => vi.fn());

vi.mock('@/app/document/[id]/EditorContext', async () => {
  const { createContext } = await import('react');
  return {
    EditorChromeContext: createContext(null),
    useEditorChrome: (pick: (s: unknown) => unknown) => pick(chrome.state),
    useEditorChromeStore: () => ({ get: () => chrome.state }),
  };
});
vi.mock('@/lib/api/page-reading', () => ({
  apiPageReading: api.read,
  apiSetPageReading: api.set,
  apiPressReading: api.press,
  apiRemindReaders: api.remind,
}));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/telemetry', () => ({ track: tracked }));

const { RequiredReadingBanner } = await import('./RequiredReadingBanner');
const { PageRailReading } = await import('./PageRailReading');
const { ReadAgainSwitch, ReadAgainToggle } = await import('./ReadAgainToggle');
const { EditorChromeContext } = await import('@/app/document/[id]/EditorContext');
const { RequiredReadingAsk } = await import('./RequiredReadingAsk');
const { askReading, clearReadingAsk, useReadingAsked } =
  await import('@/lib/required-reading/reading-asked');
const { readingStore } = await import('@/lib/required-reading/reading-store');

/** Whether the ask for p1 still stands, read as a component would. */
function readingAskedNow(): boolean {
  let asked = false;
  function Probe() {
    asked = useReadingAsked('p1');
    return null;
  }
  render(<Probe />).unmount();
  return asked;
}

const NOW = Date.UTC(2026, 10, 22, 12);
const REQUIRED = { audience: 'everyone' as const, askedAt: NOW - 86_400_000, round: 1 };
const PEOPLE = [
  { id: 'user_p', name: 'Priya' },
  { id: 'user_v', name: 'Vic', readAt: NOW - 3_600_000 },
];

/** What the api answers each role on a page asked of everyone (knowledge-reading-routes.ts answerOf). */
const ANSWER: Record<string, PageReadingResponse> = {
  editor: {
    required: REQUIRED,
    mine: { asked: true },
    progress: { done: 1, total: 2 },
    sees: true,
    manages: true,
    people: PEOPLE,
    email: true,
  },
  owner: {
    required: REQUIRED,
    mine: { asked: true },
    progress: { done: 1, total: 2 },
    sees: true,
    manages: false,
    people: PEOPLE,
    remindedAt: NOW - 2 * 86_400_000,
    email: true,
  },
  participant: {
    required: REQUIRED,
    mine: { asked: true },
    progress: { done: 1, total: 2 },
    sees: false,
    manages: false,
    email: true,
  },
  viewer: {
    required: REQUIRED,
    mine: { asked: true, readAt: NOW - 3_600_000 },
    progress: { done: 1, total: 2 },
    sees: false,
    manages: false,
    email: true,
  },
  guest: {
    required: REQUIRED,
    mine: { asked: false },
    progress: { done: 1, total: 2 },
    sees: false,
    manages: false,
    email: true,
  },
};

let doc = 0;
function as(answer: PageReadingResponse, editing = false) {
  doc += 1;
  chrome.state = {
    documentId: `kb-${doc}`,
    activeId: 'p1',
    tabs: [{ id: 'p1', name: 'Expenses' }],
    pageTab: { id: 'p1' },
    pageEditing: { editing },
    selfParticipant: { id: 'user_1', name: 'Ada' },
    accountUserId: 'user_1',
    sessionShareCode: null,
    commentMentions: { candidates: [{ userId: 'user_p', name: 'Priya' }] },
  };
  api.read.mockResolvedValue(answer);
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => {
  clearReadingAsk();
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const rail = async () => {
  render(<PageRailReading />);
  await waitFor(() => expect(api.read).toHaveBeenCalled());
};

describe('the banner', () => {
  it.each(['editor', 'owner', 'participant'])(
    'asks %s, who has not confirmed, and goes at once on I’ve Read This',
    async (role) => {
      as(ANSWER[role]!);
      api.press.mockResolvedValue({ ...ANSWER[role]!, mine: { asked: true, readAt: NOW } });
      render(<RequiredReadingBanner />);
      const banner = await screen.findByRole('region', { name: 'Required Reading' });
      expect(banner.textContent).toContain('Please read this page, then confirm you have.');
      fireEvent.click(within(banner).getByRole('button', { name: /I've Read This/ }));
      await waitFor(() =>
        expect(screen.queryByRole('region', { name: 'Required Reading' })).toBeNull(),
      );
      expect(api.press).toHaveBeenCalledWith(expect.anything(), `kb-${doc}`, 'p1', 'read');
      expect(toast.success).toHaveBeenCalledWith("Thanks. You've confirmed you read Expenses.");
      expect(tracked).toHaveBeenCalledWith('UI', 'Used', 'ReadConfirmed');
    },
  );

  it('says the page changed when everyone is asked again', async () => {
    as({
      ...ANSWER.participant!,
      required: { ...REQUIRED, round: 2, askedAt: Date.UTC(2026, 10, 14) },
    });
    render(<RequiredReadingBanner />);
    expect((await screen.findByRole('region')).textContent).toContain(
      'This page changed on 14 Nov. Please read it again, then confirm.',
    );
  });

  it('comes back with a toast in words when the api refuses', async () => {
    as(ANSWER.participant!);
    api.press.mockRejectedValue(new ApiError('x', 409, 'not_required'));
    render(<RequiredReadingBanner />);
    fireEvent.click(await screen.findByRole('button', { name: /I've Read This/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('This page is no longer Required Reading.'),
    );
    expect(screen.getByRole('region', { name: 'Required Reading' })).toBeTruthy();
  });

  it.each(['viewer', 'guest'])(
    'shows %s nothing: confirmed already, or not asked',
    async (role) => {
      as(ANSWER[role]!);
      const { container } = render(<RequiredReadingBanner />);
      await waitFor(() => expect(api.read).toHaveBeenCalled());
      await Promise.resolve();
      expect(container.textContent).toBe('');
    },
  );

  it('stands down while the page is edited', async () => {
    as(ANSWER.participant!, true);
    const { container } = render(<RequiredReadingBanner />);
    await waitFor(() => expect(api.read).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});

describe('Page Info', () => {
  it('shows an Editor who has and hasn’t read it, Remind and Change', async () => {
    as(ANSWER.editor!);
    await rail();
    const section = await screen.findByText('Not Yet', { exact: false });
    expect(section).toBeTruthy();
    expect(screen.getByText('1 of 2 have read it')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    const notYet = screen.getByRole('region', { name: 'Not Yet' });
    expect(within(notYet).getByText('Priya')).toBeTruthy();
    const read = screen.getByRole('region', { name: 'Read' });
    expect(within(read).getByText('Vic')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change Required Reading' })).toBeTruthy();
    api.remind.mockResolvedValue({ outcome: 'sent', sent: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Remind/ }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/^Reminded 1 person( to read “.+”)?\.$/),
      ),
    );
    expect(tracked).toHaveBeenCalledWith('UI', 'Used', 'ReadingReminded');
  });

  it('lists the first eight of a group, then shows the rest in place', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ id: `user_${i}`, name: `Person ${i}` }));
    as({ ...ANSWER.editor!, people: many, progress: { done: 0, total: 11 } });
    await rail();
    const group = await screen.findByRole('region', { name: 'Not Yet' });
    expect(within(group).getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(within(group).getByRole('button', { name: 'Show all 11' }));
    expect(within(group).getAllByRole('listitem')).toHaveLength(11);
  });

  it('draws nothing in an embed', async () => {
    as(ANSWER.editor!);
    chrome.state.embedMode = true;
    const { container } = render(<PageRailReading />);
    await Promise.resolve();
    expect(container.textContent).toBe('');
    expect(api.read).not.toHaveBeenCalled();
  });

  it('shows the page’s owner the people and Remind, never Change', async () => {
    as(ANSWER.owner!);
    await rail();
    expect(await screen.findByText('Priya')).toBeTruthy();
    expect(screen.getByText('Last reminded 2 days ago')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change Required Reading' })).toBeNull();
    api.remind.mockResolvedValue({ outcome: 'already_sent', nextAt: NOW + 1 });
    fireEvent.click(screen.getByRole('button', { name: /Remind/ }));
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith('Everyone not yet read was reminded this week.'),
    );
  });

  it.each(['participant', 'viewer', 'guest'])(
    'shows %s the counts and their own state, and nobody’s name',
    async (role) => {
      as(ANSWER[role]!);
      await rail();
      expect(await screen.findByText('1 of 2 have read it')).toBeTruthy();
      expect(screen.queryByText('Priya')).toBeNull();
      expect(screen.queryByText('Vic')).toBeNull();
      expect(screen.queryByRole('button', { name: /Remind/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Change Required Reading' })).toBeNull();
      if (role === 'participant')
        expect(screen.getByText("You haven't confirmed yet")).toBeTruthy();
      if (role === 'viewer') expect(screen.getByText(/You read it 22 Nov/)).toBeTruthy();
    },
  );

  // Owner 2026-11-23: "require reading should be in the page context menu until enabled, not always shown".
  it.each(['guest', 'editor'])(
    'draws nothing in Page Info on a page that is not required, even for an %s',
    async (role) => {
      as({ ...ANSWER[role]!, required: null, progress: null, people: [] });
      const { container } = render(<PageRailReading />);
      await waitFor(() => expect(api.read).toHaveBeenCalled());
      await act(async () => {});
      expect(container.textContent).toBe('');
    },
  );

  it('sets it up from the page menu’s ask, in a modal, and ends the ask', async () => {
    as({ ...ANSWER.editor!, required: null, progress: null, people: [] });
    const { container } = render(<RequiredReadingAsk />);
    // Not asked: no modal.
    expect(container.textContent).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => askReading('p1'));
    const dialog = await screen.findByRole('dialog', { name: 'Required Reading' });
    // Chosen People with nobody ticked can't be saved.
    fireEvent.click(within(dialog).getByRole('radio', { name: /Chosen People/ }));
    const save = within(dialog).getByRole<HTMLButtonElement>('button', {
      name: 'Require Reading',
    });
    expect(save.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Ada' }));
    expect(save.disabled).toBe(false);
    fireEvent.click(within(dialog).getByRole('radio', { name: /Everyone/ }));
    api.set.mockResolvedValue(ANSWER.editor);
    fireEvent.click(save);
    await waitFor(() =>
      expect(api.set).toHaveBeenCalledWith(expect.anything(), `kb-${doc}`, 'p1', {
        audience: 'everyone',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Expenses is Required Reading.');
    expect(tracked).toHaveBeenCalledWith('UI', 'Used', 'RequiredReadingSet');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readingAskedNow()).toBe(false);
  });

  it('puts the ask away on Cancel, saving nothing', async () => {
    as({ ...ANSWER.editor!, required: null, progress: null, people: [] });
    render(<RequiredReadingAsk />);
    act(() => askReading('p1'));
    const dialog = await screen.findByRole('dialog', { name: 'Required Reading' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.set).not.toHaveBeenCalled();
    expect(readingAskedNow()).toBe(false);
  });

  it('offers a page that turned out to be required already its Save and Stop Requiring', async () => {
    as(ANSWER.editor!);
    render(<RequiredReadingAsk />);
    act(() => askReading('p1'));
    const dialog = await screen.findByRole('dialog', { name: 'Required Reading' });
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Stop Requiring' })).toBeTruthy();
  });

  it.each(['participant', 'viewer', 'guest'])(
    'ends the ask quietly for a %s, whom the api does not let set it up',
    async (role) => {
      as({ ...ANSWER[role]!, required: null, progress: null });
      render(<RequiredReadingAsk />);
      act(() => askReading('p1'));
      await waitFor(() => expect(api.read).toHaveBeenCalled());
      await waitFor(() => expect(readingAskedNow()).toBe(false));
      expect(screen.queryByRole('dialog')).toBeNull();
    },
  );

  it('lets an Editor choose people and stop requiring', async () => {
    as({ ...ANSWER.editor!, required: { ...REQUIRED, audience: 'people' }, chosen: ['user_p'] });
    await rail();
    fireEvent.click(await screen.findByRole('button', { name: 'Change Required Reading' }));
    const dialog = await screen.findByRole('dialog', { name: 'Required Reading' });
    expect(within(dialog).getByRole<HTMLInputElement>('checkbox', { name: 'Priya' }).checked).toBe(
      true,
    );
    api.set.mockResolvedValue({ ...ANSWER.editor!, required: null, progress: null, people: [] });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stop Requiring' }));
    await waitFor(() =>
      expect(api.set).toHaveBeenCalledWith(expect.anything(), `kb-${doc}`, 'p1', {
        audience: null,
      }),
    );
    expect(tracked).toHaveBeenCalledWith('UI', 'Used', 'RequiredReadingStopped');
    // Stopped: Page Info shows nothing of it, and the page menu offers Require Reading again (its row reads this).
    await waitFor(() => expect(document.querySelector('[data-page-reading]')).toBeNull());
    expect(readingStore.entryOf(`kb-${doc}`, 'p1').reading.required).toBeNull();
  });

  it('keeps the panel open with a toast when the api refuses a change', async () => {
    as({ ...ANSWER.editor! });
    await rail();
    fireEvent.click(await screen.findByRole('button', { name: 'Change Required Reading' }));
    api.set.mockRejectedValue(new ApiError('x', 409, 'reading_pages_full'));
    const dialog = await screen.findByRole('dialog', { name: 'Required Reading' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'This knowledgebase has as many Required Reading pages as it can hold.',
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Required Reading' })).toBeTruthy();
  });
});

describe('Ask Everyone to Read Again', () => {
  it('draws nothing outside a page tab, and nothing without the editor', () => {
    as(ANSWER.editor!, true);
    delete chrome.state.pageTab;
    const store = { get: () => chrome.state } as never;
    const { container } = render(
      <EditorChromeContext.Provider value={store}>
        <ReadAgainToggle />
      </EditorChromeContext.Provider>,
    );
    expect(container.textContent).toBe('');
    const bare = render(<ReadAgainToggle />);
    expect(bare.container.textContent).toBe('');
  });

  it('offers the switch to an Editor editing a Required Reading page', async () => {
    as(ANSWER.editor!, true);
    const store = { get: () => chrome.state } as never;
    render(
      <EditorChromeContext.Provider value={store}>
        <ReadAgainToggle />
      </EditorChromeContext.Provider>,
    );
    const toggle = await screen.findByRole('switch', { name: 'Ask Everyone to Read Again' });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(
        screen
          .getByRole('switch', { name: 'Ask Everyone to Read Again' })
          .getAttribute('aria-checked'),
      ).toBe('true'),
    );
  });

  it('is a switch named for what it does', () => {
    const onChange = vi.fn();
    render(<ReadAgainSwitch on={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Ask Everyone to Read Again' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
