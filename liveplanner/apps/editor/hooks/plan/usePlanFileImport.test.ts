// @vitest-environment jsdom

// Importing a whole plan from its file (docs/specs/026-plan/plan-tabs.md "The Import dialog", A Whole Plan): offered
// to an Editor, signed in or a guest, dimmed while offline, and the api's refusal said as the spec words it.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { importFile, track } = vi.hoisted(() => ({ importFile: vi.fn(), track: vi.fn() }));
vi.mock('@/lib/api/project-file', () => ({ apiImportProjectFile: importFile }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { ApiError } from '@/lib/api/core';
import {
  PLAN_DAMAGED,
  PLAN_FAILED,
  PLAN_OFFLINE,
} from '@/components/dialogs/import/plan-file-copy';
import { usePlanFileImport } from './usePlanFileImport';

const hook = (over: { canImport?: boolean; ownerId?: string } = {}) => {
  const openProject = vi.fn();
  const { result } = renderHook(() =>
    usePlanFileImport({
      canImport: over.canImport ?? true,
      ownerId: over.ownerId ?? 'user_ada',
      openProject,
    }),
  );
  return { actions: result.current, openProject };
};

const goOffline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('usePlanFileImport', () => {
  it('is offered to an Editor, signed in or a guest, and not dimmed while online', () => {
    expect(hook().actions).toMatchObject({ offered: true, blocked: null });
    expect(hook({ ownerId: 'guest_cyd' }).actions).toMatchObject({ offered: true, blocked: null });
    expect(hook({ canImport: false }).actions.offered).toBe(false);
  });

  it('is dimmed while the browser is offline, and refuses unasked then', async () => {
    goOffline();
    const { actions } = hook();
    expect(actions.blocked).toBe(PLAN_OFFLINE);
    expect(await actions.importFile('FILE', 'P')).toEqual({ ok: false, error: PLAN_OFFLINE });
    expect(importFile).not.toHaveBeenCalled();
  });

  it('makes the plan, counts it and opens it', async () => {
    importFile.mockResolvedValueOnce('NEW');
    const { actions, openProject } = hook();
    expect(await actions.importFile('FILE', '  Roadmap ')).toEqual({ ok: true });
    expect(importFile).toHaveBeenCalledWith('user_ada', 'FILE', 'Roadmap');
    expect(track).toHaveBeenCalledWith('Plan', 'Imported', 'Liveplanner');
    expect(openProject).toHaveBeenCalledWith('NEW');
  });

  it('makes a guest’s plan the same way, under their guest id', async () => {
    importFile.mockResolvedValueOnce('NEW');
    const { actions, openProject } = hook({ ownerId: 'guest_cyd' });
    expect(await actions.importFile('FILE', 'Roadmap')).toEqual({ ok: true });
    expect(importFile).toHaveBeenCalledWith('guest_cyd', 'FILE', 'Roadmap');
    expect(openProject).toHaveBeenCalledWith('NEW');
  });

  it('names an unnamed plan Untitled', async () => {
    importFile.mockResolvedValueOnce('NEW');
    await hook().actions.importFile('FILE', ' ');
    expect(importFile).toHaveBeenCalledWith('user_ada', 'FILE', 'Untitled');
  });

  it('says a file the api refused as damaged, and anything else as a try again', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { actions } = hook();
    for (const [err, said] of [
      [new ApiError('import plan file', 400, 'invalid_file'), PLAN_DAMAGED],
      [new ApiError('import plan file', 413, 'too_large'), PLAN_DAMAGED],
      [new ApiError('import plan file', 409, 'exists'), PLAN_FAILED],
      [new Error('offline'), PLAN_FAILED],
    ] as const) {
      importFile.mockRejectedValueOnce(err);
      expect(await actions.importFile('FILE', 'P')).toEqual({ ok: false, error: said });
    }
  });

  it('refuses unasked for someone who may not import', async () => {
    expect(await hook({ canImport: false }).actions.importFile('FILE', 'P')).toEqual({
      ok: false,
      error: PLAN_FAILED,
    });
    expect(importFile).not.toHaveBeenCalled();
  });
});
