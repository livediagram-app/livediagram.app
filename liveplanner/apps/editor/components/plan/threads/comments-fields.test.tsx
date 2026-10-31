// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemTypeDef } from '@liveplanner/items';
import { openCommentCounts, type CardThread } from '@liveplanner/project';
import { createThreadStore } from '@/hooks/plan/thread-store';
import { ItemPanel } from '../ItemPanel';
import { PlanCardFace } from '../PlanCardFace';
import { planPalette } from '../plan-palette';
import { ThreadCountsProvider } from './CardThreadsContext';
import { PLAN, card, comment, liveThreads, thread } from './thread-test-kit';

// A type's own Comments fields (docs/specs/026-plan/item-types.md "Comments and Votes fields"): a section in the card
// panel for each, listing only its threads, its New Thread starting one in it, and a face chip counting its own.
afterEach(cleanup);

const flush = () => act(async () => {});

const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#71717a',
  fields: ['title', 'description', 'comments', 'f-review'],
  custom: [{ id: 'f-review', label: 'Design Review', kind: 'comments' }],
  display: { detailed: { foot: ['comments', 'f-review'] } },
};

const PLAIN = thread('th-plain', { title: 'Plain chat' });
const REVIEW = thread('th-review', {
  title: 'Spacing is off',
  field: 'f-review',
  comments: [comment('r1'), comment('r2')],
});
// Started in a field the type no longer offers: shown under the built-in.
const STRAY = thread('th-stray', { title: 'From before', field: 'f-gone' });

function panel(threads: CardThread[], type: ItemTypeDef = TASK) {
  const live = liveThreads(threads);
  const noop = vi.fn();
  render(
    <live.Live>
      <ItemPanel
        item={card()}
        types={[type]}
        statuses={[]}
        people={[]}
        labels={[]}
        canEdit
        onSave={noop}
        onPatch={noop}
        onType={noop}
        onOpenItem={noop}
        onTrash={noop}
        onDuplicate={noop}
        onFlag={noop}
        onArchive={noop}
        onClose={noop}
        trail={[card()]}
        statusNames={new Map()}
      />
    </live.Live>,
  );
  return live;
}

// Each section's threads list, under its heading.
const sections = () =>
  Array.from(document.querySelectorAll('[data-card-threads]')).map((el) => el as HTMLElement);

describe('a card panel with more than one Comments field', () => {
  it('draws a section per field, under its name, each listing only its own threads', () => {
    panel([PLAIN, REVIEW, STRAY]);
    expect(screen.getByText('Comments')).toBeTruthy();
    expect(screen.getByText('Design Review')).toBeTruthy();
    const [builtIn, review] = sections();
    expect(sections()).toHaveLength(2);
    expect(within(builtIn!).getByText('Plain chat')).toBeTruthy();
    expect(within(builtIn!).getByText('From before')).toBeTruthy();
    expect(within(builtIn!).queryByText('Spacing is off')).toBeNull();
    expect(within(review!).getByText('Spacing is off')).toBeTruthy();
    expect(within(review!).queryByText('Plain chat')).toBeNull();
  });

  it('gives each section its own empty state and count', () => {
    panel([REVIEW]);
    const [builtIn, review] = sections();
    expect(within(builtIn!).getByText('No threads yet')).toBeTruthy();
    expect(within(review!).queryByText('No threads yet')).toBeNull();
  });

  it('starts a thread in the field whose New Thread was pressed', async () => {
    const live = panel([]);
    const [builtIn, review] = sections();
    fireEvent.click(within(review!).getByRole('button', { name: 'New Thread' }));
    fireEvent.change(within(review!).getByRole('textbox', { name: 'Start a thread' }), {
      target: { value: 'Check the margins' },
    });
    fireEvent.click(within(review!).getByRole('button', { name: 'Start Thread' }));
    await flush();
    fireEvent.click(within(builtIn!).getByRole('button', { name: 'New Thread' }));
    fireEvent.change(within(builtIn!).getByRole('textbox', { name: 'Start a thread' }), {
      target: { value: 'Hello' },
    });
    fireEvent.click(within(builtIn!).getByRole('button', { name: 'Start Thread' }));
    await flush();
    expect(live.acts).toEqual([
      { kind: 'start', itemId: 'card-1', text: 'Check the margins', field: 'f-review' },
      { kind: 'start', itemId: 'card-1', text: 'Hello' },
    ]);
  });
});

describe('a Comments field on the card face', () => {
  function face(threads: CardThread[], type: ItemTypeDef = TASK) {
    const store = createThreadStore();
    store.setCounts(openCommentCounts(threads, PLAN));
    render(
      <ThreadCountsProvider value={store}>
        <PlanCardFace
          item={card()}
          palette={planPalette('light', {})}
          fields={['comments']}
          typeOverride={type}
        />
      </ThreadCountsProvider>,
    );
    return store;
  }

  it('counts its own open threads’ comments, the built-in’s chip only the rest', () => {
    face([PLAIN, REVIEW, STRAY]);
    expect(screen.getByText('2 comments')).toBeTruthy();
    expect(screen.getByText('Design Review: 2 comments')).toBeTruthy();
  });

  it('follows the store as threads come and go, and shows nothing at none', () => {
    const store = face([PLAIN]);
    expect(screen.queryByText(/Design Review/)).toBeNull();
    act(() => store.setCounts(openCommentCounts([PLAIN, REVIEW], PLAN)));
    expect(screen.getByText('Design Review: 2 comments')).toBeTruthy();
    expect(screen.getByText('1 comment')).toBeTruthy();
  });

  it('gives a type without the built-in every unplaced thread under its first Comments field', () => {
    const ownOnly: ItemTypeDef = {
      ...TASK,
      fields: ['title', 'f-review'],
      display: { detailed: { foot: ['f-review'] } },
    };
    face([PLAIN, REVIEW], ownOnly);
    expect(screen.getByText('Design Review: 3 comments')).toBeTruthy();
  });
});
