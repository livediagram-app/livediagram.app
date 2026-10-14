// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement, Tab } from '@livediagram/document';
import { TabWindowContext, type TabWindowContextValue } from './tab-window-context';
import { tabWindowState, TabWindowFace } from './TabWindowFace';

// docs/specs/009-elements/tab-window.md "States".

// The drawing is the renderer's (tested elsewhere): a stub naming its tab. next/dynamic loads for real, behind
// Suspense, as the editor does.
vi.mock('./TabWindowDrawing', () => ({
  TabWindowDrawing: ({ tab }: { tab: Tab }) => <div data-testid="drawing">{tab.name}</div>,
}));
vi.mock('next/dynamic', async () => {
  const React = await import('react');
  return {
    default: (load: () => Promise<React.ComponentType<object>>) => {
      const Lazy = React.lazy(async () => ({ default: await load() }));
      return function Dynamic(props: object) {
        return (
          <React.Suspense fallback={null}>
            <Lazy {...props} />
          </React.Suspense>
        );
      };
    },
  };
});

afterEach(cleanup);

const tab = (id: string, name: string, n = 1) =>
  ({ id, name, elements: Array.from({ length: n }, () => ({})) }) as unknown as Tab;
const windowEl = (windowTabId?: string) =>
  ({
    id: 'w',
    type: 'shape',
    shape: 'tab-window',
    x: 0,
    y: 0,
    width: 640,
    height: 360,
    ...(windowTabId ? { windowTabId } : {}),
  }) as ShapeElement;

function show(el: ShapeElement, over: Partial<TabWindowContextValue> = {}) {
  const ctx: TabWindowContextValue = {
    tabs: [tab('slides', 'Slides'), tab('flow', 'Flow'), tab('blank', 'Blank', 0)],
    ownTabId: 'slides',
    status: () => 'loaded',
    request: vi.fn(),
    retry: vi.fn(),
    open: vi.fn(),
    choose: vi.fn(),
    ...over,
  };
  render(
    <TabWindowContext.Provider value={ctx}>
      <TabWindowFace element={el} surface="light" selected={false} />
    </TabWindowContext.Provider>,
  );
  return ctx;
}

describe('tabWindowState', () => {
  it('reads each state from the tab and its content', () => {
    expect(tabWindowState(undefined, undefined, 'loaded')).toEqual({ kind: 'unchosen' });
    expect(tabWindowState('gone', undefined, 'loaded')).toEqual({ kind: 'unavailable' });
    expect(tabWindowState('flow', tab('flow', 'Flow'), 'loading')).toEqual({
      kind: 'loading',
      name: 'Flow',
    });
    expect(tabWindowState('flow', tab('flow', 'Flow'), 'failed')).toMatchObject({ kind: 'failed' });
    expect(tabWindowState('b', tab('b', 'B', 0), 'loaded')).toEqual({ kind: 'empty', name: 'B' });
    expect(tabWindowState('flow', tab('flow', ''), 'loaded')).toMatchObject({
      kind: 'drawing',
      name: 'Untitled tab',
    });
  });
});

describe('TabWindowFace', () => {
  it('offers an Editor Choose a Tab, listing the tabs a window may show', async () => {
    const ctx = show(windowEl());
    expect(screen.getByText('Show a tab here')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose a Tab' }));
    await screen.findAllByRole('menuitemradio');
    const options = screen.getAllByRole('menuitemradio').map((o) => o.textContent);
    expect(options).toEqual(['Flow', 'Blank']);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Flow/ }));
    expect(ctx.choose).toHaveBeenCalledWith('w', 'flow');
  });

  it('says no tab is chosen to someone who may not edit, with no button', () => {
    show(windowEl(), { choose: undefined });
    expect(screen.getByText('No tab chosen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose a Tab' })).toBeNull();
  });

  it('draws the shown tab and asks for its content, with Open', async () => {
    const ctx = show(windowEl('flow'));
    expect((await screen.findByTestId('drawing')).textContent).toBe('Flow');
    expect(ctx.request).toHaveBeenCalledWith('flow');
    fireEvent.click(screen.getByRole('button', { name: 'Open Flow' }));
    expect(ctx.open).toHaveBeenCalledWith('flow');
  });

  it('waits, offers Retry, says when the tab is empty or not available', () => {
    show(windowEl('flow'), { status: () => 'loading' });
    expect(screen.getByText('Loading Flow…')).toBeTruthy();
    cleanup();
    const ctx = show(windowEl('flow'), { status: () => 'failed' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(ctx.retry).toHaveBeenCalledWith('flow');
    cleanup();
    show(windowEl('blank'));
    expect(screen.getByText('Nothing on Blank yet.')).toBeTruthy();
    cleanup();
    show(windowEl('gone'));
    expect(screen.getByText("This tab isn't available.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Open/ })).toBeNull();
  });
});
