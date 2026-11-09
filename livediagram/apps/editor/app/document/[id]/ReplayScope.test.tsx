// @vitest-environment jsdom

// Watch It Built's scope (docs/specs/007-editor/blueprints/watch-it-built.md "The scope"): while a replay runs, what is
// inside sees the demo after the tab's own elements, the replay's held menu and its own selection; outside a run it
// sees the editor unchanged.

import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape } from '@livediagram/document';
import {
  SelectionStoreProvider,
  useSelectionStore,
} from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { replayStore } from '@/lib/replay/replay-store';
import { EditorContext, useEditorContext } from './EditorContext';
import { ReplayScope } from './ReplayScope';

const mine = { ...createShape('square', 0, 0), id: 'mine' };
const demo = { ...createShape('square', 0, 0), id: 'wib-a' };
const menu = { mode: 'element' as const, elementId: 'wib-b', x: 10, y: 20 };

const probe: { seen: ReturnType<typeof useEditorContext> | null; store: unknown } = {
  seen: null,
  store: null,
};
const record = (seen: ReturnType<typeof useEditorContext>, store: unknown) => {
  probe.seen = seen;
  probe.store = store;
};
function Probe({ onRender }: { onRender: typeof record }) {
  onRender(useEditorContext(), useSelectionStore());
  return null;
}
const outer = {
  activeTab: { id: 't1', elements: [mine] },
  contextMenu: null,
  setContextMenu: () => {},
  closeContextMenu: () => {},
  selectionStore: null,
} as unknown as ReturnType<typeof useEditorContext>;

const editorSelection = createSelectionStore();
const mount = () =>
  render(
    <EditorContext.Provider value={outer}>
      <SelectionStoreProvider store={editorSelection}>
        <ReplayScope>
          <Probe onRender={record} />
        </ReplayScope>
      </SelectionStoreProvider>
    </EditorContext.Provider>,
  );

afterEach(() => {
  cleanup();
  replayStore.reset();
  probe.seen = null;
});

describe('ReplayScope', () => {
  it('passes the editor through untouched outside a replay', () => {
    mount();
    expect(probe.seen).toBe(outer);
    expect(probe.store).toBe(editorSelection);
  });

  it('draws the demo in after the tab, with the replay menu and selection', () => {
    mount();
    act(() => replayStore.set({ active: true, elements: [demo], menu }));
    expect(probe.seen!.activeTab.elements.map((e) => e.id)).toEqual(['mine', 'wib-a']);
    expect(probe.seen!.contextMenu).toEqual(menu);
    expect(probe.seen!.selectionStore).toBe(replayStore.selection);
    expect(probe.store).toBe(replayStore.selection);
    // The editor's own tab is untouched.
    expect(outer.activeTab.elements).toEqual([mine]);
  });

  it('never remounts what it holds as a replay starts or ends', () => {
    const mounts = { count: 0 };
    function Counted() {
      useEffect(() => {
        mounts.count += 1;
      }, []);
      return null;
    }
    render(
      <EditorContext.Provider value={outer}>
        <SelectionStoreProvider store={editorSelection}>
          <ReplayScope>
            <Counted />
          </ReplayScope>
        </SelectionStoreProvider>
      </EditorContext.Provider>,
    );
    act(() => replayStore.set({ active: true, elements: [demo] }));
    act(() => replayStore.reset());
    expect(mounts.count).toBe(1);
  });

  it("keeps the menu's opens and closes in the replay", () => {
    mount();
    act(() => replayStore.set({ active: true }));
    act(() => probe.seen!.setContextMenu(menu));
    expect(replayStore.get().menu).toEqual(menu);
    act(() => probe.seen!.setContextMenu((m) => (m ? { ...m, x: 99 } : m)));
    expect(replayStore.get().menu?.x).toBe(99);
    act(() => probe.seen!.closeContextMenu());
    expect(replayStore.get().menu).toBeNull();
  });
});
