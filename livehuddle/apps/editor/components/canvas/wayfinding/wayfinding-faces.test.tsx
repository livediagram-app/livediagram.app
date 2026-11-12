// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type Element } from '@livehuddle/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { createWayfindingStore, type Wayfinding } from './wayfinding-store';
import { DirectoryList } from './DirectoryFace';
import { ElevatorPanel } from './ElevatorFace';
import { FLOOR_WAIT_MS } from './useFloorsOnOpen';
import { WayfindingPopover } from './WayfindingPopover';
import { LazyWayfindingPopover } from './wayfinding-panel-parts';
import { elevatorExitPoint } from '@/lib/wayfinding';

// The panels' card loads the first time one opens (web-performance.md "A piece's panel"): fetched ahead here, as a
// hover on the face does, so it draws in the press's own commit.
beforeAll(() => LazyWayfindingPopover.preload());

// docs/specs/009-elements/directory.md and elevator.md: the list and the floor panel, and that every role may
// press both (docs/specs/013-workspace/share-roles.md: an Editor, a Participant and a Viewer all walk and travel).

const at = (kind: Parameters<typeof createShape>[0], x: number, y: number, over = {}) =>
  ({ ...createShape(kind, x, y), id: `${kind}-${x}-${y}`, ...over }) as Element;

function makeWayfinding(): Wayfinding & {
  walkThere: ReturnType<typeof vi.fn>;
  go: ReturnType<typeof vi.fn>;
} {
  const store = createWayfindingStore();
  const walkThere = vi.fn();
  const go = vi.fn();
  return {
    store,
    actions: { walkThere, go, loadFloors: vi.fn(), closePanel: vi.fn(), climb: vi.fn() },
    walkThere,
    go,
  };
}

const room = at('room', 0, 0, { label: 'Design' });
const pod = at('office-pod', 0, 600);
const tabs = [
  { id: 'a', name: 'Lobby', elements: [room, pod, at('elevator', 800, 0)] },
  {
    id: 'b',
    name: 'Roof',
    elements: [at('room', 0, 0, { label: '' }), at('elevator', 0, 400), at('elevator', 400, 400)],
  },
  { id: 'c', name: 'Garden', elements: [] },
];

describe('the Directory list', () => {
  it('groups places by tab, this floor first, with who is in each and Around', () => {
    const w = makeWayfinding();
    w.store.set({
      tabs,
      activeTabId: 'a',
      people: [
        { id: 'me', name: 'Ada Lovelace', color: '#f00', tabId: 'a', placeId: room.id, self: true },
        { id: 'p', name: 'Pat', color: '#0f0', tabId: 'a', placeId: null },
        { id: 'r', name: 'Rae', color: '#00f', tabId: 'b', placeId: null },
      ],
    });
    render(<DirectoryList wayfinding={w} onDone={vi.fn()} />);
    const lobby = screen.getByRole('region', { name: 'Lobby' });
    expect(within(lobby).getByText('This Floor')).toBeTruthy();
    expect(within(lobby).getByText('Design')).toBeTruthy();
    expect(within(lobby).getByText('Office Pod 1')).toBeTruthy();
    expect(within(lobby).getByText('Room · 1 here')).toBeTruthy();
    expect(within(lobby).getByText('Around')).toBeTruthy();
    expect(within(lobby).getByLabelText('Pat')).toBeTruthy();
    const roof = screen.getByRole('region', { name: 'Roof' });
    expect(within(roof).getByText('Room 1')).toBeTruthy();
    expect(within(roof).getByText('On This Floor')).toBeTruthy();
    // Walk There only on this floor.
    expect(within(roof).queryByRole('button', { name: /Walk to/ })).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'Garden' })).getByText('No rooms on this floor'),
    ).toBeTruthy();
  });

  it('Walk There walks, Go jumps (switching tab), and both close the list', () => {
    const w = makeWayfinding();
    const done = vi.fn();
    w.store.set({ tabs, activeTabId: 'a' });
    render(<DirectoryList wayfinding={w} onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Walk to Design' }));
    expect(w.walkThere).toHaveBeenCalledWith(expect.objectContaining({ id: room.id }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to Room 1' }));
    expect(w.go).toHaveBeenCalledWith({ tabId: 'b', point: expect.any(Object) });
    expect(done).toHaveBeenCalledTimes(2);
  });

  it('says so when the space has no rooms', () => {
    const w = makeWayfinding();
    w.store.set({ tabs: [{ id: 'a', name: 'Lobby', elements: [] }], activeTabId: 'a' });
    render(<DirectoryList wayfinding={w} onDone={vi.fn()} />);
    expect(screen.getByText('No Rooms Yet')).toBeTruthy();
  });

  it('follows presence changes', () => {
    const w = makeWayfinding();
    w.store.set({ tabs, activeTabId: 'a' });
    render(<DirectoryList wayfinding={w} onDone={vi.fn()} />);
    expect(screen.getAllByText('Room · Empty').length).toBe(1);
    act(() =>
      w.store.set({
        people: [{ id: 'p', name: 'Pat', color: '#0f0', tabId: 'a', placeId: room.id }],
      }),
    );
    expect(screen.getByText('Room · 1 here')).toBeTruthy();
  });
});

describe('the Elevator panel', () => {
  it("lists this floor's other Elevators first, then each floor's, named or numbered", () => {
    const w = makeWayfinding();
    const lobby = {
      id: 'a',
      name: 'Lobby',
      elements: [
        at('elevator', 0, 0),
        at('elevator', 400, 0, { label: 'Service Lift' }),
        at('elevator', 800, 0),
      ],
    };
    w.store.set({ tabs: [lobby, tabs[1]!, tabs[2]!], activeTabId: 'a' });
    render(
      <ElevatorPanel elementId="elevator-0-0" name="Elevator 1" wayfinding={w} onDone={vi.fn()} />,
    );
    const here = screen.getByRole('region', { name: 'This Floor, Lobby' });
    expect(within(here).getByText('You Are Here')).toBeTruthy();
    // The one opened is not offered; the others are, named, else numbered among the unnamed.
    expect(within(here).queryByText('Elevator 1')).toBeNull();
    expect(within(here).getByText('Service Lift')).toBeTruthy();
    expect(within(here).getByText('Elevator 2')).toBeTruthy();
    const roof = screen.getByRole('region', { name: 'Roof' });
    expect(
      within(roof)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Go to Elevator 1 on Roof', 'Go to Elevator 2 on Roof']);
    expect(
      within(screen.getByRole('region', { name: 'Garden' })).getByText('No Elevator on this floor'),
    ).toBeTruthy();
  });

  // elevator.md "The panel" "Floors not opened yet": a lazy tab's Elevators are fetched on opening, not guessed.
  it('fetches floors nobody has opened, shows them loading, then rides to their named Elevator', () => {
    const w = makeWayfinding();
    const unopened = { ...tabs[1]!, elements: [], loaded: false };
    w.store.set({ tabs: [tabs[0]!, unopened, tabs[2]!], activeTabId: 'a' });
    render(
      <ElevatorPanel
        elementId="elevator-800-0"
        name="Elevator 1"
        wayfinding={w}
        onDone={vi.fn()}
      />,
    );
    expect(w.actions.loadFloors).toHaveBeenCalledOnce();
    const roof = () => screen.getByRole('region', { name: 'Roof' });
    expect(within(roof()).getByText('Loading this floor')).toBeTruthy();
    expect(within(roof()).queryByText('No Elevator on this floor')).toBeNull();
    // The fetch lands: the floor's Elevators, by name, and Go steps out of the one chosen.
    act(() => w.store.set({ tabs: [tabs[0]!, tabs[1]!, tabs[2]!] }));
    expect(within(roof()).queryByText('Loading this floor')).toBeNull();
    fireEvent.click(within(roof()).getByRole('button', { name: 'Go to Elevator 2 on Roof' }));
    expect(w.go).toHaveBeenLastCalledWith({
      tabId: 'b',
      point: elevatorExitPoint({ x: 400, y: 400, width: 112, height: 140 }),
      ignoreId: 'elevator-400-400',
    });
  });

  it('fetches nothing when every floor is loaded, and gives up waiting on a floor that never lands', () => {
    vi.useFakeTimers();
    try {
      const loaded = makeWayfinding();
      loaded.store.set({ tabs, activeTabId: 'a' });
      const first = render(
        <ElevatorPanel
          elementId="elevator-800-0"
          name="Elevator 1"
          wayfinding={loaded}
          onDone={vi.fn()}
        />,
      );
      expect(loaded.actions.loadFloors).not.toHaveBeenCalled();
      first.unmount();
      const w = makeWayfinding();
      w.store.set({ tabs: [tabs[0]!, { ...tabs[2]!, loaded: false }], activeTabId: 'a' });
      render(
        <ElevatorPanel
          elementId="elevator-800-0"
          name="Elevator 1"
          wayfinding={w}
          onDone={vi.fn()}
        />,
      );
      const garden = () => screen.getByRole('region', { name: 'Garden' });
      expect(within(garden()).getByText('Loading this floor')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(FLOOR_WAIT_MS);
      });
      expect(within(garden()).getByText('No Elevator on this floor')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('travels to an Elevator on the same floor without changing tab, and to one on another floor', () => {
    const w = makeWayfinding();
    const done = vi.fn();
    w.store.set({ tabs, activeTabId: 'b' });
    render(
      <ElevatorPanel elementId="elevator-0-400" name="Elevator 1" wayfinding={w} onDone={done} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go to Elevator 2' }));
    expect(w.go).toHaveBeenLastCalledWith({
      tabId: 'b',
      // In front of its doors, below its name (elevator.md "Where a floor arrives").
      point: elevatorExitPoint({ x: 400, y: 400, width: 112, height: 140 }),
      ignoreId: 'elevator-400-400',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go to Elevator 1 on Lobby' }));
    expect(w.go).toHaveBeenLastCalledWith(
      expect.objectContaining({ tabId: 'a', ignoreId: 'elevator-800-0' }),
    );
    expect(done).toHaveBeenCalledTimes(2);
  });

  it('explains a one-floor space', () => {
    const w = makeWayfinding();
    w.store.set({ tabs: [tabs[0]!], activeTabId: 'a' });
    render(<ElevatorPanel elementId="x" name="Elevator" wayfinding={w} onDone={vi.fn()} />);
    expect(screen.getByText(/This space has one floor/)).toBeTruthy();
  });
});

function faceFor(kind: 'directory' | 'elevator', readOnly: boolean, wayfinding: Wayfinding) {
  const element = { ...createShape(kind, 0, 0), id: `${kind}-1` } as BoxedElement;
  render(
    <BoxedElementView
      element={element}
      isSelected={false}
      isEditing={false}
      isPaintMode={false}
      showHandles={false}
      showAnchors={false}
      onBeginDrag={vi.fn()}
      onBeginEdit={vi.fn()}
      onCommitLabel={vi.fn()}
      onCancelEdit={vi.fn()}
      onFollowLink={vi.fn()}
      onContextSelect={vi.fn()}
      onEnterPortal={() => ({ targetName: null, wayfinding })}
      tabSummaries={[]}
      readOnly={readOnly}
      remoteSelectors={[]}
    />,
  );
}

describe('every role may press them', () => {
  it.each([
    ['an Editor', false],
    ['a Participant or a Viewer', true],
  ])('%s opens the Directory and the Elevator', (_who, readOnly) => {
    const w = makeWayfinding();
    w.store.set({ tabs, activeTabId: 'a' });
    faceFor('directory', readOnly, w);
    fireEvent.click(screen.getByRole('button', { name: 'Directory' }));
    expect(screen.getByRole('dialog', { name: 'Directory' })).toBeTruthy();
    faceFor('elevator', readOnly, w);
    fireEvent.click(screen.getByRole('button', { name: 'Elevator' }));
    expect(screen.getByRole('dialog', { name: 'Elevator' })).toBeTruthy();
  });

  it('a walk-in opens the Elevator panel through the store', () => {
    const w = makeWayfinding();
    w.store.set({ tabs, activeTabId: 'a' });
    faceFor('elevator', true, w);
    expect(screen.queryByRole('dialog', { name: 'Elevator' })).toBeNull();
    act(() => w.store.set({ openPanelId: 'elevator-1' }));
    expect(screen.getByRole('dialog', { name: 'Elevator' })).toBeTruthy();
  });
});

// docs/specs/009-elements/directory.md "Pressing it": the Directory stays open until it is closed on purpose.
describe('a pinned popover', () => {
  const open = (pinned: boolean) => {
    const onClose = vi.fn();
    render(
      <WayfindingPopover
        elementId="dir"
        label="Directory"
        width={320}
        pinned={pinned}
        onClose={onClose}
      >
        <p>Rooms</p>
      </WayfindingPopover>,
    );
    return onClose;
  };

  it('stays open through a press on the canvas, where an unpinned one closes', () => {
    const pinned = open(true);
    fireEvent.pointerDown(document.body);
    expect(pinned).not.toHaveBeenCalled();
  });

  it('closes on a press outside when not pinned', () => {
    const unpinned = open(false);
    fireEvent.pointerDown(document.body);
    expect(unpinned).toHaveBeenCalledTimes(1);
  });

  it('takes Escape for itself, so the editor never leaves Avatar mode on it', () => {
    const onClose = open(true);
    const editor = vi.fn();
    window.addEventListener('keydown', editor);
    fireEvent.keyDown(window, { key: 'Escape' });
    window.removeEventListener('keydown', editor);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(editor).not.toHaveBeenCalled();
  });

  it('shows a Close button in the Directory header', () => {
    const done = vi.fn();
    const w = makeWayfinding();
    w.store.set({ tabs, activeTabId: 'a' });
    render(<DirectoryList wayfinding={w} onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close Directory' }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
