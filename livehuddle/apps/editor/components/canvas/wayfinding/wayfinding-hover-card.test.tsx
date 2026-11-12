// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type ShapeElement } from '@livehuddle/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import type { WayTab } from '@/lib/wayfinding';
import { createWayfindingStore, type Wayfinding } from './wayfinding-store';
import { LazyWayfindingPopover } from './wayfinding-panel-parts';

// docs/specs/009-elements/blueprints/wayfinding.md "Hover card": a wayfinding piece's hover card hides while its
// panel is open, whether a press or a walk-in opened it, and comes back once the panel closes (Work Item 623).

beforeAll(() => LazyWayfindingPopover.preload());

const stairs = { ...createShape('stairs', 0, 0), id: 'stairs-1' } as ShapeElement;
const elevator = { ...createShape('elevator', 400, 0), id: 'elevator-1' } as ShapeElement;
const directory = { ...createShape('directory', 800, 0), id: 'dir-1' } as ShapeElement;
const TABS: WayTab[] = [
  { id: 'g', name: 'Ground', elements: [stairs, elevator] },
  { id: 'l2', name: 'Level 2', elements: [] },
];

function makeWayfinding(): Wayfinding {
  const store = createWayfindingStore();
  store.set({ tabs: TABS, activeTabId: 'g' });
  return {
    store,
    actions: {
      walkThere: vi.fn(),
      go: vi.fn(),
      loadFloors: vi.fn(),
      closePanel: vi.fn(() => store.set({ openPanelId: null })),
      climb: vi.fn(),
    },
  };
}

// The piece as the canvas draws it, its face given the canvas's wayfinding (none: a preview or an export).
const draw = (element: ShapeElement, wayfinding?: Wayfinding) =>
  render(
    <BoxedElementView
      element={element as BoxedElement}
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
      readOnly={false}
      remoteSelectors={[]}
    />,
  );

const hover = (name: string) =>
  fireEvent.pointerEnter(screen.getByRole('button', { name }), { pointerType: 'mouse' });
const leave = (name: string) =>
  fireEvent.pointerLeave(screen.getByRole('button', { name }), { pointerType: 'mouse' });
const card = () => screen.queryByRole('tooltip');

describe.each([
  ['Stairs', stairs],
  ['Elevator 1', elevator],
])('the %s hover card', (name, piece) => {
  const id = piece.id;
  it('shows on hover while its panel is closed', () => {
    draw(piece, makeWayfinding());
    hover(name);
    expect(card()?.textContent).toContain(name);
  });

  it('hides while a press has its panel open, and comes back once it closes', () => {
    draw(piece, makeWayfinding());
    fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByRole('dialog', { name })).toBeTruthy();
    // The pointer rests on the piece beside its open panel.
    hover(name);
    expect(card()).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name })).toBeNull();
    leave(name);
    hover(name);
    expect(card()?.textContent).toContain(name);
  });

  it('hides while a walk-in has its panel open', () => {
    const w = makeWayfinding();
    draw(piece, w);
    act(() => w.store.set({ openPanelId: id }));
    expect(screen.getByRole('dialog', { name })).toBeTruthy();
    hover(name);
    expect(card()).toBeNull();
    // Another piece's walk-in leaves this one's card alone.
    act(() => w.store.set({ openPanelId: 'other' }));
    leave(name);
    hover(name);
    expect(card()?.textContent).toContain(name);
  });
});

describe('the Directory hover card', () => {
  it('hides while its popover is open, and shows without the canvas (nothing opens there)', () => {
    const { unmount } = draw(directory, makeWayfinding());
    fireEvent.click(screen.getByRole('button', { name: 'Directory' }));
    expect(screen.getByRole('dialog', { name: 'Directory' })).toBeTruthy();
    hover('Directory');
    expect(card()).toBeNull();
    unmount();
    draw(directory);
    fireEvent.click(screen.getByRole('button', { name: 'Directory' }));
    hover('Directory');
    expect(card()?.textContent).toContain('Directory');
  });
});
