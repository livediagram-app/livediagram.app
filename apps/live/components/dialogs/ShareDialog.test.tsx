// @vitest-environment jsdom

// The Share dialog's scope controls (docs/specs/013-workspace/tab-scoped-share-links.md): a new link can be
// scoped to one tab, an existing link can be rescoped, and a scoped link's
// live image always shows its own tab.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShareLink } from '@/lib/api-client';
import { ShareDialog } from './ShareDialog';
import type { ShareDialogProps } from './ShareDialog.types';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const TABS = [
  { id: 't1', name: 'Pricing' },
  { id: 't2', name: 'Roadmap' },
];

const link = (over: Partial<ShareLink> = {}): ShareLink => ({
  code: 'CODE2345',
  diagramId: 'd1',
  role: 'view',
  createdAt: 1,
  expiry: 'never',
  expiresAt: null,
  tabId: null,
  ...over,
});

function renderDialog(over: Partial<ShareDialogProps> = {}) {
  const props: ShareDialogProps = {
    participant: { id: 'me', name: 'Ada', color: '#0ea5e9', status: 'online' },
    links: [],
    sharePassword: null,
    shareUrlFor: (code) => `https://x.test/diagram/shared?s=${code}`,
    tabs: TABS,
    nameConfirmed: true,
    lockedName: 'Ada',
    onSaveName: vi.fn(),
    onCreateLink: vi.fn(),
    onRevokeLink: vi.fn(),
    onRescopeLink: vi.fn(),
    onExtendLink: vi.fn(),
    onSetPassword: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<ShareDialog {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
});

describe('ShareDialog scope', () => {
  it('creates an All-tabs link by default', async () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await vi.waitFor(() => expect(props.onCreateLink).toHaveBeenCalledWith('edit', 'never', null));
  });

  it('creates a link scoped to the tab picked', async () => {
    const props = renderDialog();
    fireEvent.change(screen.getByRole('combobox', { name: 'Tabs this link opens' }), {
      target: { value: 't2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await vi.waitFor(() => expect(props.onCreateLink).toHaveBeenCalledWith('edit', 'never', 't2'));
  });

  it('offers All tabs and every tab by name, in bar order', () => {
    renderDialog();
    const options = within(
      screen.getByRole('combobox', { name: 'Tabs this link opens' }),
    ).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['All tabs', 'Pricing', 'Roadmap']);
  });

  it('hides the scope control on a single-tab diagram', () => {
    renderDialog({ tabs: [TABS[0]!], links: [link()] });
    expect(screen.queryByRole('combobox', { name: 'Tabs this link opens' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Tabs link .* opens/ })).toBeNull();
  });

  it("shows each link's scope and rescopes it", async () => {
    const props = renderDialog({ links: [link({ tabId: 't2' })] });
    const select = screen.getByRole('combobox', { name: 'Tabs link CODE2345 opens' });
    expect((select as HTMLSelectElement).value).toBe('t2');
    fireEvent.change(select, { target: { value: '' } });
    await vi.waitFor(() => expect(props.onRescopeLink).toHaveBeenCalledWith('CODE2345', null));
  });

  it("gives a scoped link's live image no tab picker: it is always its tab", () => {
    renderDialog({ links: [link({ tabId: 't2' })] });
    fireEvent.click(screen.getByRole('button', { name: /live image/i }));
    expect(screen.queryByText('Tab', { selector: 'label' })).toBeNull();
  });
});
