// @vitest-environment jsdom

// Dropping a tab into a tab folder ends the drag for the side by side drop zone too (docs/specs/007-editor/split-view.md
// "Opening", Work Tracker 1223). Joining the folder moves the dragged pill under the folder's group, so React unmounts
// the element the browser then reports dragend to, and that dragend never reaches the page. The drop zone used to stay
// over the board until a reload; the drag store now hears the drop itself.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDraggedTab, useDraggedTab } from '../../lib/tab-drag-store';
import { TabFrame } from './TabFrame';
import { TabStrip, type TabRun } from './TabStrip';
import { useTabReorderDrag } from './useTabReorderDrag';

type T = { id: string; name: string };
const t = (id: string, name: string): T => ({ id, name });

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: vi.fn(), configurable: true });
});
afterEach(() => {
  cleanup();
  setDraggedTab(null);
  vi.unstubAllGlobals();
});

// Each app's SplitDropZone, cut to what this asks: a full-window layer over the board while a tab is in flight.
function DropZone() {
  return useDraggedTab() ? <div data-testid="split-drop-zone" className="fixed inset-0" /> : null;
}

// An editor's tab bar, folded to its folders: a tab joining a folder leaves the loose run for the folder's.
function Editor({ onBoardClick }: { onBoardClick: () => void }) {
  const [runs, setRuns] = useState<TabRun<T>[]>([
    { kind: 'folder', name: 'Planning', tabs: [t('r', 'Roadmap')] },
    { kind: 'loose', tab: t('b', 'Backlog') },
  ]);
  const onReorder = (src: string, target: string) => {
    if (src !== 'b' || target !== 'r') return;
    setRuns([{ kind: 'folder', name: 'Planning', tabs: [t('b', 'Backlog'), t('r', 'Roadmap')] }]);
  };
  const drag = useTabReorderDrag(onReorder);
  return (
    <>
      <button type="button" onClick={onBoardClick}>
        Board
      </button>
      <TabStrip
        runs={runs}
        activeId="b"
        readOnly={false}
        renderTab={(tab) => (
          <TabFrame
            key={tab.id}
            id={tab.id}
            name={tab.name}
            active={tab.id === 'b'}
            readOnly={false}
            onSelect={vi.fn()}
            dragging={drag.isDragging(tab.id)}
            dragHandlers={drag.handlersFor(tab.id)}
          />
        )}
        onReorder={onReorder}
        onRenameFolder={vi.fn()}
        renderRenameField={() => null}
      />
      <DropZone />
    </>
  );
}

const transfer = (data: string) => ({
  setData: vi.fn(),
  getData: () => data,
  effectAllowed: '',
  dropEffect: '',
});

describe('TabStrip: a tab dropped into a tab folder', () => {
  it('leaves no side by side drop zone over the board, and the board takes clicks', () => {
    const onBoardClick = vi.fn();
    render(<Editor onBoardClick={onBoardClick} />);
    const pill = screen.getByRole('button', { name: 'Backlog' });

    fireEvent.dragStart(pill, { dataTransfer: transfer('b') });
    expect(screen.getByTestId('split-drop-zone')).toBeTruthy();

    const chip = screen.getByRole('button', { name: /^Planning,/ });
    fireEvent.dragOver(chip, { dataTransfer: transfer('b') });
    fireEvent.drop(chip, { dataTransfer: transfer('b') });

    // The pill moved into the folder: the element the drag started on is gone, so its dragend reaches no one.
    expect(pill.isConnected).toBe(false);
    act(() => {
      pill.dispatchEvent(new Event('dragend', { bubbles: true }));
    });

    expect(screen.queryByTestId('split-drop-zone')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(onBoardClick).toHaveBeenCalledTimes(1);
    // The tab did join the folder.
    expect(
      screen.getByRole('button', { name: 'Backlog' }).closest('[data-tab-folder="Planning"]'),
    ).toBeTruthy();
  });

  it('clears on Escape and on a drag cancelled outside any target', () => {
    render(<Editor onBoardClick={vi.fn()} />);
    const pill = screen.getByRole('button', { name: 'Backlog' });

    fireEvent.dragStart(pill, { dataTransfer: transfer('b') });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('split-drop-zone')).toBeNull();

    // Let go over nothing: no drop fires, only the pill's dragend.
    fireEvent.dragStart(pill, { dataTransfer: transfer('b') });
    expect(screen.getByTestId('split-drop-zone')).toBeTruthy();
    fireEvent.dragEnd(pill);
    expect(screen.queryByTestId('split-drop-zone')).toBeNull();
  });
});
