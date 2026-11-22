// @vitest-environment jsdom
// docs/specs/030-knowledgebase/page-reactions.md "Share roles", as the editor draws them: every signed-in reader (an
// Editor, a Participant, a Viewer) adds and takes back their own; a guest sees the reactions and presses nothing; the
// capsule, +N, the picker and the corners it stands in. The api's half is
// apps/api/src/routes/knowledge-reaction-routes.test.ts.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageReaction } from '@liveknowledge/api-schema';
import { reactionGroupsOf } from '@/lib/page-reactions/reaction-groups';

type Level = 'edit' | 'participate' | 'view';
const chrome = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));
const api = vi.hoisted(() => ({
  list: vi.fn(async (): Promise<PageReaction[]> => []),
  change: vi.fn(async () => ({})),
}));
const toastError = vi.hoisted(() => vi.fn());
const view = vi.hoisted(() => ({ current: 'pages', history: null as unknown }));

vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorChrome: (pick: (s: unknown) => unknown) => pick(chrome.state),
  useEditorChromeStore: () => ({ get: () => chrome.state }),
}));
vi.mock('@/lib/api/page-feedback', () => ({
  apiPageReactions: api.list,
  apiChangePageReaction: api.change,
}));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => ({ error: toastError }) }));
vi.mock('@/lib/page-threads/own-comment-key', () => ({
  ownCommentKey: async (id: string) => `key_${id}`,
}));
vi.mock('@/lib/knowledge-ask/useKnowledgeView', () => ({ useKnowledgeView: () => view.current }));
vi.mock('@/lib/version-history-store', () => ({ useVersionHistoryState: () => view.history }));

const { PageReactions, PageReactionsBesideZen, PageReactionsCapsule } =
  await import('./PageReactions');
const { reactionName } = await import('./ReactionSegment');

const PEOPLE: Record<Level | 'guest', { id: string; signedIn: boolean; mayEdit: boolean }> = {
  edit: { id: 'ed', signedIn: true, mayEdit: true },
  participate: { id: 'pa', signedIn: true, mayEdit: true },
  view: { id: 'vi', signedIn: true, mayEdit: false },
  guest: { id: 'guest_1', signedIn: false, mayEdit: false },
};

let page = 0;
function as(who: keyof typeof PEOPLE, extra: Record<string, unknown> = {}) {
  const p = PEOPLE[who];
  page += 1;
  chrome.state = {
    documentId: 'kb',
    activeId: `page-${page}`,
    selfParticipant: { id: p.id, name: `Name ${p.id}` },
    accountUserId: p.signedIn ? p.id : null,
    workbench: null,
    sessionShareCode: null,
    embedMode: false,
    zenMode: false,
    pageEditing: { mayEdit: p.mayEdit },
    ...extra,
  };
}

const clap = (by: string, name: string): PageReaction => ({ emoji: '👏', by, name });

beforeEach(() => {
  view.current = 'pages';
  view.history = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('reactions by role', () => {
  it.each(['edit', 'participate', 'view'] as const)(
    'lets a signed-in %s add a quick pick and take their own back',
    async (who) => {
      as(who);
      api.list.mockResolvedValueOnce([clap('key_someone', 'Sam')]);
      render(<PageReactions />);
      const clapSegment = await screen.findByRole('button', { name: 'Clap, 1' });
      expect(clapSegment.getAttribute('aria-pressed')).toBe('false');
      // Add Reaction opens the picker; a quick pick adds yours.
      await waitFor(() => screen.getByRole('button', { name: 'Add Reaction' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add Reaction' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Heart' }));
      await screen.findByRole('button', { name: 'Heart, 1' });
      expect(api.change).toHaveBeenLastCalledWith(expect.anything(), 'kb', `page-${page}`, {
        emoji: '❤️',
        on: true,
        name: `Name ${PEOPLE[who].id}`,
      });
      // Pressing the clap adds yours; pressing it again takes it back.
      fireEvent.click(screen.getByRole('button', { name: 'Clap, 1' }));
      const two = await screen.findByRole('button', { name: 'Clap, 2' });
      expect(two.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(two);
      await screen.findByRole('button', { name: 'Clap, 1' });
      expect(api.change).toHaveBeenLastCalledWith(expect.anything(), 'kb', `page-${page}`, {
        emoji: '👏',
        on: false,
        name: `Name ${PEOPLE[who].id}`,
      });
    },
  );

  it('shows a guest the reactions, and nothing to press', async () => {
    as('guest');
    api.list.mockResolvedValueOnce([clap('key_someone', 'Sam')]);
    render(<PageReactions />);
    const segment = await screen.findByRole('button', { name: 'Clap, 1' });
    expect(segment.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Add Reaction' })).toBeNull();
    fireEvent.click(segment);
    expect(api.change).not.toHaveBeenCalled();
  });

  it('shows a guest nothing at all on a page nobody reacted to', async () => {
    as('guest');
    const { container } = render(<PageReactions />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(container.innerHTML).toBe('');
  });

  it('puts a refused reaction back, with a toast in words', async () => {
    as('view');
    api.change.mockRejectedValueOnce(new Error('nope'));
    render(<PageReactions />);
    await waitFor(() => screen.getByRole('button', { name: 'Add Reaction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Reaction' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Eyes' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/could not/)),
    );
    expect(screen.queryByRole('button', { name: /^Eyes, / })).toBeNull();
  });
});

describe('where the capsule stands', () => {
  it('stands beside Zen only for someone who may not edit, and never in Zen, history or another view', async () => {
    as('view');
    const { container, unmount } = render(<PageReactionsBesideZen />);
    await screen.findByRole('group', { name: 'Reactions' });
    unmount();
    for (const set of [
      () => as('edit'),
      () => as('view', { zenMode: true }),
      () => as('view', { embedMode: true }),
      () => {
        as('view');
        view.history = {};
      },
      () => {
        as('view');
        view.current = 'ask';
      },
    ]) {
      set();
      const again = render(<PageReactionsBesideZen />);
      expect(again.container.innerHTML).toBe('');
      again.unmount();
    }
    expect(container.innerHTML).toBe('');
  });

  it('folds what does not fit into +N, which opens the picker with every emoji on the page', () => {
    const emoji = ['👏', '❤️', '👍', '🎉', '👀', '🚀'];
    const reactions = emoji.map((e) => ({ emoji: e, by: 'k', name: 'Sam' }));
    const toggle = vi.fn();
    render(
      <PageReactionsCapsule
        groups={reactionGroupsOf(reactions, null)}
        canReact={false}
        selfName="Me"
        onToggle={toggle}
        room={2}
      />,
    );
    expect(screen.getAllByRole('button', { name: /, 1$/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '4 More Reactions' }));
    const picker = document.querySelector('[data-reaction-picker]')!;
    expect(picker.querySelectorAll('[data-reaction-segment]')).toHaveLength(6);
    // A guest's picker says how to react instead of offering emoji.
    expect(picker.textContent).toContain('Sign in to react to a page.');
    expect(screen.getByRole('heading', { name: 'Reactions' })).toBeTruthy();
  });

  it('names one more reaction in the singular, and any emoji by the list or as a reaction', () => {
    const reactions = ['👏', '🚀'].map((e) => ({ emoji: e, by: 'k', name: 'Sam' }));
    render(
      <PageReactionsCapsule
        groups={reactionGroupsOf(reactions, null)}
        canReact
        selfName="Me"
        onToggle={vi.fn()}
        room={1}
      />,
    );
    expect(screen.getByRole('button', { name: '1 More Reaction' })).toBeTruthy();
    expect(reactionName('👏')).toBe('Clap');
    expect(reactionName('not an emoji')).toBe('Reaction');
  });

  it('searches every emoji in the picker, and a pick toggles it', async () => {
    const toggle = vi.fn();
    render(
      <PageReactionsCapsule
        groups={reactionGroupsOf([{ emoji: '🚀', by: 'me', name: 'Me' }], 'me')}
        canReact
        selfName="Me"
        onToggle={toggle}
        room={5}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Reaction' }));
    const search = screen.getByLabelText('Search Emoji');
    fireEvent.change(search, { target: { value: 'rocket' } });
    // The page's own rocket segment stands above the list; the list's rocket is the last.
    const rocket = (await screen.findAllByRole('button', { name: /rocket/i })).at(-1)!;
    fireEvent.pointerEnter(rocket);
    expect(document.querySelector('[data-reaction-preview]')!.textContent).toContain(
      'Yours: a pick takes it back',
    );
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(toggle).toHaveBeenCalledWith('🚀');
    fireEvent.click(screen.getByRole('button', { name: 'Add Reaction' }));
    fireEvent.change(screen.getByLabelText('Search Emoji'), {
      target: { value: 'zzzz-no-such-emoji' },
    });
    expect(await screen.findByText('No emoji match')).toBeTruthy();
  });
});
