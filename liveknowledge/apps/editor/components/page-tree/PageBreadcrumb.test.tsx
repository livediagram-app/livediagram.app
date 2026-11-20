// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveknowledge/document';
import {
  createEditorChromeStore,
  EditorChromeContext,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { PageBreadcrumb } from './PageBreadcrumb';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Breadcrumb": the page's ancestors above its title, each a
// link; none for a top-level page.

const tab = (id: string, name: string, parent?: string): Tab => ({
  id,
  name,
  elements: [],
  ...(parent ? { parent } : {}),
});
const TABS = [tab('a', 'Handbook'), tab('b', 'Release Process', 'a'), tab('c', 'Checklist', 'b')];

function mount(activeId: string, tabs: Tab[] = TABS) {
  const setActiveId = vi.fn();
  const fields: Record<string, unknown> = { tabs, activeId, setActiveId };
  const value = new Proxy(fields, {
    get: (target, key: string) => (key in target ? target[key] : vi.fn()),
  }) as unknown as EditorContextValue;
  const store = createEditorChromeStore(value);
  render(
    <EditorChromeContext.Provider value={store}>
      <PageBreadcrumb />
    </EditorChromeContext.Provider>,
  );
  return { store, setActiveId, value };
}

afterEach(cleanup);

describe('PageBreadcrumb', () => {
  it('lists the page’s ancestors, the top-level one first, each a link', () => {
    mount('c');
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Handbook', 'Release Process']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#t=a', '#t=b']);
    expect(nav.textContent).not.toContain('Checklist');
  });

  it('shows nothing for a top-level page', () => {
    mount('a');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('opens the ancestor on a click, and leaves a new-tab click to the browser', () => {
    const { setActiveId } = mount('c');
    fireEvent.click(screen.getByRole('link', { name: 'Handbook' }));
    expect(setActiveId).toHaveBeenCalledWith('a');
    const modified = fireEvent.click(screen.getByRole('link', { name: 'Release Process' }), {
      metaKey: true,
    });
    // Not prevented: the browser follows the link itself.
    expect(modified).toBe(true);
    expect(setActiveId).toHaveBeenCalledTimes(1);
  });

  it('follows a rename and a move, and nothing else', () => {
    const { store, value } = mount('c');
    const next = (tabs: Tab[]): EditorContextValue =>
      new Proxy(value, {
        get: (target, key: string): unknown => (key === 'tabs' ? tabs : Reflect.get(target, key)),
      });
    act(() => store.set(next([tab('a', 'Guide'), TABS[1]!, TABS[2]!])));
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Guide',
      'Release Process',
    ]);
    act(() => store.set(next([tab('a', 'Guide'), TABS[1]!, tab('c', 'Checklist')])));
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('renders nothing with no editor around it', () => {
    render(<PageBreadcrumb />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
