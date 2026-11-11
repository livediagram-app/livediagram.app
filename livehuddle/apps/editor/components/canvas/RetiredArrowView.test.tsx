// @vitest-environment jsdom

// A stored arrow on the canvas (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4;
// docs/specs/002-project-scope/blueprints/element-engine.md D21 to D24): a faint dashed line between its resolved
// ends and the placeholder card centred on it. The card selects and holds an Editor's Delete; nothing moves it, and
// its ends are worked out each time it is drawn, so its pinned element moving or going never breaks it.

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RETIRED_ARROW_CARD_HEIGHT,
  RETIRED_ARROW_CARD_WIDTH,
  createSticky,
  retiredArrowEnds,
  type Element,
  type RetiredArrowElement,
} from '@livehuddle/document';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { useElementSelectionActions as buildSelectionActions } from '@/hooks/canvas/useElementSelectionActions';
import { storedArrow, storedPinnedArrow } from '@/test/retired-elements';
import { CanvasStillProvider } from './CanvasStillContext';
import {
  RetiredArrowView,
  retiredArrowViewPropsEqual,
  type RetiredArrowViewProps,
} from './RetiredArrowView';

vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

afterEach(cleanup);

const a = { ...createSticky(0, 0), id: 'a', width: 100, height: 100 } as Element;
const b = { ...createSticky(400, 0), id: 'b', width: 100, height: 100 } as Element;
const pinned = storedPinnedArrow('ab', 'a', 'e', 'b', 'w', { label: 'calls' });

type Role = 'edit' | 'participate' | 'view';

// The props the canvas hands the view for a session's role: an Editor's surface is editable and carries the
// placeholder Delete (EditorCanvasHost: read off `can.remove`), a Participant's and a Viewer's are read-only.
function viewProps(
  arrow: Element,
  board: Element[],
  role: Role = 'edit',
  over: Partial<RetiredArrowViewProps> = {},
) {
  const can = resolveEditorCapabilities({
    level: role,
    adderKey: role === 'edit' ? null : 'a'.repeat(32),
  });
  const readOnly = role !== 'edit';
  const onRemove = vi.fn();
  const onSelect = vi.fn();
  const props = {
    arrow: arrow as RetiredArrowElement,
    ends: retiredArrowEnds(arrow as RetiredArrowElement, board),
    onSelect,
    isEditing: false,
    isPaintMode: false,
    readOnly,
    onBeginEdit: vi.fn(),
    onCommitLabel: vi.fn(),
    onCancelEdit: vi.fn(),
    onFollowLink: vi.fn(),
    onOpenComments: vi.fn(),
    onOpenAction: vi.fn(),
    onOpenNote: vi.fn(),
    onContextSelect: vi.fn(),
    tabSummaries: [],
    remoteSelectors: [],
    onDeleteRetired: readOnly
      ? undefined
      : (id: string) => {
          if (can.remove(arrow)) onRemove(id);
        },
    ...over,
  } as unknown as RetiredArrowViewProps;
  return { props, onRemove, onSelect, can };
}

// The card's Delete needs room clear of its words (RetiredElementFace's retiredDeletePlacement): the card is 96 tall so
// it shows at zoom 1 even with a label row (at 56 the note line reached the top-right corner).
const DELETE_ZOOM = 1;

function draw(props: RetiredArrowViewProps, selected: string | null = null, zoom = 1) {
  const store = createSelectionStore();
  if (selected) store.setSelectedId(selected);
  const wrap = ({ children }: { children: ReactNode }) => (
    <CanvasStillProvider still>
      <CanvasZoomProvider zoom={zoom}>
        <SelectionStoreProvider store={store}>{children}</SelectionStoreProvider>
      </CanvasZoomProvider>
    </CanvasStillProvider>
  );
  return render(<RetiredArrowView {...props} />, { wrapper: wrap });
}

const lineOf = (root: ParentNode) =>
  root.querySelector<SVGLineElement>('[data-retired-arrow] line[data-retired-arrow-line]')!;
const cardOf = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!;
const nameOf = (root: ParentNode) =>
  root.querySelector('[data-retired-line="name"]')?.textContent ?? null;

describe('RetiredArrowView', () => {
  it('draws the dashed line between its ends, taking no press, and the card centred on it', () => {
    const { container } = draw(viewProps(pinned, [a, b]).props);
    const line = lineOf(container);
    expect([line.getAttribute('x1'), line.getAttribute('y1')]).toEqual(['100', '50']);
    expect([line.getAttribute('x2'), line.getAttribute('y2')]).toEqual(['400', '50']);
    expect(line.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(line.closest('svg')!.getAttribute('class')).toContain('pointer-events-none');
    const card = cardOf(container, 'ab');
    expect(card).not.toBeNull();
    expect(card.style.left).toBe(`${250 - RETIRED_ARROW_CARD_WIDTH / 2}px`);
    expect(card.style.top).toBe(`${50 - RETIRED_ARROW_CARD_HEIGHT / 2}px`);
    expect(card.style.width).toBe(`${RETIRED_ARROW_CARD_WIDTH}px`);
    expect(card.style.height).toBe(`${RETIRED_ARROW_CARD_HEIGHT}px`);
    expect(container.querySelector('textarea, input, [contenteditable]')).toBeNull();
  });

  it('is named Arrow, or Line when stored with no heads (D24)', () => {
    expect(nameOf(draw(viewProps(pinned, [a, b]).props).container)).toBe('Arrow');
    cleanup();
    const line = storedArrow('ln', { x: 0, y: 0 }, { x: 300, y: 0 }, { arrowEnds: 'none' });
    expect(nameOf(draw(viewProps(line, []).props).container)).toBe('Line');
  });

  it('fades the line with its own and its layer’s opacity', () => {
    const faded = storedArrow('f', { x: 0, y: 0 }, { x: 300, y: 0 }, { opacity: 0.5 });
    const { container } = draw(viewProps(faded, [], 'edit', { layerOpacity: 0.5 }).props);
    expect(lineOf(container).closest('svg')!.style.opacity).toBe('0.25');
  });

  it('selects on a press of the card, and never on a Shift press', () => {
    const { props, onSelect } = viewProps(pinned, [a, b]);
    const { container } = draw(props);
    const card = cardOf(container, 'ab');
    fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 250, clientY: 50 });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toBe('ab');
    onSelect.mockClear();
    fireEvent.pointerDown(card, { button: 0, pointerId: 2, shiftKey: true });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('never selects it alone, nor drags it, on a Shift press of the selected card', () => {
    const { props, onSelect } = viewProps(pinned, [a, b]);
    const { container } = draw(props, 'ab');
    // Far from any earlier press, so the press ledger never reads it as a double-click's second press.
    fireEvent.pointerDown(cardOf(container, 'ab'), {
      button: 0,
      pointerId: 3,
      shiftKey: true,
      clientX: 900,
      clientY: 900,
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows no resize grip when selected: it never moves or resizes', () => {
    const { container } = draw(viewProps(pinned, [a, b]).props, 'ab');
    expect(container.querySelector('[data-resize-handle]')).toBeNull();
  });
});

describe('a stored arrow and the share roles', () => {
  it('gives the Delete to an Editor alone, and the Delete removes it', () => {
    const editor = viewProps(pinned, [a, b], 'edit');
    const { container } = draw(editor.props, 'ab', DELETE_ZOOM);
    const button = container.querySelector<HTMLButtonElement>('button[data-retired-delete]')!;
    expect(button.getAttribute('aria-label')).toBe('Delete Arrow');
    fireEvent.click(button);
    expect(editor.onRemove).toHaveBeenCalledWith('ab');
    cleanup();
    for (const role of ['participate', 'view'] as const) {
      const { container: readOnly } = draw(
        viewProps(pinned, [a, b], role).props,
        'ab',
        DELETE_ZOOM,
      );
      expect(readOnly.querySelector('button[data-retired-delete]'), role).toBeNull();
      cleanup();
    }
  });

  it('an Editor may remove it, a Participant and a Viewer may not, and removing it takes nothing else', () => {
    const can = (level: Role) =>
      resolveEditorCapabilities({ level, adderKey: level === 'edit' ? null : 'a'.repeat(32) });
    expect((['edit', 'participate', 'view'] as const).map((r) => can(r).remove(pinned))).toEqual([
      true,
      false,
      false,
    ]);
    let after: Element[] | null = null;
    const board = [a, b, pinned];
    const actions = buildSelectionActions({
      currentSelectionIds: () => new Set<string>(),
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      activeTab: { id: 't', name: 'T', elements: board },
      commit: (map) => {
        after = map(board);
      },
      setSelectedId: () => {},
      setEditingId: () => {},
      setMultiSelectedIds: () => {},
      setFormatSourceId: () => {},
      lockedByOther: () => false,
    });
    actions.deleteElementById('ab');
    expect(after).toEqual([a, b]);
  });
});

// D22, D23: the ends are worked out from the board each time, and deleting what it is pinned to leaves the arrow.
describe('a stored arrow whose pinned element moves or goes', () => {
  it('follows the element it is pinned to when it moves', () => {
    const { props } = viewProps(pinned, [a, b]);
    const view = draw(props);
    const movedB = { ...b, x: 600, y: 200 } as Element;
    view.rerender(
      <RetiredArrowView
        {...props}
        ends={retiredArrowEnds(pinned as RetiredArrowElement, [a, movedB])}
      />,
    );
    const line = lineOf(view.container);
    expect([line.getAttribute('x2'), line.getAttribute('y2')]).toEqual(['600', '250']);
  });

  it('draws with the other end’s point when one pinned element is deleted, and keeps its Delete', () => {
    const editor = viewProps(pinned, [a]);
    const { container } = draw(editor.props, 'ab', DELETE_ZOOM);
    const line = lineOf(container);
    expect([line.getAttribute('x1'), line.getAttribute('x2')]).toEqual(['100', '100']);
    expect(cardOf(container, 'ab')).not.toBeNull();
    fireEvent.click(container.querySelector('button[data-retired-delete]')!);
    expect(editor.onRemove).toHaveBeenCalledWith('ab');
  });

  it('draws its card at the canvas origin when both pinned elements are deleted', () => {
    const { container } = draw(viewProps(pinned, []).props);
    const card = cardOf(container, 'ab');
    expect(card.style.left).toBe(`${-RETIRED_ARROW_CARD_WIDTH / 2}px`);
    expect(card.style.top).toBe(`${-RETIRED_ARROW_CARD_HEIGHT / 2}px`);
  });

  it('keeps the stored arrow exactly as it was when what it pinned to is deleted', () => {
    let after: Element[] | null = null;
    const board = [a, b, pinned];
    const actions = buildSelectionActions({
      currentSelectionIds: () => new Set<string>(),
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      activeTab: { id: 't', name: 'T', elements: board },
      commit: (map) => {
        after = map(board);
      },
      setSelectedId: () => {},
      setEditingId: () => {},
      setMultiSelectedIds: () => {},
      setFormatSourceId: () => {},
      lockedByOther: () => false,
    });
    actions.deleteElementById('b');
    expect(after).toEqual([a, pinned]);
    expect(after![1]).toBe(pinned);
  });
});

describe('retiredArrowViewPropsEqual', () => {
  const base = viewProps(pinned, [a, b]).props;

  it('holds for fresh ends at the same points, and every other prop the same', () => {
    expect(
      retiredArrowViewPropsEqual(base, {
        ...base,
        ends: { from: { ...base.ends.from }, to: { ...base.ends.to } },
      }),
    ).toBe(true);
  });

  it('breaks when an end moves, or any other prop changes', () => {
    const moved = { ...base, ends: { from: base.ends.from, to: { x: 1, y: base.ends.to.y } } };
    expect(retiredArrowViewPropsEqual(base, moved)).toBe(false);
    const movedY = { ...base, ends: { from: { x: base.ends.from.x, y: 9 }, to: base.ends.to } };
    expect(retiredArrowViewPropsEqual(base, movedY)).toBe(false);
    expect(retiredArrowViewPropsEqual(base, { ...base, readOnly: true })).toBe(false);
  });
});
