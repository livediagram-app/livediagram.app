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
import { beginCanvasGesture } from '@liveworkspace/workbench/lib/canvas-gesture';
import { EditorFindHost, FindHost } from './FindHost';
import {
  createEditorChromeStore,
  EditorChromeContext,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';

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
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Find' });
    editor.renders = 0;
    for (const q of ['p', 'pl', 'pla', 'plan']) fireEvent.change(field, { target: { value: q } });
    act(() => {
      vi.advanceTimersByTime(FIND_DEBOUNCE_MS);
    });
    expect(field.value).toBe('plan');
    expect(editor.renders).toBe(0);
  });

  // Work Tracker 1051: the writing committed while the bar was shut (a typing commit renders nothing here) is the
  // writing it searches as it opens, not the tab as the bar last rendered.
  it('searches the writing as it is when the bar opens', async () => {
    const base = fixtureTab();
    const withText = (runs: { text: string }[]): typeof base => ({
      ...base,
      articles: { f1: { blocks: [{ id: 'a', type: 'paragraph' as const, runs }] } },
    });
    const empty = withText([]);
    const typed = withText([{ text: 'teh teh' }]);
    const depsOf = (activeTab: typeof base, mainRef: { current: HTMLElement | null }) => ({
      activeTab,
      pages,
      can,
      standsAside: false,
      canvasMainRef: mainRef,
      getView: () => ({ zoom: 1, offset: { x: 0, y: 0 } }),
      focusPage: () => {},
      scrollIntoView: () => {},
      commitActiveTab: () => {},
      notify: () => {},
    });
    const mainRef: { current: HTMLElement | null } = { current: document.createElement('main') };
    const store = createEditorChromeStore({
      findDeps: depsOf(empty, mainRef),
    } as unknown as EditorContextValue);
    render(
      <EditorChromeContext.Provider value={store}>
        <EditorFindHost openerRef={openerRef} canvasMainRef={mainRef} />
      </EditorChromeContext.Provider>,
    );
    act(() => store.set({ findDeps: depsOf(typed, mainRef) } as unknown as EditorContextValue));
    act(() => openerRef.current(false));
    fireEvent.change(screen.getByRole('textbox', { name: 'Find' }), { target: { value: 'teh' } });
    expect(await screen.findByText('1 of 2')).toBeTruthy();
  });

  // Work Tracker 1052: open over a page's title bar (its Lock page and cog at the right end), the bar steps under it,
  // and follows it as the canvas moves it (a wheel, a pan or a zoom), back under the strip once it is out of the way.
  it('steps under a page title bar it would cover, and follows it as the canvas moves', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const titleBar = document.createElement('div');
    titleBar.setAttribute('data-page-title-bar', '');
    document.body.append(titleBar);
    let titleTop = 85;
    const rect = (left: number, top: number, right: number, bottom: number) =>
      ({ left, top, right, bottom, width: right - left, height: bottom - top }) as DOMRect;
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this === titleBar) return rect(1119, titleTop, 1439, titleTop + 34);
      if (this.hasAttribute('data-find-bar')) return rect(859, 68, 1279, 114);
      // The canvas's main.
      return rect(0, 0, 1295, 820);
    });
    try {
      const { unmount } = render(<Editor />);
      act(() => openerRef.current(false));
      const bar = document.querySelector<HTMLElement>('[data-find-bar]')!;
      expect(bar.style.top).toBe('127px');
      // The canvas moves the title bar down out of the way: the next frames put the bar back under the strip.
      titleTop = 400;
      act(() => {
        window.dispatchEvent(new Event('wheel'));
        // A second cause before the next frame waits for the frame already asked for.
        window.dispatchEvent(new Event('keyup'));
        vi.advanceTimersByTime(100);
      });
      expect(bar.style.top).toBe('68px');
      // A pan under way keeps it following, frame by frame, until the pan ends and the canvas settles.
      const endPan = beginCanvasGesture('pan');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      titleTop = 85;
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(bar.style.top).toBe('127px');
      titleTop = 400;
      act(() => {
        endPan();
        vi.advanceTimersByTime(100);
      });
      expect(bar.style.top).toBe('68px');
      // Long after, nothing more is placed (no idle frames).
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      titleTop = 85;
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(bar.style.top).toBe('68px');
      act(() => {
        window.dispatchEvent(new Event('pointerup'));
        vi.advanceTimersByTime(100);
      });
      expect(bar.style.top).toBe('127px');
      unmount();
    } finally {
      spy.mockRestore();
      titleBar.remove();
    }
  });
});
