// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type ShapeElement } from '@livehuddle/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { stairsFlights, type WayTab } from '@/lib/wayfinding';
import { createWayfindingStore, type Wayfinding } from './wayfinding-store';
import { StairsFace, StairsPanel } from './StairsFace';
import { FLOOR_WAIT_MS } from './useFloorsOnOpen';

// docs/specs/009-elements/stairs.md "The panel", and that every role may take them
// (docs/specs/013-workspace/share-roles.md: an Editor, a Participant and a Viewer all walk and travel).

const at = (kind: Parameters<typeof createShape>[0], x: number, y: number) =>
  ({ ...createShape(kind, x, y), id: `${kind}-${x}-${y}` }) as ShapeElement;

const stairs = { ...at('stairs', 0, 0), id: 'stairs-1' } as ShapeElement;
const TABS: WayTab[] = [
  { id: 'g', name: 'Ground', elements: [stairs] },
  { id: 'l2', name: 'Level 2', elements: [at('stairs', 0, 0)] },
  { id: 'l3', name: 'Roof', elements: [at('elevator', 0, 0)] },
];

function makeWayfinding(tabs: WayTab[], activeTabId: string) {
  const store = createWayfindingStore();
  store.set({ tabs, activeTabId });
  const climb = vi.fn();
  const loadFloors = vi.fn();
  const w: Wayfinding = {
    store,
    actions: { walkThere: vi.fn(), go: vi.fn(), loadFloors, closePanel: vi.fn(), climb },
  };
  return { w, climb, loadFloors };
}

const panel = (w: Wayfinding, onDone = vi.fn()) =>
  render(<StairsPanel element={stairs} wayfinding={w} onDone={onDone} />);

describe('the Stairs panel', () => {
  it('offers the floor above and below, and climbs the one chosen', () => {
    const { w, climb } = makeWayfinding(TABS, 'l2');
    const done = vi.fn();
    panel(w, done);
    expect(screen.getByText('Floor 2 of 3, Level 2')).toBeTruthy();
    expect(screen.getByText('Lands at its Elevator')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Down to Ground' }));
    expect(done).toHaveBeenCalledTimes(1);
    const flight = stairsFlights(TABS, 'l2', stairs).down;
    expect(climb).toHaveBeenCalledWith({
      from: { id: 'stairs-1', x: 0, y: 0, width: 96, height: 128 },
      flight,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Up to Roof' }));
    expect(climb).toHaveBeenCalledTimes(2);
  });

  it('says there is nothing past the top and ground floors', () => {
    const top = makeWayfinding(TABS, 'l3');
    panel(top.w);
    expect(screen.getByText('No floor above')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Up to/ })).toBeNull();
    const one = makeWayfinding([TABS[0]!], 'g');
    panel(one.w);
    expect(screen.getByText('No floor below')).toBeTruthy();
    expect(screen.getByText(/This space has one floor/)).toBeTruthy();
  });

  it('reads Avatar Pad and middle landings, and a heading when the tab is unknown', () => {
    const tabs: WayTab[] = [
      { id: 'a', name: 'A', elements: [at('avatar-pad', 0, 0)] },
      { id: 'b', name: 'B', elements: [] },
      { id: 'c', name: 'C', elements: [] },
    ];
    panel(makeWayfinding(tabs, 'b').w);
    expect(screen.getByText('Lands at its Avatar Pad')).toBeTruthy();
    expect(screen.getByText('Lands in its middle')).toBeTruthy();
    panel(makeWayfinding(tabs, 'gone').w);
    expect(screen.getByText('Up or down a floor.')).toBeTruthy();
  });

  it('fetches a floor not opened yet, shows it loading, then offers it after the wait', () => {
    vi.useFakeTimers();
    try {
      const tabs: WayTab[] = [TABS[0]!, { ...TABS[1]!, elements: [], loaded: false }];
      const { w, loadFloors } = makeWayfinding(tabs, 'g');
      panel(w);
      expect(loadFloors).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status').textContent).toBe('Loading this floor');
      expect(screen.queryByRole('button', { name: 'Up to Level 2' })).toBeNull();
      act(() => {
        vi.advanceTimersByTime(FLOOR_WAIT_MS);
      });
      expect(screen.getByRole('button', { name: 'Up to Level 2' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fetches nothing when both floors are loaded', () => {
    const { w, loadFloors } = makeWayfinding(TABS, 'l2');
    panel(w);
    expect(loadFloors).not.toHaveBeenCalled();
  });
});

function face(readOnly: boolean, wayfinding: Wayfinding) {
  render(
    <BoxedElementView
      element={stairs as BoxedElement}
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

describe('without the canvas', () => {
  it('draws the button but opens nothing (a preview, an export)', () => {
    render(<StairsFace element={stairs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stairs' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('every role may take them', () => {
  it.each([
    ['an Editor', false],
    ['a Participant or a Viewer', true],
  ])('%s opens the Stairs and climbs', (_who, readOnly) => {
    const { w, climb } = makeWayfinding(TABS, 'g');
    face(readOnly, w);
    fireEvent.click(screen.getByRole('button', { name: 'Stairs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Up to Level 2' }));
    expect(climb).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Stairs' })).toBeNull();
  });

  it('a walk-on opens the panel through the store, and closing it clears the store', () => {
    const { w } = makeWayfinding(TABS, 'g');
    face(true, w);
    expect(screen.queryByRole('dialog', { name: 'Stairs' })).toBeNull();
    act(() => {
      w.store.set({ openPanelId: 'stairs-1' });
    });
    expect(screen.getByRole('dialog', { name: 'Stairs' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(w.actions.closePanel).toHaveBeenCalledTimes(1);
  });
});
