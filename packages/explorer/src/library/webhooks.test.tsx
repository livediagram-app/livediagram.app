// Webhooks on an item's menu (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): offered to a signed-in
// account who edits the item, never to a Viewer, a Participant, a guest or in the Trash; it opens the document's own
// Webhooks dialog, headed by the document and saying the webhooks are its alone.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, Level } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';

// The dialog's body is settings-ui's own (and tested there): a stub that shows what it was handed.
// The shared dialog stands in as its props: the Explorer's part is the row, the document and the link it hands over.
vi.mock('@liveworkspace/settings-ui/webhooks', () => ({
  DocumentWebhooksDialog: (props: {
    itemId: string;
    app: string;
    title: string;
    share: { code: string } | null;
  }) => (
    <div role="dialog" aria-label={`Webhooks for ${props.title}`}>
      <div data-testid="document-webhooks">
        {props.itemId} {props.app} {props.title} {props.share?.code ?? 'no-link'}
      </div>
    </div>
  ),
}));

function page(item: Item, { signedIn = true, trash = false } = {}) {
  render(
    <Explorer
      app="livediagram"
      client={createFakeIndex({ items: [item] }).client}
      view={trash ? { kind: 'trash' } : { kind: 'all' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/d/${i.id}`}
      onCreate={vi.fn()}
      viewerId={signedIn ? 'user_me' : 'guest_me'}
      signedIn={signedIn}
      heroHidden
    />,
  );
}

const canvas = (over: Partial<Item> = {}) =>
  makeItem(1, { app: 'livediagram', kind: 'canvas', title: 'Roadmap', ...over });

const openMenu = async () =>
  fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Roadmap' }))[0]!);

describe('Webhooks on an item’s menu', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('liveworkspace:explorer-view-mode', 'details');
  });

  it('sits after History for an editor who is signed in, and opens the document’s own dialog', async () => {
    page(canvas());
    await openMenu();
    const rows = (await screen.findAllByRole('menuitem')).map((r) => r.textContent);
    const at = rows.indexOf('Webhooks');
    expect(at).toBeGreaterThan(rows.indexOf('History'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Webhooks' }));
    await screen.findByRole('dialog', { name: 'Webhooks for Roadmap' });
    expect((await screen.findByTestId('document-webhooks')).textContent).toBe(
      'item-1 livediagram Roadmap no-link',
    );
  });

  it('hands an Editor through a link its share code', async () => {
    page(canvas({ ownerId: 'user_other', sharedVia: 'abc123' }));
    await openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Webhooks' }));
    expect((await screen.findByTestId('document-webhooks')).textContent).toBe(
      'item-1 livediagram Roadmap abc123',
    );
  });

  it.each<Level>(['view', 'participate'])('is not offered at %s', async (access) => {
    page(canvas({ ownerId: 'user_other', sharedVia: 'abc123', access }));
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: 'Open' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Webhooks' })).toBeNull();
  });

  it('is not offered to a guest', async () => {
    page(canvas(), { signedIn: false });
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: 'Open' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Webhooks' })).toBeNull();
  });

  it('is not offered in the Trash', async () => {
    page(canvas({ trashedAt: Date.now(), trashReason: 'deleted' }), { trash: true });
    await screen.findAllByText('Roadmap');
    const menus = screen.queryAllByRole('button', { name: 'Menu for Roadmap' });
    if (menus[0]) fireEvent.click(menus[0]);
    expect(screen.queryByRole('menuitem', { name: 'Webhooks' })).toBeNull();
  });
});
