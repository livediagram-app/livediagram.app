// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The "Use as Default for" submenu's checks (docs/specs/013-workspace/default-folders.md "Use as
// default for"): a folder holds the keys pointing at it; My Documents holds the keys with no
// working default, and only clears.

const { api } = vi.hoisted(() => ({
  api: {
    apiListPlacementDefaults: vi.fn(),
    apiSetPlacementDefault: vi.fn(),
    apiClearPlacementDefault: vi.fn(),
  },
}));
vi.mock('@/lib/api/placement-defaults', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { resetPlacementDefaultsForTests } from '@/lib/placement-defaults/placement-defaults-store';
import { useDefaultFolderMenus } from './useDefaultFolderMenus';

const lists = {
  personal: [{ id: 'w', name: 'Workshops', parentId: null }],
  team: [{ id: 't', name: 'Sprints', parentId: null, teamId: 'team-a' }],
  teams: [{ id: 'team-a', name: 'Design' }],
};

beforeEach(() => {
  resetPlacementDefaultsForTests();
  api.apiListPlacementDefaults.mockResolvedValue([
    { key: 'template:retrospective', folderId: 'w' },
    { key: 'template:kanban', folderId: 'gone' },
  ]);
  api.apiSetPlacementDefault.mockResolvedValue(undefined);
  api.apiClearPlacementDefault.mockResolvedValue(undefined);
});

async function ready() {
  const hook = renderHook(() => useDefaultFolderMenus('owner', lists));
  await waitFor(() => expect(hook.result.current.forRoot).toBeDefined());
  return hook;
}

describe('useDefaultFolderMenus', () => {
  it('offers nothing before the defaults load', () => {
    api.apiListPlacementDefaults.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDefaultFolderMenus('owner', lists));
    expect(result.current.forRoot).toBeUndefined();
    expect(result.current.forFolder({ id: 'w' })).toBeUndefined();
  });

  it('checks the keys a folder holds, and toggles them', async () => {
    const { result } = await ready();
    const menu = result.current.forFolder({ id: 'w' })!;
    expect(menu.isChecked('template:retrospective')).toBe(true);
    expect(menu.isChecked('mode:plan')).toBe(false);
    await act(async () => menu.toggle('template:retrospective'));
    expect(api.apiClearPlacementDefault).toHaveBeenCalledWith('owner', 'template:retrospective');
    await act(async () => result.current.forFolder({ id: 'w' })!.toggle('mode:plan'));
    expect(api.apiSetPlacementDefault).toHaveBeenCalledWith('owner', 'mode:plan', 'w');
  });

  it('offers a team folder only of a listed team', async () => {
    const { result } = await ready();
    expect(result.current.forFolder({ id: 't', teamId: 'team-a' })).toBeDefined();
    expect(result.current.forFolder({ id: 'x', teamId: 'team-left' })).toBeUndefined();
  });

  it('checks My Documents for keys with no working default, and only clears', async () => {
    const { result } = await ready();
    const root = result.current.forRoot!;
    expect(root.isChecked('mode:plan')).toBe(true);
    expect(root.isChecked('template:kanban')).toBe(true); // dangling
    expect(root.isChecked('template:retrospective')).toBe(false);
    expect(root.isDisabled('mode:plan')).toBe(true);
    await act(async () => root.toggle('template:retrospective'));
    expect(api.apiClearPlacementDefault).toHaveBeenCalledWith('owner', 'template:retrospective');
    await act(async () => result.current.forRoot!.toggle('mode:plan'));
    expect(api.apiClearPlacementDefault).toHaveBeenCalledTimes(1);
  });
});
