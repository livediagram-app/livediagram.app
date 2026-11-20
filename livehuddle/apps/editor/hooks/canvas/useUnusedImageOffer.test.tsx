// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '@liveworkspace/ui/toast';
import type { Element, Tab } from '@livehuddle/document';

// docs/specs/009-elements/images.md "Deleting an unused picture", over this editor's tabs and api: who is offered
// it (docs/specs/013-workspace/share-roles.md), and what counts as used here.
const { apiUnusedImages, apiDeleteImage, isOfflineIdSync } = vi.hoisted(() => ({
  apiUnusedImages: vi.fn(),
  apiDeleteImage: vi.fn(),
  isOfflineIdSync: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ apiUnusedImages, apiDeleteImage }));
vi.mock('@/lib/offline/offline-store', () => ({ isOfflineIdSync }));

import type { UserPreferences } from '@/lib/user-preferences';
import { useUnusedImageOffer } from './useUnusedImageOffer';

const image = (id: string, imageId: string | null): Element => ({
  id,
  type: 'image',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  imageId,
});
const tab = (id: string, elements: Element[]): Tab => ({ id, name: id, elements });

type Role = {
  accountUserId?: string | null;
  isStructureReadOnly?: boolean;
  participating?: boolean;
  embedMode?: boolean;
  workbenchMode?: boolean;
  documentId?: string | null;
};

let offer: (removed: Element[]) => void = () => {};
const saved = vi.fn();
function Editor({
  tabs,
  loaded,
  failed = [],
  role,
  prefs = {},
}: {
  tabs: Tab[];
  loaded: string[];
  failed?: string[];
  role: Role;
  prefs?: UserPreferences;
}) {
  const made = useUnusedImageOffer({
    ownerId: 'user_ada',
    documentId: role.documentId === undefined ? 'd1' : role.documentId,
    accountUserId: 'accountUserId' in role ? role.accountUserId : 'user_ada',
    embedMode: role.embedMode ?? false,
    workbenchMode: role.workbenchMode ?? false,
    isStructureReadOnly: role.isStructureReadOnly ?? false,
    participating: role.participating ?? false,
    tabsRef: { current: tabs },
    loadedTabIdsRef: { current: new Set(loaded) },
    loadAllTabs: async () => failed,
    userPreferences: prefs,
    setUserPreferences: saved,
  });
  useEffect(() => {
    offer = made;
  });
  return null;
}

const mount = (props: Parameters<typeof Editor>[0]) =>
  render(
    <ToastProvider>
      <Editor {...props} />
    </ToastProvider>,
  );
const settle = async () => {
  for (let i = 0; i < 4; i++) await act(() => new Promise((r) => setTimeout(r, 0)));
};
const OFFER = 'This image isn’t used anywhere else. Delete it from storage? It can’t be undone.';

beforeEach(() => {
  apiUnusedImages.mockImplementation(async (_o: string, _d: string, ids: string[]) => ids);
  apiDeleteImage.mockResolvedValue(undefined);
  isOfflineIdSync.mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useUnusedImageOffer', () => {
  // images.md "Remember My Choice" and "The setting".
  it('saves the answer with Remember My Choice on, over the other preferences', async () => {
    mount({ tabs: [tab('t1', [])], loaded: ['t1'], role: {}, prefs: { reduceMotion: true } });
    act(() => offer([image('e1', 'img-1')]));
    await settle();
    fireEvent.click(screen.getByRole('switch', { name: 'Remember My Choice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep: leave the image in storage' }));
    expect(saved).toHaveBeenCalledWith({ reduceMotion: true, unusedImageChoice: 'keep' });
    expect(apiDeleteImage).not.toHaveBeenCalled();
  });

  it('Always Keep asks nothing and sends nothing', async () => {
    mount({
      tabs: [tab('t1', [])],
      loaded: ['t1'],
      role: {},
      prefs: { unusedImageChoice: 'keep' },
    });
    act(() => offer([image('e1', 'img-1')]));
    await settle();
    expect(apiUnusedImages).not.toHaveBeenCalled();
    expect(screen.queryByText(OFFER)).toBeNull();
  });

  it('Always Delete deletes the unused picture and says so', async () => {
    mount({
      tabs: [tab('t1', [])],
      loaded: ['t1'],
      role: {},
      prefs: { unusedImageChoice: 'delete' },
    });
    act(() => offer([image('e1', 'img-1')]));
    await settle();
    expect(apiDeleteImage).toHaveBeenCalledWith('user_ada', 'img-1');
    expect(
      screen.getByText('The image wasn’t used anywhere else, so it was deleted from storage.'),
    ).toBeTruthy();
  });

  it('Always Delete still asks the owner only, and keeps a picture used elsewhere', async () => {
    apiUnusedImages.mockResolvedValue([]);
    mount({
      tabs: [tab('t1', [])],
      loaded: ['t1'],
      role: {},
      prefs: { unusedImageChoice: 'delete' },
    });
    act(() => offer([image('e1', 'img-1')]));
    await settle();
    expect(apiDeleteImage).not.toHaveBeenCalled();
    cleanup();
    apiUnusedImages.mockImplementation(async (_o: string, _d: string, ids: string[]) => ids);
    mount({
      tabs: [tab('t1', [])],
      loaded: ['t1'],
      role: { participating: true },
      prefs: { unusedImageChoice: 'delete' },
    });
    act(() => offer([image('e1', 'img-1')]));
    await settle();
    expect(apiUnusedImages).toHaveBeenCalledTimes(1);
    expect(apiDeleteImage).not.toHaveBeenCalled();
  });

  it('offers the owner the picture a delete left unused, and deletes it on Delete from Storage', async () => {
    mount({ tabs: [tab('t1', [])], loaded: ['t1'], role: {} });
    act(() => offer([image('e1', 'img-1')]));
    await settle();
    expect(apiUnusedImages).toHaveBeenCalledWith('user_ada', 'd1', ['img-1']);
    expect(screen.getByText(OFFER)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete from Storage: the image' }));
    await settle();
    expect(apiDeleteImage).toHaveBeenCalledWith('user_ada', 'img-1');
  });

  it('asks nothing when another element, on this tab or another, still places it', async () => {
    mount({
      tabs: [tab('t1', [image('e2', 'img-1')]), tab('t2', [image('e3', 'img-2')])],
      loaded: ['t1', 't2'],
      role: {},
    });
    act(() => offer([image('e1', 'img-1'), image('e4', 'img-2'), image('e5', null)]));
    await settle();
    expect(apiUnusedImages).not.toHaveBeenCalled();
  });

  it('offers nothing when a tab not opened here fails to load', async () => {
    mount({ tabs: [tab('t1', []), tab('t2', [])], loaded: ['t1'], failed: ['t2'], role: {} });
    act(() => offer([image('e1', 'img-1')]));
    await settle();
    expect(apiUnusedImages).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(OFFER)).toBeNull();
  });

  it('never asks for a Viewer, a Participant, a guest, an embed, a workbench or an Offline canvas', async () => {
    const roles: Role[] = [
      { isStructureReadOnly: true },
      { participating: true },
      { accountUserId: null },
      { accountUserId: undefined },
      { embedMode: true },
      { workbenchMode: true },
      { documentId: null },
    ];
    for (const role of roles) {
      const { unmount } = mount({ tabs: [tab('t1', [])], loaded: ['t1'], role });
      act(() => offer([image('e1', 'img-1')]));
      await settle();
      unmount();
    }
    isOfflineIdSync.mockReturnValue(true);
    mount({ tabs: [tab('t1', [])], loaded: ['t1'], role: {} });
    act(() => offer([image('e1', 'img-1')]));
    await settle();
    expect(apiUnusedImages).not.toHaveBeenCalled();
    expect(screen.queryByText(OFFER)).toBeNull();
  });
});
