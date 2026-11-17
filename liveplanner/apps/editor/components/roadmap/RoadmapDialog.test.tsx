// @vitest-environment jsdom
// docs/specs/026-plan/public-roadmap.md "Publish as Roadmap": the plan's roadmaps read fresh, the tab's board in its two
// states (Not published, Published), the defaults (triage columns hidden, Description, voting on), Publish Roadmap
// with the settings chosen, a change that saves at once and keeps the link (and goes back when the save fails), the
// suggestion form rules, Copy Link, Unpublish behind its confirm, the privacy note, the board picker, and the
// failures. The tab menu's row draws only with the door the host sets.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { typeShowsVotes, type ItemTypeCatalogue, type ItemTypeDef } from '@liveplanner/items';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublishedRoadmap,
  RoadmapBoard,
  RoadmapsResponse,
  RoadmapSettings,
} from '@liveplanner/api-schema';
import { RoadmapDialog, namesOf } from './RoadmapDialog';
import { RoadmapHost } from './RoadmapHost';
import { RoadmapMenuRow } from './RoadmapMenuRow';

const client = vi.hoisted(() => ({
  readRoadmaps: vi.fn(),
  saveRoadmap: vi.fn(),
  unpublishRoadmap: vi.fn(),
}));
vi.mock('./roadmap-client', () => client);
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const SCOPE = { ownerId: 'user_1', projectId: 'p1' };
const BOARD: RoadmapBoard = {
  id: 'b1',
  title: 'Product',
  tabName: 'Board',
  tabId: 't1',
  columns: [
    { status: 'inbox', name: 'Under Review' },
    { status: 'todo', name: 'Planned' },
    { status: 'doing', name: 'In Progress' },
    { status: 'done', name: 'Shipped' },
  ],
  types: [
    { id: 'feature', name: 'Feature' },
    { id: 'bug', name: 'Bug' },
  ],
  publishable: true,
};
const OTHER: RoadmapBoard = { ...BOARD, id: 'b2', title: 'Bugs' };
const FORMS = [
  { code: 'f-hidden', heading: 'Suggest an Idea', tabName: 'Ideas', statuses: ['inbox'] },
  { code: 'f-shown', heading: 'Bug Report', tabName: 'Bugs', statuses: ['todo'] },
];
const CODE = 'lpr_AbCdEfGhIjKlMnOpQrStUv';
const DEFAULTS: RoadmapSettings = {
  title: 'Product',
  columns: ['todo', 'doing', 'done'],
  types: ['feature', 'bug'],
  fields: ['description'],
  voting: true,
  formCode: null,
};
const live = (s: Partial<RoadmapSettings> = {}): PublishedRoadmap => ({
  ...DEFAULTS,
  ...s,
  boardId: 'b1',
  code: CODE,
  path: `/roadmap/p1/${CODE}`,
  createdAt: 1,
});
const writeText = vi.fn();

const open = async (r: Partial<RoadmapsResponse>, boardIds: string[] = ['b1']) => {
  client.readRoadmaps.mockResolvedValue({ roadmaps: [], boards: [BOARD], forms: FORMS, ...r });
  const onClose = vi.fn();
  render(<RoadmapDialog scope={SCOPE} boardIds={boardIds} onClose={onClose} />);
  await waitFor(() => expect(stateOf()).not.toBe('loading'));
  return onClose;
};
const stateOf = () =>
  document.querySelector('[data-roadmap-dialog-state]')!.getAttribute('data-roadmap-dialog-state');
const chip = (name: string) => screen.getByRole('switch', { name });

beforeEach(() => {
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Not published', () => {
  it('starts with triage columns hidden, every type, Description and voting, and publishes them', async () => {
    await open({});
    expect(stateOf()).toBe('draft');
    expect(screen.getByText(/Anyone with the link can see the chosen columns/)).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Product');
    expect(chip('Under Review').getAttribute('aria-checked')).toBe('false');
    expect(chip('Planned').getAttribute('aria-checked')).toBe('true');
    expect(chip('Description').getAttribute('aria-checked')).toBe('true');
    expect(chip('Labels').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: /Voting/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(chip('Labels'));
    fireEvent.click(chip('Bug'));
    client.saveRoadmap.mockResolvedValue({ roadmap: live() });
    fireEvent.click(screen.getByRole('button', { name: 'Publish Roadmap' }));
    await waitFor(() => expect(stateOf()).toBe('published'));
    expect(client.saveRoadmap).toHaveBeenCalledWith(SCOPE, 'b1', {
      ...DEFAULTS,
      types: ['feature'],
      fields: ['description', 'labels'],
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'Roadmap');
  });

  it('keeps the last column and the last type ticked, and waits for a title', async () => {
    await open({});
    fireEvent.click(chip('Planned'));
    fireEvent.click(chip('In Progress'));
    expect((chip('Shipped') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(chip('Bug'));
    expect((chip('Feature') as HTMLButtonElement).disabled).toBe(true);
    const title = screen.getByLabelText<HTMLInputElement>('Title');
    fireEvent.change(title, { target: { value: '   ' } });
    fireEvent.blur(title);
    expect(title.value).toBe('Product');
    fireEvent.change(title, { target: { value: 'Public Roadmap' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    client.saveRoadmap.mockResolvedValue({ roadmap: live() });
    fireEvent.click(screen.getByRole('button', { name: 'Publish Roadmap' }));
    await waitFor(() => expect(client.saveRoadmap).toHaveBeenCalled());
    expect(client.saveRoadmap.mock.calls[0]![2]).toMatchObject({
      title: 'Public Roadmap',
      columns: ['done'],
      types: ['feature'],
    });
  });

  it('offers only a form whose cards land in a hidden column, and lets it go when that column shows', async () => {
    await open({});
    const select = screen.getByLabelText<HTMLSelectElement>('Suggest an Idea');
    const options = [...select.options];
    expect(options.map((o) => o.textContent)).toEqual([
      'None',
      'Suggest an Idea',
      'Bug Report (its cards would show on the roadmap at once)',
    ]);
    expect(options[2]!.disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'f-hidden' } });
    expect(select.value).toBe('f-hidden');
    expect(
      screen.getByText('Suggestions land in a hidden column until you move them.'),
    ).toBeTruthy();
    fireEvent.click(chip('Under Review'));
    expect(select.value).toBe('');
  });

  it('says so when the plan has no form to take suggestions', async () => {
    await open({ forms: [] });
    expect(
      screen.getByText('Publish a form whose cards land in a hidden column to take suggestions.'),
    ).toBeTruthy();
  });

  it('says a publish failed and stays as it was', async () => {
    await open({});
    client.saveRoadmap.mockRejectedValue(new Error('no'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish Roadmap' }));
    expect(await screen.findByText('Couldn’t save. Try again.')).toBeTruthy();
    expect(stateOf()).toBe('draft');
  });
});

describe('Published', () => {
  it('shows the live link to copy and open, and saves a change at once keeping the link', async () => {
    await open({ roadmaps: [live()] });
    expect(screen.getByText('Your roadmap is live.')).toBeTruthy();
    const url = `${window.location.origin}/roadmap/p1/${CODE}`;
    expect(screen.getByLabelText<HTMLInputElement>('Roadmap link').value).toBe(url);
    expect(screen.getByRole('link', { name: 'Open Roadmap' }).getAttribute('href')).toBe(url);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    expect(track).toHaveBeenCalledWith('Plan', 'Copied', 'Roadmap');
    client.saveRoadmap.mockResolvedValue({ roadmap: live({ voting: false }) });
    fireEvent.click(screen.getByRole('switch', { name: /Voting/ }));
    await waitFor(() => expect(client.saveRoadmap).toHaveBeenCalled());
    expect(client.saveRoadmap.mock.calls[0]![2]).toMatchObject({ voting: false });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'Roadmap');
  });

  it('puts a change back when its save fails', async () => {
    await open({ roadmaps: [live()] });
    client.saveRoadmap.mockRejectedValue(new Error('no'));
    fireEvent.click(chip('Labels'));
    expect(await screen.findByText('Couldn’t save. Try again.')).toBeTruthy();
    expect(chip('Labels').getAttribute('aria-checked')).toBe('false');
  });

  it('selects the link to copy by hand without a clipboard', async () => {
    await open({ roadmaps: [live()] });
    writeText.mockRejectedValue(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Roadmap link')));
  });

  it('unpublishes behind a confirm, back to Not published with the same settings', async () => {
    await open({ roadmaps: [live({ title: 'Kept' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    expect(screen.getByText('Unpublish this roadmap?')).toBeTruthy();
    client.unpublishRoadmap.mockResolvedValue(undefined);
    fireEvent.click(
      within(document.querySelector('[data-confirm-popover]') as HTMLElement).getByRole('button', {
        name: 'Unpublish',
      }),
    );
    await waitFor(() => expect(stateOf()).toBe('draft'));
    expect(client.unpublishRoadmap).toHaveBeenCalledWith(SCOPE, 'b1');
    expect(track).toHaveBeenCalledWith('Plan', 'Ended', 'Roadmap');
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Kept');
  });

  it('says an unpublish failed and keeps the link', async () => {
    await open({ roadmaps: [live()] });
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    client.unpublishRoadmap.mockRejectedValue(new Error('no'));
    fireEvent.click(
      within(document.querySelector('[data-confirm-popover]') as HTMLElement).getByRole('button', {
        name: 'Unpublish',
      }),
    );
    expect(await screen.findByText('Couldn’t save. Try again.')).toBeTruthy();
    expect(stateOf()).toBe('published');
  });
});

describe('boards', () => {
  it('picks among several boards on the tab, marking a published one', async () => {
    await open({ boards: [BOARD, OTHER], roadmaps: [live()] }, ['b2', 'b1']);
    const picker = screen.getByLabelText<HTMLSelectElement>('Board');
    expect([...picker.options].map((o) => o.textContent)).toEqual(['Bugs', 'Product (published)']);
    expect(stateOf()).toBe('draft');
    fireEvent.change(picker, { target: { value: 'b1' } });
    expect(stateOf()).toBe('published');
  });

  it('says an All Cards board has nothing to publish, and a tab whose board is not saved yet', async () => {
    const onClose = await open({ boards: [{ ...BOARD, publishable: false }] });
    expect(screen.getByText('This board has no columns to publish.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    cleanup();
    await open({ boards: [] });
    expect(stateOf()).toBe('no-board');
  });

  it('offers Try Again when the read fails', async () => {
    client.readRoadmaps.mockRejectedValueOnce(new Error('no'));
    render(<RoadmapDialog scope={SCOPE} boardIds={['b1']} onClose={vi.fn()} />);
    expect(await screen.findByText('Couldn’t load your roadmap.')).toBeTruthy();
    client.readRoadmaps.mockResolvedValue({ roadmaps: [], boards: [BOARD], forms: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(stateOf()).toBe('draft'));
  });
});

describe('the tab menu row', () => {
  it('draws only with a scope and a board on the tab, and opens the dialog', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <RoadmapHost scope={null} boardIds={['b1']}>
        <RoadmapMenuRow onClose={onClose} />
      </RoadmapHost>,
    );
    expect(screen.queryByText('Publish as Roadmap…')).toBeNull();
    rerender(
      <RoadmapHost scope={SCOPE} boardIds={[]}>
        <RoadmapMenuRow onClose={onClose} />
      </RoadmapHost>,
    );
    expect(screen.queryByText('Publish as Roadmap…')).toBeNull();
    client.readRoadmaps.mockResolvedValue({ roadmaps: [], boards: [BOARD], forms: [] });
    rerender(
      <RoadmapHost scope={SCOPE} boardIds={['b1']}>
        <RoadmapMenuRow onClose={onClose} />
      </RoadmapHost>,
    );
    fireEvent.click(screen.getByText('Publish as Roadmap…'));
    expect(onClose).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'Roadmap');
    expect(await screen.findByText('Publish as Roadmap')).toBeTruthy();
    await waitFor(() => expect(client.readRoadmaps).toHaveBeenCalledWith(SCOPE));
  });
});

// Add Votes (public-roadmap.md "The settings"): with Voting on, a chosen type whose cards would not show a vote is
// offered Votes, as one change to the plan's card types; the note goes once every chosen type shows them.
describe('Add Votes', () => {
  const type = (id: string, label: string, fields: string[]): ItemTypeDef => ({
    id,
    label,
    newTitle: `New ${label}`,
    glyph: 'task',
    color: '#000000',
    fields,
  });
  const FEATURE = type('feature', 'Feature', ['title', 'status']);
  const BUG = type('bug', 'Bug', ['title', 'status']);
  const saves = vi.fn();

  // The plan's card types as the editor keeps them: a save shows at once.
  function Harness({ types }: { types: ItemTypeDef[] }) {
    const [catalogue, setCatalogue] = useState<ItemTypeCatalogue>({ version: 1, types });
    return (
      <RoadmapDialog
        scope={SCOPE}
        boardIds={['b1']}
        onClose={vi.fn()}
        cardTypes={{
          catalogue,
          types: catalogue.types,
          saveCatalogue: (next) => {
            saves(next);
            setCatalogue(next);
          },
        }}
      />
    );
  }
  const openWith = async (types: ItemTypeDef[], r: Partial<RoadmapsResponse> = {}) => {
    client.readRoadmaps.mockResolvedValue({ roadmaps: [], boards: [BOARD], forms: [], ...r });
    render(<Harness types={types} />);
    await waitFor(() => expect(stateOf()).not.toBe('loading'));
  };
  const offer = () => document.querySelector('[data-roadmap-votes-offer]');

  it('offers Votes for the chosen types that lack them, and adds them as one change', async () => {
    await openWith([FEATURE, BUG, type('note', 'Note', ['title'])]);
    expect(offer()?.textContent).toContain('Feature and Bug cards don’t show votes yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Add Votes' }));
    expect(saves).toHaveBeenCalledTimes(1);
    const saved = saves.mock.calls[0]![0] as ItemTypeCatalogue;
    const byId = (id: string) => saved.types.find((t) => t.id === id)!;
    expect(typeShowsVotes(byId('feature'))).toBe(true);
    expect(typeShowsVotes(byId('bug'))).toBe(true);
    // A type the roadmap does not show is left as it was.
    expect(byId('note').fields).toEqual(['title']);
    expect(offer()).toBeNull();
    expect(screen.getByText('Feature and Bug cards now show their votes.')).toBeTruthy();
    // Nothing is published by it: the roadmap's settings are untouched.
    expect(client.saveRoadmap).not.toHaveBeenCalled();
  });

  it('names only the chosen types, and says nothing with Voting off or every type showing votes', async () => {
    await openWith([FEATURE, type('bug', 'Bug', ['title', 'status', 'votes'])]);
    expect(offer()?.textContent).toContain('Feature cards don’t show votes yet.');
    fireEvent.click(chip('Feature'));
    expect(offer()).toBeNull();
    fireEvent.click(chip('Feature'));
    expect(offer()).not.toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: /Voting/ }));
    expect(offer()).toBeNull();
    expect(saves).not.toHaveBeenCalled();
  });

  it('offers it on a published roadmap too, while its settings save as they change', async () => {
    await openWith([FEATURE, BUG], { roadmaps: [live({ types: ['bug'] })] });
    expect(stateOf()).toBe('published');
    expect(offer()?.textContent).toContain('Bug cards don’t show votes yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Add Votes' }));
    expect(screen.getByText('Bug cards now show their votes.')).toBeTruthy();
    expect(client.saveRoadmap).not.toHaveBeenCalled();
  });

  it('offers nothing without the plan’s card types', async () => {
    await open({});
    expect(offer()).toBeNull();
  });

  it('reaches the dialog from the host', async () => {
    client.readRoadmaps.mockResolvedValue({ roadmaps: [], boards: [BOARD], forms: [] });
    const catalogue: ItemTypeCatalogue = { version: 1, types: [FEATURE, BUG] };
    render(
      <RoadmapHost
        scope={SCOPE}
        boardIds={['b1']}
        itemTypes={{
          catalogue,
          types: catalogue.types,
          saveCatalogue: saves,
          saveType: vi.fn(),
          deleteType: vi.fn(),
          addTypes: vi.fn(),
          quietChange: vi.fn(),
          receive: vi.fn(),
        }}
      >
        <RoadmapMenuRow onClose={vi.fn()} />
      </RoadmapHost>,
    );
    fireEvent.click(screen.getByText('Publish as Roadmap…'));
    await waitFor(() => expect(offer()).not.toBeNull());
  });

  it('joins names as a sentence', () => {
    expect(namesOf([])).toBe('');
    expect(namesOf(['Project'])).toBe('Project');
    expect(namesOf(['Project', 'Bug', 'Task'])).toBe('Project, Bug and Task');
  });
});
