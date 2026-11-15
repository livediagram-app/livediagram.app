// @vitest-environment jsdom
// The Explorer's List and Cards layouts, and the dialogs it opens, held to axe's screen reader rules (the Details
// table's are in details-shared.test.tsx). Colour contrast and whole-page rules are the apps' own guards' (axe.js).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import { axeViolations } from '@liveworkspace/vitest-config/axe';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { MoveToFolderDialog } from '../dialogs/MoveToFolderDialog';
import { Explorer } from './Explorer';
import { VIEW_MODE_KEY } from './useViewMode';

const folder = (id: string, name: string): Folder => ({
  id,
  name,
  parentId: null,
  teamId: null,
  ownerId: 'user_me',
  createdAt: Date.UTC(2026, 0, 2),
  updatedAt: Date.UTC(2026, 0, 3),
});

function page(index: ReturnType<typeof createFakeIndex>, view: ExplorerView) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={view}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
    />,
  );
}

const seeded = () =>
  createFakeIndex({
    items: [makeItem(1, { title: 'Zebra' }), makeItem(2, { title: 'apple', favourite: true })],
    folders: [folder('f1', 'Specs')],
  });

describe.each(['list', 'card'] as const)('the Explorer in its %s layout', (mode) => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(VIEW_MODE_KEY, mode);
  });

  it('has no axe violations on a folder with plans in it', async () => {
    page(seeded(), { kind: 'all' });
    await screen.findByText('Zebra');
    expect(await axeViolations()).toEqual([]);
  });

  it('has none on Recent, Favourites and an empty folder', async () => {
    for (const view of [{ kind: 'recent' }, { kind: 'favourites' }] as ExplorerView[]) {
      const r = page(seeded(), view);
      await waitFor(() => expect(r.container.textContent).not.toBe(''));
      expect(await axeViolations(), `${view.kind}`).toEqual([]);
      r.unmount();
    }
    const empty = page(createFakeIndex(), { kind: 'all' });
    await screen.findByRole('button', { name: /^New / });
    expect(await axeViolations()).toEqual([]);
    empty.unmount();
  });

  it('has none with an item menu open', async () => {
    page(seeded(), { kind: 'all' });
    await screen.findByText('Zebra');
    fireEvent.click(screen.getByRole('button', { name: 'Menu for Zebra' }));
    await screen.findByRole('menu');
    expect(await axeViolations()).toEqual([]);
  });

  it('has none with a folder menu open', async () => {
    page(seeded(), { kind: 'all' });
    await screen.findByText('Zebra');
    fireEvent.click(screen.getAllByRole('button', { name: /Menu for (folder )?Specs/ }).at(-1)!);
    await screen.findByRole('menu');
    expect(await axeViolations()).toEqual([]);
  });
});

describe("the Explorer's own dialogs", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(VIEW_MODE_KEY, 'list');
  });

  it('has none on the Move to Folder dialog', async () => {
    render(
      <MoveToFolderDialog
        subjectName="Roadmap"
        subjectKind="item"
        personalFolders={[{ id: 'f1', name: 'Specs', parentId: null }]}
        teams={[]}
        onCreateFolder={vi.fn()}
        onCreateTeam={vi.fn()}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByRole('dialog', {}, { timeout: 5000 });
    expect(await axeViolations()).toEqual([]);
  });

  // The item menu's own dialogs, each opened the way a person does: a menu, then its entry.
  for (const entry of ['Change Folder', 'Share', 'History', 'Webhooks']) {
    it(`has none on the ${entry} dialog an item menu opens`, async () => {
      page(seeded(), { kind: 'all' });
      await screen.findByText('Zebra');
      fireEvent.click(screen.getByRole('button', { name: 'Menu for Zebra' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: entry }));
      await screen.findByRole('dialog', {}, { timeout: 5000 });
      expect(await axeViolations()).toEqual([]);
    });
  }

  it('has none on the Delete confirmation a folder menu opens', async () => {
    page(seeded(), { kind: 'all' });
    await screen.findByText('Zebra');
    fireEvent.click(screen.getAllByRole('button', { name: /Menu for (folder )?Specs/ }).at(-1)!);
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Delete/ }));
    await screen.findByRole('dialog', {}, { timeout: 5000 });
    expect(await axeViolations()).toEqual([]);
  });
});
