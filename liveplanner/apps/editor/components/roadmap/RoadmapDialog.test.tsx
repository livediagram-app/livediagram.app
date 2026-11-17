// @vitest-environment jsdom
// docs/specs/026-plan/public-roadmap.md "Publish as Roadmap": the plan's roadmaps read fresh, the tab's board in its two
// states (Not published, Published), the defaults (triage columns hidden, Description, voting on), Publish Roadmap
// with the settings chosen, a change that saves at once and keeps the link (and goes back when the save fails), the
// suggestion form rules, Copy Link, Unpublish behind its confirm, the privacy note, the board picker, and the
// failures. The tab menu's row draws only with the door the host sets.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublishedRoadmap,
  RoadmapBoard,
  RoadmapsResponse,
  RoadmapSettings,
} from '@liveplanner/api-schema';
import { RoadmapDialog } from './RoadmapDialog';
import { RoadmapHost } from './RoadmapHost';
import { useRoadmapToolsItem } from './roadmap-tools-item';

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
    { status: 'inbox', name: 'Under Review', color: null },
    { status: 'todo', name: 'Planned', color: null },
    { status: 'doing', name: 'In Progress', color: null },
    { status: 'done', name: 'Shipped', color: null },
  ],
  types: [
    { id: 'feature', name: 'Feature', glyph: 'sparkles', color: 'violet' },
    { id: 'bug', name: 'Bug', glyph: 'sparkles', color: 'violet' },
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

const open = async (r: Partial<RoadmapsResponse>) => {
  client.readRoadmaps.mockResolvedValue({ roadmaps: [], boards: [BOARD], forms: FORMS, ...r });
  const onClose = vi.fn();
  render(<RoadmapDialog scope={SCOPE} startTabId="t1" onClose={onClose} />);
  await waitFor(() => expect(stateOf()).not.toBe('loading'));
  return onClose;
};
const stateOf = () =>
  document.querySelector('[data-roadmap-dialog-state]')!.getAttribute('data-roadmap-dialog-state');
// A column, type or field's switch. Columns, Card Types and Fields start closed, one open at a time, so this opens
// whichever holds it.
const chip = (label: string): HTMLElement => {
  // A row's name is its label, then its line of detail.
  const name = (n: string) => n.startsWith(label);
  const found = screen.queryByRole('switch', { name });
  if (found) return found;
  for (const head of document.querySelectorAll<HTMLElement>('[data-toggle-list] > button')) {
    if (head.getAttribute('aria-expanded') === 'true') continue;
    fireEvent.click(head);
    const shown = screen.queryByRole('switch', { name });
    if (shown) return shown;
  }
  return screen.getByRole('switch', { name });
};

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
      // Outside an editor no form can be made here, so it says how to take suggestions.
      screen.getByText(
        'Hide a column above to take suggestions: they wait there until you move them.',
      ),
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
    await open({ boards: [BOARD, OTHER], roadmaps: [live()] });
    const picker = screen.getByRole('group', { name: 'Board' });
    const pills = within(picker).getAllByRole('button');
    expect(pills.map((p) => p.textContent)).toEqual(['Product', 'Bugs']);
    expect(within(pills[0]!).getByLabelText('published')).toBeTruthy();
    fireEvent.click(pills[1]!);
    expect(stateOf()).toBe('draft');
    expect(pills[1]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(pills[0]!);
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
    render(<RoadmapDialog scope={SCOPE} startTabId="t1" onClose={vi.fn()} />);
    expect(await screen.findByText('Couldn’t load your roadmap.')).toBeTruthy();
    client.readRoadmaps.mockResolvedValue({ roadmaps: [], boards: [BOARD], forms: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(stateOf()).toBe('draft'));
  });
});

// The Tools row that opens it (roadmap-tools-item), in place of the old tab menu row.
function ToolsRow() {
  const item = useRoadmapToolsItem();
  return item ? (
    <button type="button" onClick={(e) => item.onSelect(e.currentTarget)}>
      {item.label}
    </button>
  ) : null;
}

describe('the Tools row', () => {
  it('shows only with a scope and a board on the plan, and opens the dialog', async () => {
    const { rerender } = render(
      <RoadmapHost scope={null} hasBoards activeTabId="t1">
        <ToolsRow />
      </RoadmapHost>,
    );
    expect(screen.queryByRole('button', { name: 'Publish as Roadmap' })).toBeNull();
    rerender(
      <RoadmapHost scope={SCOPE} hasBoards={false} activeTabId="t1">
        <ToolsRow />
      </RoadmapHost>,
    );
    expect(screen.queryByRole('button', { name: 'Publish as Roadmap' })).toBeNull();
    client.readRoadmaps.mockResolvedValue({ roadmaps: [], boards: [BOARD], forms: [] });
    rerender(
      <RoadmapHost scope={SCOPE} hasBoards activeTabId="t1">
        <ToolsRow />
      </RoadmapHost>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish as Roadmap' }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'Roadmap');
    await waitFor(() => expect(client.readRoadmaps).toHaveBeenCalledWith(SCOPE));
  });
});
