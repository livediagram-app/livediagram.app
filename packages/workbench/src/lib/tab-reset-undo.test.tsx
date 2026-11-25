// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@liveworkspace/ui/toast';
import { useUndoableAction, type UndoableAction } from '@liveworkspace/ui/undo';
import { RESET_TAB_WORDS, resetTabUndoable } from './tab-reset-undo';
import { revertTabStep } from './revert-tab-step';

// liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md: Reset canvas empties the tab at once, and Undo
// puts every element back on that tab, keeping what anyone added since.

type El = { id: string };
type T = { id: string; elements: El[]; layers?: El[] };

let offer: (a: UndoableAction) => Promise<boolean>;
function Grab() {
  const run = useUndoableAction();
  useEffect(() => {
    offer = run;
  }, [run]);
  return null;
}
afterEach(cleanup);

function setup(start: T[]) {
  render(
    <ToastProvider>
      <Grab />
    </ToastProvider>,
  );
  let tabs = start;
  const commitTabs = vi.fn((map: (ts: T[]) => T[]) => {
    tabs = map(tabs);
  });
  const onReset = vi.fn();
  const reset = (tabId: string, words?: { message: string; undoLabel: string }) =>
    act(async () => {
      await resetTabUndoable({
        tabId,
        tabs,
        commitTabs,
        offerUndo: offer,
        onReset,
        ...(words ? { words } : {}),
      });
    });
  return { reset, tabs: () => tabs, commitTabs, onReset };
}

describe('resetTabUndoable', () => {
  it('empties the tab at once, and Undo puts every element back under anything added since', async () => {
    const s = setup([
      { id: 'a', elements: [{ id: 'x' }, { id: 'y' }] },
      { id: 'b', elements: [{ id: 'z' }] },
    ]);
    await s.reset('a');
    expect(s.tabs()[0]!.elements).toEqual([]);
    expect(s.onReset).toHaveBeenCalledOnce();
    expect(screen.getByText(RESET_TAB_WORDS.canvas.message)).toBeTruthy();
    // Someone adds an element meanwhile.
    s.commitTabs((ts) => ts.map((t) => (t.id === 'a' ? { ...t, elements: [{ id: 'n' }] } : t)));
    fireEvent.click(screen.getByRole('button', { name: RESET_TAB_WORDS.canvas.undoLabel }));
    await act(async () => {});
    expect(s.tabs()[0]!.elements.map((e) => e.id)).toEqual(['x', 'y', 'n']);
    expect(s.tabs()[1]!.elements).toEqual([{ id: 'z' }]);
  });

  it('does nothing, and says nothing, on an empty or unknown tab', async () => {
    const s = setup([{ id: 'a', elements: [] }]);
    await s.reset('a');
    await s.reset('ghost');
    expect(s.commitTabs).not.toHaveBeenCalled();
    expect(s.onReset).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
  });

  it('takes its words from the caller', async () => {
    const s = setup([{ id: 'a', elements: [{ id: 'x' }] }]);
    await s.reset('a', RESET_TAB_WORDS.page);
    expect(screen.getByText('Cleared the page.')).toBeTruthy();
  });
});

describe('revertTabStep', () => {
  it('takes back the elements and the layers of one step, keeping the tab’s other fields as they are now', () => {
    const before: T & { name: string } = {
      id: 't',
      name: 'Old',
      elements: [{ id: 'a' }, { id: 'b' }],
      layers: [{ id: 'l1' }, { id: 'l2' }],
    };
    const after = { ...before, elements: [before.elements[0]!], layers: [before.layers![0]!] };
    const now = { ...after, name: 'Renamed since' };
    expect(revertTabStep(before, after, now)).toEqual({ ...before, name: 'Renamed since' });
  });

  it('answers the tab itself when there is nothing to take back, and leaves untouched layers alone', () => {
    const t: T = { id: 't', elements: [{ id: 'a' }] };
    expect(revertTabStep(t, t, t)).toBe(t);
    const after = { ...t, elements: [] };
    const out = revertTabStep(t, after, after);
    expect(out.elements).toEqual([{ id: 'a' }]);
    expect('layers' in out).toBe(false);
  });

  it('brings back layers a step dropped, or takes away layers it added, when one side has none', () => {
    const withLayers: T = { id: 't', elements: [], layers: [{ id: 'l1' }] };
    const bare: T = { id: 't', elements: [] };
    expect(revertTabStep(withLayers, bare, bare).layers).toEqual([{ id: 'l1' }]);
    expect(revertTabStep(bare, withLayers, withLayers).layers).toEqual([]);
  });
});
