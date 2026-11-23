// @vitest-environment jsdom

// Publish to the Web (docs/specs/030-knowledgebase/publishing.md "The dialog"): the state, the preview of what goes
// public and what stays private, the address's checks, Publish, Update Site and Unpublish.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishingState } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';

const api = vi.hoisted(() => ({
  apiPublishingState: vi.fn(),
  apiPublish: vi.fn(),
  apiUnpublish: vi.fn(),
}));
vi.mock('@/lib/api/publishing', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));

import { track } from '@/lib/telemetry';
import { closePublishing, openPublishing } from '@/lib/publishing/publish-open';
import { chromeValue, page, renderInEditor } from '@/components/ask/test-chrome';
import { PREVIEW_PAGES_SHOWN, PublishHost } from './PublishDialog';

const TABS = [
  page('p1', 'Release Process'),
  page('p2', 'Hotfixes', 'p1'),
  page('p3', 'Onboarding'),
  page('p4', 'First Week', 'p3'),
  page('p5', ' '),
];

const state = (over: Partial<PublishingState> = {}): PublishingState => ({
  offered: true,
  published: false,
  site: null,
  defaultAddress: 'handbook',
  preview: {
    root: null,
    pages: [
      { id: 'p1', title: 'Release Process' },
      { id: 'p2', title: 'Hotfixes' },
    ],
    leftOut: [
      { id: 'p3', title: 'Onboarding', reason: 'pending' },
      { id: 'p4', title: 'First Week', reason: 'empty' },
    ],
  },
  ...over,
});
const live = (over: Partial<PublishingState> = {}): PublishingState =>
  state({
    published: true,
    site: {
      address: 'handbook',
      url: 'https://www.liveknowledge.app/kb/handbook',
      root: null,
      noindex: false,
      showWriters: false,
      publishedAt: Date.UTC(2026, 10, 21, 12),
    },
    ...over,
  });

beforeEach(() => {
  api.apiPublishingState.mockResolvedValue(state());
});
afterEach(() => {
  cleanup();
  act(() => closePublishing());
  vi.clearAllMocks();
});

async function open(over: Record<string, unknown> = {}) {
  const utils = renderInEditor(<PublishHost />, chromeValue('edit', { tabs: TABS, ...over }));
  act(() => openPublishing());
  const dialog = await screen.findByRole('dialog', { name: 'Publish to the Web' });
  // The state's own line (a limit notice is a status too).
  const status = () => dialog.querySelector('[data-publish-status] [role="status"]')!;
  await waitFor(() => expect(status().textContent).not.toBe(''));
  return { ...utils, dialog };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const address = () => document.querySelector<HTMLInputElement>('[data-publish-address]')!;

describe('Publish to the Web', () => {
  it('shows a private knowledgebase, what would go public and what stays private', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByRole('status').textContent).toBe('Not Published');
    expect(address().value).toBe('handbook');
    const preview = dialog.querySelector('[data-publish-preview]')!;
    expect(preview.textContent).toContain('2 pages go public · 2 pages stay private');
    expect(preview.textContent).toContain('Release Process');
    expect(preview.querySelector('[data-publish-left-out="pending"]')!.textContent).toContain(
      'Pending Approval',
    );
    expect(preview.querySelector('[data-publish-left-out="empty"]')!.textContent).toContain(
      'No Writing Yet',
    );
    // The sections are the pages with subpages, and an untitled one says so.
    const options = [...dialog.querySelectorAll('[data-publish-root] option, select option')].map(
      (o) => o.textContent?.trim(),
    );
    expect(options).toEqual([
      'The Whole Knowledgebase',
      'Release Process and Its Subpages',
      'Onboarding and Its Subpages',
    ]);
    expect(screen.queryByRole('button', { name: 'Unpublish' })).toBeNull();
  });

  it('publishes with what was chosen and shows the site', async () => {
    api.apiPublish.mockResolvedValue(live({ site: { ...live().site!, noindex: true } }));
    const { dialog } = await open();
    fireEvent.change(address(), { target: { value: 'Acme Help' } });
    expect(address().value).toBe('acme-help');
    fireEvent.click(within(dialog).getByRole('switch', { name: /Hide From Search Engines/ }));
    fireEvent.click(button('Publish'));
    await waitFor(() =>
      expect(within(dialog).getByRole('status').textContent).toBe('Live on the Web'),
    );
    expect(api.apiPublish).toHaveBeenCalledWith({ ownerId: 'me', shareCode: null }, 'd1', {
      address: 'acme-help',
      root: null,
      noindex: true,
      showWriters: false,
    });
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'PublishSite');
    expect(dialog.querySelector('[data-publish-url]')!.textContent).toBe(
      'www.liveknowledge.app/kb/handbook',
    );
    expect(dialog.querySelector('[data-publish-date]')!.textContent).toMatch(/^Published /);
  });

  it('previews a section when one is chosen', async () => {
    const { dialog } = await open();
    api.apiPublishingState.mockResolvedValue(
      state({
        preview: { root: 'p1', pages: [{ id: 'p1', title: 'Release Process' }], leftOut: [] },
      }),
    );
    fireEvent.change(dialog.querySelector('select')!, { target: { value: 'p1' } });
    await waitFor(() =>
      expect(api.apiPublishingState).toHaveBeenLastCalledWith(
        { ownerId: 'me', shareCode: null },
        'd1',
        'p1',
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() =>
      expect(dialog.querySelector('[data-publish-preview]')!.textContent).toContain(
        '1 page goes public',
      ),
    );
  });

  it('checks the address as it is typed', async () => {
    await open();
    fireEvent.change(address(), { target: { value: 'ab' } });
    expect(screen.getByText('An address is at least 3 characters.')).toBeTruthy();
    expect((button('Publish') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(address(), { target: { value: 'search' } });
    expect(
      screen.getByText('That address is kept for liveknowledge. Choose another.'),
    ).toBeTruthy();
    fireEvent.change(address(), { target: { value: 'a--b' } });
    expect(screen.getByText(/Use 3 to 48 lowercase letters/)).toBeTruthy();
    fireEvent.change(address(), { target: { value: 'fine-name' } });
    expect((button('Publish') as HTMLButtonElement).disabled).toBe(false);
  });

  it('says why a publish was refused', async () => {
    api.apiPublish.mockRejectedValue(new ApiError('publish', 409, 'address_taken'));
    await open();
    fireEvent.click(button('Publish'));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Another knowledgebase has that address. Choose another.',
    );
    expect(track).not.toHaveBeenCalled();
  });

  it('counts the pages past the first few', async () => {
    const pages = Array.from({ length: PREVIEW_PAGES_SHOWN + 3 }, (_, i) => ({
      id: `x${i}`,
      title: `Page ${i}`,
    }));
    api.apiPublishingState.mockResolvedValue(
      state({ preview: { root: null, pages, leftOut: [] } }),
    );
    const { dialog } = await open();
    const preview = dialog.querySelector('[data-publish-preview]')!;
    expect(preview.textContent).toContain('11 pages go public');
    expect(preview.textContent).toContain('and 3 more');
    expect(preview.textContent).not.toContain('pages stay private');
  });

  it('cannot publish when nothing may go public, or publishing is not offered', async () => {
    api.apiPublishingState.mockResolvedValue(
      state({ offered: false, preview: { root: null, pages: [], leftOut: [] } }),
    );
    await open();
    expect(screen.getByText("Publishing isn't available for this knowledgebase.")).toBeTruthy();
    expect((button('Publish') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers Try Again when the state cannot be read', async () => {
    api.apiPublishingState.mockRejectedValueOnce(new Error('offline'));
    renderInEditor(<PublishHost />, chromeValue('edit', { tabs: TABS }));
    act(() => openPublishing());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("What is published couldn't be read.");
    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Not Published'));
  });
});

describe('a published site', () => {
  beforeEach(() => api.apiPublishingState.mockResolvedValue(live()));

  it('is Done until something changes, then Update Site', async () => {
    api.apiPublish.mockResolvedValue(live({ site: { ...live().site!, showWriters: true } }));
    const { dialog } = await open();
    expect(screen.queryByRole('button', { name: 'Update Site' })).toBeNull();
    expect(button('Done')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('switch', { name: /Show Who Wrote Each Page/ }));
    fireEvent.change(address(), { target: { value: 'acme' } });
    expect(screen.getByText('The old address will lead readers to the new one.')).toBeTruthy();
    fireEvent.change(address(), { target: { value: 'handbook' } });
    fireEvent.click(button('Update Site'));
    await waitFor(() => expect(api.apiPublish).toHaveBeenCalledTimes(1));
    expect(api.apiPublish.mock.calls[0]![2]).toMatchObject({
      showWriters: true,
      address: 'handbook',
    });
    await waitFor(() => expect(button('Done')).toBeTruthy());
  });

  it('copies the link', async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    await open();
    fireEvent.click(button("Copy the site's link"));
    await waitFor(() => expect(button("Copy the site's link").textContent).toContain('Copied'));
    expect(writeText).toHaveBeenCalledWith('https://www.liveknowledge.app/kb/handbook');
  });

  it('unpublishes once asked, and says when it could not', async () => {
    api.apiUnpublish.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(state());
    const { dialog } = await open();
    const unpublish = () => {
      fireEvent.click(button('Unpublish'));
      const confirm = screen.getByRole('dialog', { name: 'Unpublish This Site?' });
      expect(confirm.textContent).toContain('/kb/handbook is let go');
      fireEvent.click(within(confirm).getByRole('button', { name: 'Unpublish' }));
    };
    unpublish();
    expect((await screen.findByRole('alert')).textContent).toBe(
      "The site couldn't be unpublished. Check your connection.",
    );
    unpublish();
    await waitFor(() =>
      expect(within(dialog).getByRole('status').textContent).toBe('Not Published'),
    );
    expect(track).toHaveBeenCalledWith('UI', 'Removed', 'PublishSite');
  });

  it('closes when another knowledgebase opens', async () => {
    const { store } = await open();
    act(() => store.set({ ...store.get(), documentId: 'd2' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Publish to the Web' })).toBeNull(),
    );
  });
});

describe('at the owner’s tier’s limit (Pro on)', () => {
  beforeEach(() => setProForTests(true));
  afterEach(() => setProForTests(null));
  const limit = () => document.querySelector('[data-publish-limit]');

  it('says so above What to Publish while every one the tier allows is published', async () => {
    api.apiPublishingState.mockResolvedValue(
      state({ usage: { used: 1, limit: 1 }, owner: 'p:user_me' }),
    );
    await open();
    expect(limit()!.textContent).toContain(
      'You have 1 public Knowledgebase, the most Free publishes. Unpublish one to publish this.',
    );
    // Publish stays on: the numbers may be from before an upgrade.
    expect((button('Publish') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows nothing below the limit, while published, or with no count', async () => {
    api.apiPublishingState.mockResolvedValue(state({ usage: { used: 0, limit: 1 } }));
    await open();
    expect(limit()).toBeNull();
    cleanup();
    act(() => closePublishing());
    api.apiPublishingState.mockResolvedValue(live({ usage: { used: 1, limit: 1 } }));
    await open();
    expect(limit()).toBeNull();
    cleanup();
    act(() => closePublishing());
    api.apiPublishingState.mockResolvedValue(state({ usage: { limit: 1 } }));
    await open();
    expect(limit()).toBeNull();
  });

  it('shows a refused publish’s own numbers, not as a failure, and clears them once one lands', async () => {
    api.apiPublish.mockRejectedValueOnce(
      new ApiError('publish', 409, 'publish_limit_reached', {
        error: 'publish_limit_reached',
        limit: 'publicKnowledgebases',
        used: 1,
        max: 1,
      }),
    );
    await open();
    fireEvent.click(button('Publish'));
    await waitFor(() => expect(limit()).not.toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    api.apiPublish.mockResolvedValue(live());
    fireEvent.click(button('Publish'));
    await waitFor(() => expect(limit()).toBeNull());
  });
});
