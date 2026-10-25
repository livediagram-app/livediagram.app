// Lists that span places (Recent, Favourites, Search) say where each item lives, and Recent and Search say whose it
// is, as livediagram's list does.
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from './Explorer';
import { ownerLabel } from './rows';

const folder: Folder = {
  id: 'f1',
  name: 'Launch',
  parentId: null,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
};

const teamName = (id: string | null) => (id === 't1' ? 'Design' : null);

describe('ownerLabel', () => {
  it('names the team, a sharer as Shared with you, otherwise You', () => {
    expect(ownerLabel({ teamId: 't1', ownerId: 'x', sharedVia: null }, 'user_me', teamName)).toBe(
      'Design',
    );
    expect(ownerLabel({ teamId: null, ownerId: 'x', sharedVia: 'c' }, 'user_me', teamName)).toBe(
      'Shared with you',
    );
    expect(
      ownerLabel({ teamId: null, ownerId: 'user_me', sharedVia: null }, 'user_me', teamName),
    ).toBe('You');
  });
});

describe('Recent rows', () => {
  beforeEach(() => localStorage.setItem('liveworkspace:explorer-view-mode', 'list'));

  it('carry a location chip (folder, My Work, team) and an Owner column', async () => {
    const opened = { lastOpenedAt: 5_000_000 };
    const items = [
      makeItem(1, { ...opened, folderId: 'f1' }),
      makeItem(2, { ...opened }),
      makeItem(3, { ...opened, teamId: 't1', ownerId: 'user_other' }),
      makeItem(4, { ...opened, ownerId: 'user_other', sharedVia: 'code', access: 'view' }),
    ];
    const index = createFakeIndex({ items, folders: [folder] });
    render(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'recent' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        viewerId="user_me"
        teams={[{ id: 't1', name: 'Design' }]}
      />,
    );
    const row = (i: number) => document.querySelector(`[data-item-row="item-${i}"]`);
    await waitFor(() => expect(row(4)).toBeTruthy());
    await waitFor(() => expect(row(1)!.textContent).toContain('Launch'));
    expect(row(2)!.textContent).toContain('My Work');
    expect(row(3)!.textContent).toContain('Design');
    // Reached through a link: it lives in someone else's library, so no chip.
    expect(row(4)!.querySelector('button[title]')).toBeNull();
    expect(row(1)!.textContent).toContain('You');
    expect(row(4)!.textContent).toContain('Shared with you');
    expect(document.body.textContent).toContain('Owner');
  });
});
