// @vitest-environment jsdom

// The Share dialog's scope controls (docs/specs/013-workspace/tab-scoped-share-links.md): a new link can be
// scoped to one tab, an existing link can be rescoped, and a scoped link's
// live image always shows its own tab.

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  documentId: 'd1',
  role: 'view',
  createdAt: 1,
  expiry: 'never',
  expiresAt: null,
  tabId: null,
  purpose: 'share',
  ...over,
});

function renderDialog(over: Partial<ShareDialogProps> = {}) {
  const props: ShareDialogProps = {
    participant: { id: 'me', name: 'Ada', color: '#0ea5e9', status: 'online' },
    links: [],
    sharePassword: null,
    shareUrlFor: (code) => `https://x.test/document/shared?s=${code}`,
    tabs: TABS,
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

// Finish a row's CSS animation. jsdom has no AnimationEvent, so React listens
// for the prefixed name there (real browsers get the standard one).
function endAnimation(el: Element) {
  act(() => {
    el.dispatchEvent(new Event('webkitAnimationEnd', { bubbles: true }));
  });
}

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

  it('hides the scope control on a single-tab document', () => {
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

// The pass redesign (docs/specs/007-editor/live-app.md "Share dialog").
describe('ShareDialog passes', () => {
  it('issues a view pass from the Viewer card and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const created = link({ code: 'NEW23456', role: 'view' });
    const props = renderDialog({ onCreateLink: vi.fn().mockResolvedValue(created) });
    fireEvent.click(screen.getByRole('radio', { name: /Viewer/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Pass' }));
    await vi.waitFor(() => expect(props.onCreateLink).toHaveBeenCalledWith('view', 'never', null));
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://x.test/document/shared?s=NEW23456'),
    );
  });

  it('issues the pass with the lifetime picked on the Valid control', async () => {
    const props = renderDialog();
    const forever = screen.getByRole('radio', { name: 'Forever' });
    expect(forever.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: '1 month' }));
    fireEvent.click(screen.getByRole('button', { name: /Create Pass/ }));
    await vi.waitFor(() => expect(props.onCreateLink).toHaveBeenCalledWith('edit', 'month', null));
  });

  it('confirms before revoking a pass', async () => {
    const props = renderDialog({ links: [link()] });
    fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
    expect(props.onRevokeLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onRevokeLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    // The pass closes its space first; the revoke waits for that close.
    const row = screen.getByLabelText('View pass link').closest('li')!;
    expect(row.className).toContain('animate-row-close');
    expect(props.onRevokeLink).not.toHaveBeenCalled();
    endAnimation(row);
    await vi.waitFor(() => expect(props.onRevokeLink).toHaveBeenCalledWith('CODE2345'));
  });

  it('copies a pass from the button inside its link field', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderDialog({ links: [link()] });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://x.test/document/shared?s=CODE2345'),
    );
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy());
  });

  it('opens a pass back up when its revoke fails', async () => {
    // The handler resolves but the link stays in the list (the failure path).
    const props = renderDialog({
      links: [link()],
      onRevokeLink: vi.fn().mockResolvedValue(undefined),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    const row = screen.getByLabelText('View pass link').closest('li')!;
    endAnimation(row);
    await vi.waitFor(() => expect(props.onRevokeLink).toHaveBeenCalled());
    await vi.waitFor(() => expect(row.className).toContain('animate-row-open'));
  });

  it('says the document is public while it is listed in the Community', () => {
    renderDialog({ communityListed: true });
    expect(screen.getByRole('status').textContent).toMatch(/^Public: in the Community/);
    cleanup();
    renderDialog({ links: [link()], communityListed: true });
    expect(screen.getByRole('status').textContent).toMatch(/^Public: in the Community/);
  });

  it('says the document is private until a pass is live', () => {
    renderDialog();
    expect(screen.getByRole('status').textContent).toMatch(/Private: only you can open it/);
    cleanup();
    renderDialog({ links: [link()], sharePassword: 'pw' });
    expect(screen.getByRole('status').textContent).toMatch(
      /anyone holding the pass can get in, with the password/,
    );
  });

  it('lists an expired pass under Expired with Extend', () => {
    renderDialog({ links: [link({ expiry: 'week', expiresAt: 5 })] });
    // The caption reads "Expired" with its count in a badge.
    expect(document.getElementById('share-expired-heading')?.textContent).toBe('Expired1');
    expect(screen.getByRole('button', { name: 'Extend 1 week' })).toBeTruthy();
  });

  it('reveals the password field behind the switch, and removes a saved one when switched off', async () => {
    const onSetPassword = vi.fn().mockResolvedValue(null);
    renderDialog({ onSetPassword });
    expect(screen.queryByLabelText('Share password')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: /Password Protection/ }));
    expect(screen.getByLabelText('Share password')).toBeTruthy();
    cleanup();
    renderDialog({ onSetPassword, sharePassword: 'pw' });
    fireEvent.click(screen.getByRole('switch', { name: /Password Protection/ }));
    await vi.waitFor(() => expect(onSetPassword).toHaveBeenCalledWith(null));
  });

  it("saves a guest's edited name when the dialog closes", async () => {
    const props = renderDialog({ lockedName: null });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Grace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await vi.waitFor(() => expect(props.onSaveName).toHaveBeenCalledWith('Grace'));
    expect(props.onClose).toHaveBeenCalled();
  });
});
