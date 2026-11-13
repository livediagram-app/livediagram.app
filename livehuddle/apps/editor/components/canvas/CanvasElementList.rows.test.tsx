// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { memo, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';

// docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached": each row of the element layer is
// memoised on what it draws, so a row carried over from the last commit must draw what a row drawn afresh does. The
// views are stubs that print every prop a row hands them (through the real memo comparisons), and the layer, rendered
// edit after edit, is compared with one mounted afresh on the same board and props.

const printed = (props: Record<string, unknown>) =>
  JSON.stringify(props, (_k, v: unknown): unknown =>
    typeof v === 'function' ? 'fn' : v instanceof Map || v instanceof Set ? [...v] : v,
  );

vi.mock('./BoxedElementView', () => ({
  BoxedElementView: memo(function BoxedStub(props: Record<string, unknown>) {
    const { element, layerOpacity, isEditing, editCursorAtEnd, movable, resizable, fontFamily } =
      props;
    return (
      <span
        data-boxed={printed({
          element,
          layerOpacity,
          isEditing,
          editCursorAtEnd,
          movable,
          resizable,
          fontFamily,
          readOnly: props.readOnly,
          remoteSelectors: props.remoteSelectors,
        })}
      />
    );
  }),
}));
vi.mock('./RetiredArrowView', async (importOriginal) => {
  const real = await importOriginal<typeof import('./RetiredArrowView')>();
  return {
    ...real,
    RetiredArrowView: memo(function ArrowStub(
      props: Parameters<typeof real.retiredArrowViewPropsEqual>[0],
    ) {
      const { arrow, ends, layerOpacity, editingId, fontFamily, readOnly } = props;
      return (
        <svg data-arrow={printed({ arrow, ends, layerOpacity, editingId, fontFamily, readOnly })} />
      );
    }, real.retiredArrowViewPropsEqual),
  };
});
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { createPeerMotion } from '@/lib/peer-motion';
import { edit, editBoard, prng } from './board-edits-test-support';
import type { CanvasElementsLayerProps } from './CanvasElementsLayer';

const { CanvasElementsLayer } = await import('./CanvasElementsLayer');
const { createSelectionStore } = await import('@liveworkspace/workbench/lib/selection-store');
const { SelectionStoreProvider } =
  await import('@liveworkspace/workbench/hooks/canvas/useSelectionStore');

afterEach(cleanup);

const STABLE = {
  chairSitters: () => [],
  selfParticipant: { id: 'me', name: 'Me', color: '#000000' },
  settings: {},
  peers: {
    motion: createPeerMotion(),
    livePresenceById: new Map(),
    selfId: 'me',
    activeId: 't1',
    tabFocus: new Map(),
  },
};

// One function across renders, as the editor's is: a fresh one would walk every row on every render.
const canMove = (el: Element) => el.id.endsWith('1');

type Shared = {
  editingId: string | null;
  readOnly: boolean;
  ghosts: Set<string> | undefined;
  remote: Map<string, unknown[]>;
  tabFinish: 'flexible' | 'sketch';
};

function layerProps(elements: Element[], s: Shared) {
  const fresh = () => vi.fn();
  return {
    ...STABLE,
    elements,
    remoteSelectionsByElement: s.remote,
    selectionInput: { elements, editingId: s.editingId, isPaintMode: false, readOnly: s.readOnly },
    activeTabId: 't',
    viewportZoom: 1,
    editingId: s.editingId,
    editCursorAtEnd: true,
    readOnly: s.readOnly,
    shiftDupGhostIds: s.ghosts,
    tabFinish: s.tabFinish,
    canMove,
    isPaintMode: false,
    canvasTool: 'select',
    drawDrag: null,
    onOpenElementSettings: fresh(),
    onEnterPortal: fresh(),
    handleArrowSelect: fresh(),
    handleElementClick: fresh(),
    handleElementContextSelect: fresh(),
    onBeginDrag: fresh(),
    onBeginEdit: fresh(),
    onCommitLabel: fresh(),
    onCancelEdit: fresh(),
  } as unknown as CanvasElementsLayerProps;
}

const store = createSelectionStore();
const wrapper = ({ children }: { children: ReactNode }) => (
  <SelectionStoreProvider store={store}>{children}</SelectionStoreProvider>
);
const plane = (root: HTMLElement) => root.querySelector('[data-element-plane]')!.innerHTML;

describe('carried-over element rows', () => {
  it('draw what rows drawn afresh do, after any edit', () => {
    const rand = prng(41);
    let els = editBoard(3, 120);
    let shared: Shared = {
      editingId: null,
      readOnly: false,
      ghosts: undefined,
      remote: new Map(),
      tabFinish: 'flexible',
    };
    const live = render(<CanvasElementsLayer {...layerProps(els, shared)} />, { wrapper });
    for (let step = 0; step < 50; step++) {
      els = edit(els, rand, step);
      // Now and then, one of the props every row shares changes too.
      const pickId = () => els[Math.floor(rand() * els.length)]!.id;
      const r = rand();
      if (r < 0.1) shared = { ...shared, editingId: pickId() };
      else if (r < 0.2) shared = { ...shared, readOnly: !shared.readOnly };
      else if (r < 0.3) shared = { ...shared, ghosts: new Set([pickId(), pickId()]) };
      else if (r < 0.4) shared = { ...shared, remote: new Map([[pickId(), [{ id: 'p' }]]]) };
      else if (r < 0.45)
        shared = { ...shared, tabFinish: shared.tabFinish === 'sketch' ? 'flexible' : 'sketch' };
      live.rerender(<CanvasElementsLayer {...layerProps(els, shared)} />);
      const fresh = render(<CanvasElementsLayer {...layerProps(els, shared)} />, { wrapper });
      expect(plane(live.container) === plane(fresh.container), `step ${step}`).toBe(true);
      fresh.unmount();
    }
  });
});
