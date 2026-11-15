'use client';

// The Export dialog's Whole Plan panel (docs/specs/026-plan/plan-tabs.md "Whole Plan"; blueprint plan-file.md): what
// the plan's .liveplanner file holds, and Download, which fetches it from the api (the file is written from the
// plan's server copy, with its comment threads and rules) and saves it as `<plan name>.liveplanner`.
import { useState } from 'react';
import { BackBar, Button } from '@liveworkspace/ui';
import { sanitizeFilename } from '@liveworkspace/model-core/file-name';
import { apiExportProjectFile } from '@/lib/api/project-file';
import { downloadBlob } from '@/lib/export-tab';
import { track } from '@/lib/telemetry';
import { ImportError } from './import/ImportError';

export const WHOLE_PLAN_FAILED = 'Couldn’t prepare the file. Try again.';
const MIME = 'application/vnd.liveplanner+json';

const HOLDS = [
  'Every tab, with its folder',
  'Every card, with its fields',
  'The card types and their templates',
  'The Sheets and their cells',
  'Every comment thread, without the commenters’ account ids',
  'The Automations rules',
];

export function WholePlanExportPanel({
  projectId,
  ownerId,
  projectName,
  onBack,
  onDone,
}: {
  projectId: string;
  ownerId: string;
  projectName: string;
  onBack: () => void;
  // The file saved: the dialog closes.
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const text = await apiExportProjectFile(ownerId, projectId);
      downloadBlob(
        new Blob([text], { type: MIME }),
        `${sanitizeFilename(projectName || 'plan', 'plan')}.liveplanner`,
      );
      track('Project', 'Exported', 'Plan');
      onDone();
    } catch (err) {
      console.warn('[plan-file] export failed', { error: String(err) });
      setError(WHOLE_PLAN_FAILED);
      setBusy(false);
    }
  };

  return (
    <div>
      <BackBar label="All formats" current="Whole Plan" onClick={onBack} />
      <p className="mb-3 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
        The whole plan in one .liveplanner file, to keep a copy or to import back as a new plan from
        Import › A Whole Plan.
      </p>
      <ul className="mb-3 grid gap-1.5 sm:grid-cols-2" aria-label="What the file holds">
        {HOLDS.map((line) => (
          <li
            key={line}
            className="flex items-start gap-2 text-[12px] leading-snug text-slate-700 dark:text-slate-200"
          >
            <span
              aria-hidden
              className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-brand-300"
            />
            {line}
          </li>
        ))}
      </ul>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        Pictures stay links: the file names them and carries no image bytes.
      </p>
      {error ? (
        <div className="mt-3">
          <ImportError>{error}</ImportError>
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-end">
        <Button
          variant="primary"
          size="md"
          // Wide enough for "Preparing…", so the label swap moves nothing.
          className="min-w-[11rem]"
          onClick={() => void download()}
          busy={busy}
        >
          {busy ? 'Preparing…' : 'Download .liveplanner'}
        </Button>
      </div>
    </div>
  );
}
