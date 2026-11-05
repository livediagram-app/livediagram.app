// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type Element } from '@livehuddle/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { createWayfindingStore, type Wayfinding } from './wayfinding-store';
import { DirectoryList } from './DirectoryFace';
import { ElevatorPanel } from './ElevatorFace';

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
  return { store, actions: { walkThere, go, closeElevator: vi.fn() }, walkThere, go };
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
      point: { x: 456, y: 576 },
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
      onCommitTable={vi.fn()}
      onCancelEdit={vi.fn()}
      onFollowLink={vi.fn()}
      onOpenComments={vi.fn()}
      onOpenAction={vi.fn()}
      onOpenNote={vi.fn()}
      onSetPageHeading={vi.fn()}
      onContextSelect={vi.fn()}
      onEnterPortal={() => ({ targetName: null, wayfinding })}
      tabLocked={false}
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
    act(() => w.store.set({ openElevatorId: 'elevator-1' }));
    expect(screen.getByRole('dialog', { name: 'Elevator' })).toBeTruthy();
  });
});
