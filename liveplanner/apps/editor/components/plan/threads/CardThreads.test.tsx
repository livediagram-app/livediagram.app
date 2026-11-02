// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CardThreads } from './CardThreads';
import {
  card,
  comment,
  contextOf,
  fakeThreads,
  liveThreads,
  ME,
  PLAN,
  Provide,
  thread,
} from './thread-test-kit';

// A card's comment threads in the card panel (docs/specs/026-plan/items.md "Where it shows").
afterEach(cleanup);

const flush = () => act(async () => {});
// Every thread is closed when the card opens: its header opens it.
const openThread = (title: string | RegExp) =>
  fireEvent.click(
    screen.getByRole('button', {
      name: typeof title === 'string' ? new RegExp(`^${title}`) : title,
    }),
  );

function renderLive(threads = [thread('th-a')], extra = {}, opts = {}) {
  const live = liveThreads(threads, extra, opts);
  render(
    <live.Live>
      <CardThreads item={card()} />
    </live.Live>,
  );
  return live;
}

describe('with no threads', () => {
  it('invites a new thread, and a Viewer reads that there are none', () => {
    const { threads } = fakeThreads([]);
    render(
      <Provide value={contextOf(threads)}>
        <CardThreads item={card()} />
      </Provide>,
    );
    expect(screen.getByText('No threads yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New Thread' })).toBeTruthy();
    cleanup();
    render(
      <Provide value={contextOf(threads, { canComment: false })}>
        <CardThreads item={card()} />
      </Provide>,
    );
    expect(screen.getByText('No comments yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New Thread' })).toBeNull();
  });

  it('draws nothing outside a threads context', () => {
    const { container } = render(<CardThreads item={card()} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('starting a thread', () => {
  it('opens the starter with the title it will get, and starts it', async () => {
    const live = renderLive([]);
    fireEvent.click(screen.getByRole('button', { name: 'New Thread' }));
    const field = screen.getByRole('textbox', { name: 'Start a thread' });
    expect(screen.getByRole('button', { name: 'Start Thread' })).toHaveProperty('disabled', true);
    fireEvent.change(field, { target: { value: 'Basket empties after switching' } });
    expect(screen.getByText('Titled “Sam: Basket empties after switching”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start Thread' }));
    await flush();
    expect(live.acts).toEqual([
      { kind: 'start', itemId: 'card-1', text: 'Basket empties after switching' },
    ]);
    // The new thread, open, its reply composer ready.
    expect(screen.getByText('Sam: started')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Reply to “Sam: started”' })).toBeTruthy();
    expect(screen.getByText('1 Open')).toBeTruthy();
    // The starter is gone: the keyboard goes on into the new thread's reply box, never down to the page.
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Reply to “Sam: started”' }),
    );
  });

  it('cancels with Escape or Cancel', () => {
    renderLive([]);
    fireEvent.click(screen.getByRole('button', { name: 'New Thread' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Start a thread' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Start a thread' })).toBeNull();
    // Focus goes back to New Thread, as it would from a closed popover.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New Thread' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Thread' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('No threads yet')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New Thread' }));
  });
});

describe('the list', () => {
  const now = Date.now();
  const THREADS = [
    thread('th-old', { title: 'Older open', updatedAt: now - 3_600_000 }),
    thread('th-new', { title: 'Newest open', updatedAt: now - 1_000 }),
    thread('th-done', {
      title: 'Done one',
      resolved: true,
      resolvedBy: 'Bo',
      resolvedAt: now - 2_000,
      updatedAt: now - 2_000,
    }),
  ];

  it('puts open threads first, every one closed, and resolved ones under a closed disclosure', () => {
    renderLive(THREADS);
    expect(screen.getByText('2 Open')).toBeTruthy();
    const open = screen
      .getByRole('list', { name: 'Open threads' })
      .querySelectorAll('[data-thread]');
    expect([...open].map((li) => li.getAttribute('data-thread'))).toEqual(['th-new', 'th-old']);
    expect(screen.getByRole('button', { name: /^Newest open/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: /^Older open/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    const disclosure = screen.getByRole('button', { name: 'Resolved · 1' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Done one')).toBeNull();
    fireEvent.click(disclosure);
    expect(screen.getByText('Done one')).toBeTruthy();
    expect(screen.getByText('Resolved by Bo')).toBeTruthy();
  });

  it('opens and closes a thread from its header', () => {
    renderLive(THREADS);
    const older = screen.getByRole('button', { name: /^Older open/ });
    fireEvent.click(older);
    expect(older.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(older);
    expect(older.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes every thread again when the card is opened afresh', () => {
    const { threads } = fakeThreads(THREADS);
    const { rerender } = render(
      <Provide value={contextOf(threads)}>
        <CardThreads item={card()} />
      </Provide>,
    );
    openThread('Older open');
    expect(screen.getByRole('button', { name: /^Older open/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    rerender(
      <Provide value={contextOf(threads)}>
        <CardThreads item={card('card-2', 2)} />
      </Provide>,
    );
    rerender(
      <Provide value={contextOf(threads)}>
        <CardThreads item={card()} />
      </Provide>,
    );
    expect(screen.getByRole('button', { name: /^Older open/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('puts Resolve on the reply composer’s row, left of Reply, with no row of its own', () => {
    renderLive([THREADS[1]!]);
    openThread('Newest open');
    const resolve = screen.getByRole('button', { name: 'Resolve' });
    const reply = screen.getByRole('button', { name: 'Reply' });
    expect(resolve.parentElement).toBe(reply.parentElement);
    expect(resolve.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(resolve.closest('footer')).toBe(
      screen.getByRole('textbox', { name: /^Reply to/ }).closest('footer'),
    );
  });

  it('resolves a thread, moving it under Resolved, and reopens it', async () => {
    const live = renderLive([THREADS[1]!]);
    openThread('Newest open');
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await flush();
    expect(live.acts.at(-1)).toEqual({ kind: 'resolve', threadId: 'th-new', resolved: true });
    expect(screen.queryByRole('list', { name: 'Open threads' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resolved · 1' }));
    // A resolved thread takes no reply.
    expect(screen.queryByRole('textbox', { name: /^Reply to/ })).toBeNull();
    // Still open where it now sits, Reopen under its comments.
    expect(screen.getByRole('button', { name: /^Newest open/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    await flush();
    expect(live.acts.at(-1)).toEqual({ kind: 'resolve', threadId: 'th-new', resolved: false });
    expect(screen.getByRole('list', { name: 'Open threads' })).toBeTruthy();
  });

  it('opens and brings into view the thread a link names, the Resolved list too', async () => {
    const { threads } = fakeThreads(THREADS);
    const focused = { ...threads, focused: 'th-done' } as typeof threads;
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function () {
      scrolled.push(this.getAttribute('data-thread') ?? '');
    };
    render(
      <Provide value={contextOf(focused)}>
        <CardThreads item={card()} />
      </Provide>,
    );
    await act(async () => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(screen.getByText('Done one')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Done one/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(scrolled).toContain('th-done');
    expect(focused.focus).toHaveBeenCalledWith(null);
  });
});

describe('replying and comments', () => {
  it('posts a reply', async () => {
    const live = renderLive();
    openThread('Title of th-a');
    const field = screen.getByRole('textbox', { name: 'Reply to “Title of th-a”' });
    fireEvent.change(field, { target: { value: 'On it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    await flush();
    expect(live.acts).toEqual([{ kind: 'reply', threadId: 'th-a', text: 'On it' }]);
    expect(screen.getByText('On it')).toBeTruthy();
    expect(screen.getByText('2 comments')).toBeTruthy();
    // Replying keeps it open.
    expect(
      screen.getByRole('button', { name: /^Title of th-a/ }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('marks an agent’s comment and an edited one', () => {
    renderLive([
      thread('th-a', {
        comments: [comment('c1', { ai: true, editedAt: 5 })],
      }),
    ]);
    openThread('Title of th-a');
    expect(screen.getByText('Generated by AI')).toBeTruthy();
    expect(screen.getByText('· Edited')).toBeTruthy();
  });

  it('edits and deletes this person’s own comment; only an Editor deletes anyone’s', async () => {
    const mine = thread('th-a', {
      comments: [comment('c1'), comment('c2', { authorId: ME, text: 'Mine' })],
    });
    const live = renderLive([mine], { isEditor: false });
    openThread('Title of th-a');
    // Edit and Delete on their own comment only.
    expect(screen.getAllByRole('button', { name: 'Edit comment' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Delete comment' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
    const field = screen.getByRole('textbox', { name: 'Edit comment' });
    fireEvent.change(field, { target: { value: 'Mine, fixed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(live.acts.at(-1)).toEqual({
      kind: 'edit',
      threadId: 'th-a',
      commentId: 'c2',
      text: 'Mine, fixed',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    await flush();
    expect(live.acts.at(-1)).toEqual({ kind: 'delete', threadId: 'th-a', commentId: 'c2' });
    cleanup();
    renderLive([mine], { isEditor: true });
    openThread('Title of th-a');
    expect(screen.getAllByRole('button', { name: 'Delete comment' })).toHaveLength(2);
  });

  it('posts the typed reply, then resolves, from Comment and Resolve', async () => {
    const live = renderLive();
    openThread('Title of th-a');
    const field = screen.getByRole('textbox', { name: 'Reply to “Title of th-a”' });
    expect(screen.queryByRole('button', { name: 'Comment and Resolve' })).toBeNull();
    fireEvent.change(field, { target: { value: '  Fixed in 2.1  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment and Resolve' }));
    await flush();
    expect(live.acts).toEqual([
      { kind: 'reply', threadId: 'th-a', text: 'Fixed in 2.1' },
      { kind: 'resolve', threadId: 'th-a', resolved: true },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Resolved · 1' }));
    expect(screen.getByRole('list', { name: 'Resolved threads' })).toBeTruthy();
  });

  it('a blank box still only resolves', async () => {
    const live = renderLive();
    openThread('Title of th-a');
    fireEvent.change(screen.getByRole('textbox', { name: 'Reply to “Title of th-a”' }), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await flush();
    expect(live.acts).toEqual([{ kind: 'resolve', threadId: 'th-a', resolved: true }]);
  });

  it('does not resolve, and keeps the draft, when the reply is refused', async () => {
    const live = renderLive([thread('th-a')], {}, { refuse: true });
    openThread('Title of th-a');
    const field = screen.getByRole('textbox', { name: 'Reply to “Title of th-a”' });
    fireEvent.change(field, { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment and Resolve' }));
    await flush();
    expect(live.acts).toEqual([{ kind: 'reply', threadId: 'th-a', text: 'Keep me' }]);
    expect((field as HTMLTextAreaElement).value).toBe('Keep me');
    expect(screen.getByRole('list', { name: 'Open threads' })).toBeTruthy();
  });

  it('offers a Participant, who may reply and so resolve, the combined action; a Viewer neither', () => {
    renderLive([thread('th-a')], { isEditor: false, canComment: true });
    openThread('Title of th-a');
    fireEvent.change(screen.getByRole('textbox', { name: 'Reply to “Title of th-a”' }), {
      target: { value: 'Hi' },
    });
    expect(screen.getByRole('button', { name: 'Comment and Resolve' })).toBeTruthy();
    cleanup();
    renderLive([thread('th-a')], { isEditor: false, canComment: false });
    openThread('Title of th-a');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Resolve/ })).toBeNull();
  });

  it('gives a Viewer no composer, no Resolve and no menu', () => {
    renderLive([thread('th-a')], { canComment: false, isEditor: false });
    openThread('Title of th-a');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^More for the thread/ })).toBeNull();
  });
});

// docs/specs/012-collaboration/comment-reactions.md "On a card's comment threads".
describe('reactions', () => {
  it('reacts from the tray and takes it back from its chip, under this session’s key', async () => {
    const live = renderLive();
    openThread('Title of th-a');
    fireEvent.click(screen.getByRole('button', { name: 'Add Reaction' }));
    fireEvent.click(
      screen.getByRole('group', { name: 'Reactions' }).querySelector('[aria-label="Eyes"]')!,
    );
    await flush();
    expect(live.acts).toEqual([
      {
        kind: 'react',
        threadId: 'th-a',
        commentId: 'th-a-c1',
        emoji: 'eyes',
        on: true,
        key: 'k-me',
      },
    ]);
    const chip = screen.getByRole('button', { name: 'Eyes, 1' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip);
    await flush();
    expect(live.acts.at(-1)).toMatchObject({ kind: 'react', emoji: 'eyes', on: false });
    expect(screen.queryByRole('button', { name: /^Eyes/ })).toBeNull();
  });

  it('shows a Viewer who reacted, with nothing to press, and a resolved thread takes no new ones', () => {
    const reacted = comment('c1', { reactions: [{ emoji: 'heart', by: 'k-bo', name: 'Bo' }] });
    renderLive([thread('th-a', { comments: [reacted] })], { canComment: false, isEditor: false });
    openThread('Title of th-a');
    expect(screen.getByRole('button', { name: 'Heart, 1' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Add Reaction' })).toBeNull();
    cleanup();
    renderLive([thread('th-a', { comments: [reacted], resolved: true, resolvedBy: 'Bo' })]);
    fireEvent.click(screen.getByRole('button', { name: /^Resolved/ }));
    openThread(/^Title of th-a/);
    expect(screen.getByRole('button', { name: 'Heart, 1' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Add Reaction' })).toBeNull();
  });
});

describe('the ⋯ menu', () => {
  const openMenu = () =>
    fireEvent.click(screen.getByRole('button', { name: 'More for the thread “Title of th-a”' }));

  it('renames in place: Enter keeps it, Escape leaves it', async () => {
    const live = renderLive();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const field = screen.getByRole('textbox', { name: 'Thread title' });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(live.acts).toEqual([]);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Thread title' }), {
      target: { value: '  Promo   maths ' },
    });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Thread title' }), { key: 'Enter' });
    await flush();
    expect(live.acts).toEqual([{ kind: 'rename', threadId: 'th-a', title: 'Promo maths' }]);
    expect(screen.getByText('Promo maths')).toBeTruthy();
  });

  it('renames with F2 from the header', () => {
    renderLive();
    fireEvent.keyDown(screen.getByRole('button', { name: /^Title of th-a/ }), { key: 'F2' });
    expect(screen.getByRole('textbox', { name: 'Thread title' })).toBeTruthy();
  });

  it('deletes a thread of their own comments after a confirmation that counts its cards', async () => {
    const shared = thread('th-a', {
      comments: [comment('c1', { authorId: ME })],
      cards: [
        { projectId: PLAN, itemId: 'card-1', key: 1 },
        { projectId: PLAN, itemId: 'card-2', key: 2 },
        { projectId: 'other', itemId: 'x', key: 4, projectName: 'Sprint 12' },
      ],
    });
    const live = renderLive([shared]);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Thread…' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this thread?' });
    expect(confirm.textContent).toContain('It is on 3 cards, and goes from all of them.');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Thread' }));
    await flush();
    expect(live.acts).toEqual([{ kind: 'deleteThread', threadId: 'th-a' }]);
    expect(screen.getByText('No threads yet')).toBeTruthy();
  });

  // items.md "Deleting a thread": only a thread of one's own comments, Editors alike; else it is resolved.
  it('greys Delete Thread, saying to resolve, once anyone else has commented, for an Editor too', () => {
    for (const isEditor of [true, false]) {
      renderLive([thread('th-a', { createdBy: { name: 'Sam', color: '#000', authorId: ME } })], {
        isEditor,
      });
      openMenu();
      const row = screen.getByRole('menuitem', { name: 'Delete Thread…' });
      expect(row.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(row);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByText('Others have commented: resolve it instead.')).toBeTruthy();
      expect(screen.getByRole('menuitem', { name: 'Resolve' })).toBeTruthy();
      cleanup();
    }
    renderLive([thread('th-a', { comments: [comment('c1', { authorId: ME })] })], {
      isEditor: false,
    });
    openMenu();
    expect(
      screen.getByRole('menuitem', { name: 'Delete Thread…' }).getAttribute('aria-disabled'),
    ).toBeNull();
    expect(screen.queryByText('Others have commented: resolve it instead.')).toBeNull();
  });

  it('opens Add Thread to Card', () => {
    renderLive();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to Card…' }));
    expect(screen.getByRole('dialog', { name: 'Add Thread to Card' })).toBeTruthy();
  });

  it('keeps what was shown when a write is refused', async () => {
    const live = renderLive([thread('th-a')], {}, { refuse: true });
    openThread('Title of th-a');
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await flush();
    expect(live.acts).toHaveLength(1);
    expect(screen.getByRole('list', { name: 'Open threads' })).toBeTruthy();
  });
});
