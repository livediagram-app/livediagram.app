// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Cards", Links: the links read as rows, and Add Link opens a form straight under
// them: Label takes focus, the address lists the document's tabs, Enter adds, Escape cancels.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLink, Tab } from '@livedesign/document';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardLinksCard } from './DashboardLinksCard';

afterEach(cleanup);

const TABS = [
  { id: 'r', name: 'Roadmap', kind: 'board', elements: [] },
  { id: 'b', name: 'Budget', kind: 'sheet', elements: [] },
] as unknown as Tab[];

function show(links: DashboardLink[], canEdit = true) {
  const setSlotContent = vi.fn();
  const openTab = vi.fn();
  const value = {
    tabs: TABS,
    elements: new Map(),
    canEdit,
    actions: { setSlotContent },
    openTab,
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardLinksCard slotId="s" links={{ title: 'Links', links }} />
    </DashboardContext.Provider>,
  );
  return { setSlotContent, openTab };
}

const saved = (fn: ReturnType<typeof vi.fn>) =>
  (fn.mock.calls.at(-1)![1] as { links: DashboardLink[] }).links;

describe('a Links card’s rows', () => {
  it('shows each link’s label over its host, and a tab link opens its tab', () => {
    const { openTab } = show([
      { id: '1', label: 'Docs', url: 'https://example.com/docs' },
      { id: '2', label: '', tabId: 'r' },
    ]);
    expect(screen.getByText('Docs')).toBeTruthy();
    expect(screen.getByText('example.com/docs')).toBeTruthy();
    fireEvent.click(screen.getByText('Roadmap'));
    expect(openTab).toHaveBeenCalledWith('r');
    expect(screen.getByRole('link').getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('removes a link by its ×, for an Editor only', () => {
    const { setSlotContent } = show([{ id: '1', label: 'Docs', url: 'https://example.com' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Docs' }));
    expect(saved(setSlotContent)).toEqual([]);
    cleanup();
    show([{ id: '1', label: 'Docs', url: 'https://example.com' }], false);
    expect(screen.queryByRole('button', { name: 'Remove Docs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Link' })).toBeNull();
  });
});

describe('Add Link', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Add Link' }));

  it('focuses Label, and adds a site with Enter', () => {
    const { setSlotContent } = show([]);
    open();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Label' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), { target: { value: 'Site' } });
    const address = screen.getByRole('combobox', { name: 'Address' });
    fireEvent.change(address, { target: { value: 'example.com' } });
    fireEvent.submit(address.closest('form')!);
    expect(saved(setSlotContent)).toMatchObject([{ label: 'Site', url: 'https://example.com/' }]);
  });

  it('lists the document’s tabs under the address, picked with the arrow keys and Enter', () => {
    const { setSlotContent } = show([]);
    open();
    const address = screen.getByRole('combobox', { name: 'Address' });
    fireEvent.focus(address);
    fireEvent.change(address, { target: { value: 'bud' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Budget']);
    fireEvent.keyDown(address, { key: 'ArrowDown' });
    fireEvent.keyDown(address, { key: 'Enter' });
    expect((address as HTMLInputElement).value).toBe('Budget');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.submit(address.closest('form')!);
    expect(saved(setSlotContent)).toMatchObject([{ label: '', tabId: 'b' }]);
  });

  it('says what is wrong with an address it cannot link', () => {
    const { setSlotContent } = show([]);
    open();
    const address = screen.getByRole('combobox', { name: 'Address' });
    fireEvent.change(address, { target: { value: 'ftp://nope' } });
    fireEvent.submit(address.closest('form')!);
    expect(screen.getByRole('alert').textContent).toMatch(/Enter a web address/);
    expect(setSlotContent).not.toHaveBeenCalled();
  });

  it('cancels with Escape once the list is closed', () => {
    show([]);
    open();
    const address = screen.getByRole('combobox', { name: 'Address' });
    fireEvent.focus(address);
    fireEvent.keyDown(address, { key: 'Escape' });
    expect(screen.getByRole('combobox', { name: 'Address' })).toBeTruthy();
    fireEvent.keyDown(address, { key: 'Escape' });
    expect(screen.queryByRole('combobox', { name: 'Address' })).toBeNull();
    open();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Label' }), { key: 'Escape' });
    expect(screen.queryByRole('form', { name: 'Add Link' })).toBeNull();
  });

  it('shows no links as the shared empty state, pointing an Editor at Add Link', () => {
    show([]);
    expect(screen.getByText('No links yet').closest('[data-empty-state]')).toBeTruthy();
    expect(screen.getByText(/Add Link puts a site/)).toBeTruthy();
    cleanup();
    show([], false);
    expect(screen.getByText('No links yet')).toBeTruthy();
    expect(screen.queryByText(/Add Link puts a site/)).toBeNull();
  });
});
