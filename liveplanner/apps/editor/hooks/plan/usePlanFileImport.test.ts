// @vitest-environment jsdom

// Importing a whole plan from its file (docs/specs/026-plan/plan-tabs.md "The Import dialog", A Whole Plan): offered
// to an Editor, dimmed for a guest, and the api's refusal said as the spec words it.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { importFile, track } = vi.hoisted(() => ({ importFile: vi.fn(), track: vi.fn() }));
vi.mock('@/lib/api/project-file', () => ({ apiImportProjectFile: importFile }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { ApiError } from '@/lib/api/core';
import {
  PLAN_DAMAGED,
  PLAN_FAILED,
  PLAN_GUEST_BLOCKED,
} from '@/components/dialogs/import/plan-file-copy';
import { usePlanFileImport } from './usePlanFileImport';

const hook = (over: { canImport?: boolean; signedIn?: boolean } = {}) => {
  const openProject = vi.fn();
  const { result } = renderHook(() =>
    usePlanFileImport({
      canImport: over.canImport ?? true,
      signedIn: over.signedIn ?? true,
      ownerId: 'user_ada',
      openProject,
    }),
  );
  return { actions: result.current, openProject };
};

afterEach(() => vi.clearAllMocks());

describe('usePlanFileImport', () => {
  it('is offered to an Editor, and dimmed for a guest', () => {
    expect(hook().actions).toMatchObject({ offered: true, blocked: null });
    expect(hook({ canImport: false }).actions.offered).toBe(false);
    expect(hook({ signedIn: false }).actions.blocked).toBe(PLAN_GUEST_BLOCKED);
  });

  it('makes the plan, counts it and opens it', async () => {
    importFile.mockResolvedValueOnce('NEW');
    const { actions, openProject } = hook();
    expect(await actions.importFile('FILE', '  Roadmap ')).toEqual({ ok: true });
    expect(importFile).toHaveBeenCalledWith('user_ada', 'FILE', 'Roadmap');
    expect(track).toHaveBeenCalledWith('Plan', 'Imported', 'Liveplanner');
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

  it('refuses unasked for someone who may not import, or a guest', async () => {
    for (const over of [{ canImport: false }, { signedIn: false }]) {
      expect(await hook(over).actions.importFile('FILE', 'P')).toEqual({
        ok: false,
        error: PLAN_FAILED,
      });
    }
    expect(importFile).not.toHaveBeenCalled();
  });
});
