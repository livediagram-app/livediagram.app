import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import { Explorer } from './Explorer';

// A folder link that no longer leads anywhere (deleted, moved out of reach, a stale bookmark) says so, with the way
// back, rather than "Couldn't load this list. Try again", which no retry ever fixed.
function renderFolder(index: ReturnType<typeof createFakeIndex>) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'folder', id: 'gone' }}
      onNavigate={vi.fn()}
      itemHref={(item) => `/open/${item.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
    />,
  );
}

describe('a folder that is gone', () => {
  it('shows Folder not found, an h2 under the pane’s own h1, and no Try again', async () => {
    const index = createFakeIndex();
    index.fail.set('listItems', new IndexError(404, 'folder_not_found'));
    renderFolder(index);
    expect(await screen.findByRole('heading', { level: 2, name: 'Folder not found' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByText(/Couldn’t load this list/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to your plans' })).toBeTruthy();
  });

  it('still offers Try again when the read failed for another reason', async () => {
    const index = createFakeIndex();
    index.fail.set('listItems', new IndexError(500, 'unknown'));
    renderFolder(index);
    expect(await screen.findByText(/Couldn’t load this list/)).toBeTruthy();
    expect(screen.queryByText('Folder not found')).toBeNull();
  });
});
