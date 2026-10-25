// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';

// /new's Jump Back In (docs/specs/007-editor/new-document-route.md):
// your newest canvases and your teams', as the index lists them, merged by save, a team one marked with its team.

const page = vi.hoisted(() => ({ items: [] as Partial<Item>[] }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: { listItems: async () => ({ items: page.items, nextCursor: null }) },
}));
// A token naming the Design team (its `teams` claim).
const token = `x.${btoa(JSON.stringify({ teams: [{ id: 'team-1', name: 'Design' }] }))}.y`;
vi.mock('@/lib/api/core', () => ({ currentBearer: async () => token }));
vi.mock('@/hooks/persistence/useAfterDriveChange', () => ({ useAfterDriveChange: () => {} }));

import { RecentDocumentsCard } from './RecentDocumentsCard';

afterEach(cleanup);

const item = (id: string, updatedAt: number, over: Partial<Item> = {}): Partial<Item> => ({
  id,
  title: `Doc ${id}`,
  updatedAt,
  teamId: null,
  trashedAt: null,
  sharedVia: null,
  ...over,
});

describe('RecentDocumentsCard', () => {
  it('merges team canvases by save time, marks them, and counts them', async () => {
    page.items = [item('mine', 1), item('team', 2, { teamId: 'team-1' })];
    const onCount = vi.fn();
    render(<RecentDocumentsCard ownerId="owner" onCount={onCount} />);

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(3));
    const [team, mine] = screen.getAllByRole('link');
    expect(team!.getAttribute('href')).toBe('/document/team');
    expect(team!.textContent).toContain('Design team: Doc team');
    expect(mine!.getAttribute('href')).toBe('/document/mine');
    expect(mine!.textContent).not.toContain('team:');
    expect(onCount).toHaveBeenCalledWith(2);
  });

  it('leaves out the Trash, link-only canvases and the ones hidden from Recent', async () => {
    page.items = [
      item('kept', 1),
      item('binned', 2, { trashedAt: 5 }),
      item('linked', 3, { sharedVia: 'code' }),
      item('hidden', 4, { hiddenFromRecent: true }),
    ];
    const onCount = vi.fn();
    render(<RecentDocumentsCard ownerId="owner" onCount={onCount} />);
    await waitFor(() => expect(onCount).toHaveBeenCalledWith(2));
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/document/kept');
    expect(hrefs).not.toContain('/document/binned');
    expect(hrefs).not.toContain('/document/linked');
    expect(hrefs).not.toContain('/document/hidden');
  });
});
