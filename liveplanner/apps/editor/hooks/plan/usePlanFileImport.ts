'use client';

// Importing a whole plan from its .liveplanner file (docs/specs/026-plan/plan-tabs.md "The Import dialog", A Whole
// Plan; blueprint plan-file.md): an Editor's, beside the tools, and a signed-in person's, since the new plan is made in
// their account (a guest's plans live in This Browser, which keeps no comment threads or rules). The dialog reads and
// previews the file; this writes it and opens the new plan.
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { ApiError } from '@/lib/api/core';
import { apiImportProjectFile } from '@/lib/api/project-file';
import { track } from '@/lib/telemetry';
import {
  PLAN_DAMAGED,
  PLAN_FAILED,
  PLAN_GUEST_BLOCKED,
} from '@/components/dialogs/import/plan-file-copy';

export type PlanFileImportOutcome = { ok: true } | { ok: false; error: string };

export type PlanFileImportActions = {
  // Whether the dialog offers the section (an Editor, as the tools are).
  offered: boolean;
  // Why its row is dimmed (a guest), or null.
  blocked: string | null;
  // Makes the new plan from the file's text, named `name`, then opens it.
  importFile: (text: string, name: string) => Promise<PlanFileImportOutcome>;
};

// The api's refusal as the dialog says it: a file it could not take, or anything else.
function failureOf(err: unknown): string {
  if (err instanceof ApiError && (err.code === 'invalid_file' || err.code === 'too_large'))
    return PLAN_DAMAGED;
  return PLAN_FAILED;
}

export function usePlanFileImport(opts: {
  canImport: boolean;
  signedIn: boolean;
  ownerId: string;
  openProject: (projectId: string) => void;
}): PlanFileImportActions {
  const latest = useLatest(opts);
  const importFile = async (text: string, name: string): Promise<PlanFileImportOutcome> => {
    const o = latest.current;
    if (!o.canImport || !o.signedIn) return { ok: false, error: PLAN_FAILED };
    try {
      const id = await apiImportProjectFile(o.ownerId, text, name.trim() || 'Untitled');
      track('Plan', 'Imported', 'Liveplanner');
      debugLog('[plan-file] imported', { bytes: text.length });
      o.openProject(id);
      return { ok: true };
    } catch (err) {
      console.warn('[plan-file] import failed', { error: String(err) });
      return { ok: false, error: failureOf(err) };
    }
  };
  return {
    offered: opts.canImport,
    blocked: opts.signedIn ? null : PLAN_GUEST_BLOCKED,
    importFile,
  };
}
