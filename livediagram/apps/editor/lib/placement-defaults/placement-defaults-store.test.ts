import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/core';

// The page's one copy of the reader's defaults (blueprint "Behaviour and state (surfaces)"): loaded
// once per owner, written optimistically, telemetry before every write, rolled back on refusal.

const { api, track } = vi.hoisted(() => ({
  api: {
    apiListPlacementDefaults: vi.fn(),
    apiSetPlacementDefault: vi.fn(),
    apiClearPlacementDefault: vi.fn(),
  },
  track: vi.fn(),
}));
vi.mock('@/lib/api/placement-defaults', () => api);
vi.mock('@/lib/telemetry', () => ({ track }));

import {
  clearPlacementDefault,
  loadPlacementDefaults,
  placementDefaultsSnapshot,
  resetPlacementDefaultsForTests,
  setPlacementDefault,
} from './placement-defaults-store';

const keys = () => Object.fromEntries(placementDefaultsSnapshot().defaults);

beforeEach(() => {
  resetPlacementDefaultsForTests();
  for (const fn of Object.values(api)) fn.mockReset();
  track.mockReset();
  api.apiListPlacementDefaults.mockResolvedValue([{ key: 'mode:draw', folderId: 'w' }]);
  api.apiSetPlacementDefault.mockResolvedValue(undefined);
  api.apiClearPlacementDefault.mockResolvedValue(undefined);
});

describe('loadPlacementDefaults', () => {
  it('loads an owner once', async () => {
    await loadPlacementDefaults('owner');
    await loadPlacementDefaults('owner');
    expect(api.apiListPlacementDefaults).toHaveBeenCalledTimes(1);
    expect(placementDefaultsSnapshot()).toMatchObject({ ownerId: 'owner', status: 'ready' });
    expect(keys()).toEqual({ 'mode:draw': 'w' });
  });

  it('replaces the state for a new owner and drops a stale answer', async () => {
    let answerFirst: (v: unknown) => void = () => {};
    api.apiListPlacementDefaults.mockImplementationOnce(
      () => new Promise((resolve) => (answerFirst = resolve)),
    );
    const first = loadPlacementDefaults('guest');
    await loadPlacementDefaults('user');
    answerFirst([{ key: 'mode:diagram', folderId: 'stale' }]);
    await first;
    expect(placementDefaultsSnapshot().ownerId).toBe('user');
    expect(keys()).toEqual({ 'mode:draw': 'w' });
  });

  it('marks a failed load and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.apiListPlacementDefaults.mockRejectedValue(new ApiError('list', 503, null));
    await loadPlacementDefaults('owner');
    expect(placementDefaultsSnapshot().status).toBe('failed');
    expect(warn).toHaveBeenCalledWith('[default-folders] load failed status=503');
    warn.mockRestore();
  });
});

describe('setPlacementDefault and clearPlacementDefault', () => {
  beforeEach(async () => {
    await loadPlacementDefaults('owner');
  });

  it('sets a key, telemetry first, and shows it at once', async () => {
    const pending = setPlacementDefault('template:kanban', 'boards', 'menu');
    expect(track).toHaveBeenCalledWith('Folder', 'Changed', 'DefaultTemplateKanban');
    expect(api.apiSetPlacementDefault).toHaveBeenCalledWith('owner', 'template:kanban', 'boards');
    expect(keys()['template:kanban']).toBe('boards');
    expect(await pending).toBe(true);
  });

  it('fires telemetry before the write is sent', async () => {
    api.apiSetPlacementDefault.mockImplementation(() => {
      expect(track).toHaveBeenCalled();
      return Promise.resolve();
    });
    await setPlacementDefault('mode:diagram', 'x', 'settings');
  });

  it('clears a key with its Cleared event', async () => {
    expect(await clearPlacementDefault('mode:draw', 'settings')).toBe(true);
    expect(track).toHaveBeenCalledWith('Folder', 'Cleared', 'DefaultModeDraw');
    expect(api.apiClearPlacementDefault).toHaveBeenCalledWith('owner', 'mode:draw');
    expect(keys()).toEqual({});
  });

  it('writes nothing when nothing changes', async () => {
    expect(await setPlacementDefault('mode:draw', 'w', 'menu')).toBe(true);
    expect(await clearPlacementDefault('mode:diagram', 'menu')).toBe(true);
    expect(api.apiSetPlacementDefault).not.toHaveBeenCalled();
    expect(api.apiClearPlacementDefault).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('rolls a refused write back and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.apiSetPlacementDefault.mockRejectedValue(new ApiError('set', 404, 'folder_not_found'));
    expect(await setPlacementDefault('mode:draw', 'elsewhere', 'menu')).toBe(false);
    expect(keys()).toEqual({ 'mode:draw': 'w' });
    expect(warn).toHaveBeenCalledWith(
      '[default-folders] write failed key=mode:draw code=folder_not_found, rolled back',
    );
    warn.mockRestore();
  });

  it('refuses to write before the defaults are loaded', async () => {
    resetPlacementDefaultsForTests();
    expect(await setPlacementDefault('mode:draw', 'w', 'menu')).toBe(false);
    expect(api.apiSetPlacementDefault).not.toHaveBeenCalled();
  });
});
