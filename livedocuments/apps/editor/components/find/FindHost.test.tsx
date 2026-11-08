// @vitest-environment jsdom

// Typing in the bar re-renders the bar alone (docs/specs/007-editor/find-and-replace.md "Performance"): the find
// state lives in FindHost, so a key typed into the Find field, and the search that follows, never re-render the
// editor around it. The editor opens the bar through its door (FindDoor.openBar, via `openerRef`).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { fixtureTab, rowsOf } from '@/test/find-fixture';
import { FIND_DEBOUNCE_MS, type FindDoor } from '@/hooks/editor/useFindReplace';
import { FindHost } from './FindHost';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/text-hug', () => ({ hugsText: () => false, hugTextSize: () => ({}) }));
vi.mock('@/components/canvas/text-hug-measure', () => ({ measureDrawnText: () => () => ({}) }));

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const tab = fixtureTab();
const pages = rowsOf(tab);
const can = resolveEditorCapabilities('edit');
const editor = { renders: 0 };
const countRender = () => void editor.renders++;
// The editor's door, as useEditorState holds it: FindHost assigns its opener here.
const openerRef: { current: FindDoor['openBar'] } = { current: () => {} };

// The editor: it renders FindHost with fresh deps each time it renders.
function Editor() {
  countRender();
  const mainRef = useRef<HTMLElement | null>(null);
  return (
    <main ref={mainRef}>
      <FindHost
        deps={{
          activeTab: tab,
          pages,
          can,
          standsAside: false,
          canvasMainRef: mainRef,
          getView: () => ({ zoom: 1, offset: { x: 0, y: 0 } }),
          focusPage: () => {},
          scrollIntoView: () => {},
          commitActiveTab: () => {},
          notify: () => {},
        }}
        openerRef={openerRef}
        canvasMainRef={mainRef}
      />
    </main>
  );
}

describe('FindHost', () => {
  it("opens through the editor's door, and typing in it never re-renders the editor", () => {
    vi.useFakeTimers();
    render(<Editor />);
    act(() => openerRef.current(false));
    const field = screen.getByRole('textbox', { name: 'Find' }) as HTMLInputElement;
    editor.renders = 0;
    for (const q of ['p', 'pl', 'pla', 'plan']) fireEvent.change(field, { target: { value: q } });
    act(() => {
      vi.advanceTimersByTime(FIND_DEBOUNCE_MS);
    });
    expect(field.value).toBe('plan');
    expect(editor.renders).toBe(0);
  });
});
