'use client';

// Importing a whole plan from its .liveplanner file (docs/specs/026-plan/plan-tabs.md "The Import dialog", A Whole
// Plan; blueprint plan-file.md): an Editor's, beside the tools, signed in or a guest (the api owns the new plan by the
// caller's id, a guest's as their guest id, as Sync Plan to Server does). The new plan is made on the server, so the
// row is dimmed while the browser is offline. The dialog reads and previews the file; this writes it and opens the
// new plan.
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useOnline } from '@liveworkspace/workbench/hooks/ui/useOnline';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { ApiError } from '@/lib/api/core';
import { apiImportProjectFile } from '@/lib/api/project-file';
import { track } from '@/lib/telemetry';
import {
  PLAN_DAMAGED,
  PLAN_FAILED,
  PLAN_OFFLINE,
} from '@/components/dialogs/import/plan-file-copy';

export type PlanFileImportOutcome = { ok: true } | { ok: false; error: string };

export type PlanFileImportActions = {
  // Whether the dialog offers the section (an Editor, as the tools are).
  offered: boolean;
  // Why its row is dimmed (offline), or null.
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

// Whether the browser says it is offline; a browser that cannot say counts as online.
const offline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

export function usePlanFileImport(opts: {
  canImport: boolean;
  ownerId: string;
  openProject: (projectId: string) => void;
}): PlanFileImportActions {
  const latest = useLatest(opts);
  // Subscribed, so the row dims (and lights again) the moment the browser goes offline or back, dialog open or not.
  const online = useOnline();
  const importFile = async (text: string, name: string): Promise<PlanFileImportOutcome> => {
    const o = latest.current;
    if (!o.canImport) return { ok: false, error: PLAN_FAILED };
    if (offline()) return { ok: false, error: PLAN_OFFLINE };
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
    blocked: online ? null : PLAN_OFFLINE,
    importFile,
  };
}
