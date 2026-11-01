'use client';

import { Button, DialogCloseButton, DialogHeader } from '@livehuddle/ui';
import type { MigrationApp } from '@liveworkspace/migration';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { Spinner } from '@liveworkspace/workbench/components/palette/template-picker-icons';
import type { RetiredPartsPhase } from '@/hooks/persistence/useRetiredPartsMove';

// The dialog that moves the parts set aside from documents in This Browser
// (docs/specs/006-document/offline-mode.md "Moving retired parts to the other apps"). Drawn from the hook's phase;
// opened on load (RetiredPartsOffer) and from Settings (SettingsRetiredPartsRow).

export const RETIRED_PARTS_TITLE = 'Some Pages and Boards Have a New Home';
export const RETIRED_PARTS_SUBTITLE =
  'Pages, boards and designs you made in this browser now live in livedocuments, liveplanner and livedesign. They’re kept safe here until you move them.';
export const RETIRED_PARTS_FAILED =
  'These couldn’t be moved yet. They’re still safe in this browser, so try again from Settings.';

const APP_LABEL: Record<MigrationApp, string> = {
  livediagram: 'livediagram',
  livedocuments: 'livedocuments',
  liveplanner: 'liveplanner',
  livedesign: 'livedesign',
};

export function RetiredPartsDialog({
  phase,
  onMove,
  onNotNow,
  onClose,
  notNowHint,
}: {
  phase: RetiredPartsPhase;
  onMove: () => void;
  onNotNow: () => void;
  onClose: () => void;
  // Under the list on the offer: where to find it again (the offer on load), or nothing (Settings, where it is).
  notNowHint?: string;
}) {
  if (phase.kind === 'idle') return null;

  if (phase.kind === 'moving') {
    return (
      <Dialog open onClose={() => {}} ariaLabel={RETIRED_PARTS_TITLE} size="md">
        <DialogHeader title={RETIRED_PARTS_TITLE} />
        <p
          role="status"
          className="flex items-center justify-center gap-2 px-6 py-8 text-sm text-slate-600 dark:text-slate-300"
        >
          <span className="text-brand-700 dark:text-brand-400">
            <Spinner />
          </span>
          Moving {phase.done + 1} of {phase.total}…
        </p>
      </Dialog>
    );
  }

  if (phase.kind === 'result') {
    const title = phase.moved.length > 0 ? 'Your Pages and Boards Have Moved' : RETIRED_PARTS_TITLE;
    return (
      <Dialog open onClose={onClose} ariaLabel={title} size="md">
        <DialogHeader title={title}>
          <DialogCloseButton onClick={onClose} />
        </DialogHeader>
        <div className="space-y-4 px-6 py-5 text-sm text-slate-700 dark:text-slate-200">
          {phase.moved.length > 0 ? (
            <ul className="space-y-3" aria-label="Moved">
              {phase.moved.map((doc) => (
                <li key={doc.id}>
                  <p className="font-medium">{doc.name}</p>
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {doc.parts.map((part) => (
                      <li key={part.url}>
                        <a
                          href={part.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
                        >
                          Open in {APP_LABEL[part.app]}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
          {phase.failed.length > 0 ? (
            <div>
              <p role="alert">{RETIRED_PARTS_FAILED}</p>
              <ul className="mt-2 list-disc pl-5 text-slate-600 dark:text-slate-300">
                {phase.failed.map((name, i) => (
                  <li key={`${i}-${name}`}>{name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="primary" size="xs" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onNotNow} ariaLabel={RETIRED_PARTS_TITLE} size="md">
      <DialogHeader title={RETIRED_PARTS_TITLE} subtitle={RETIRED_PARTS_SUBTITLE}>
        <DialogCloseButton onClick={onNotNow} />
      </DialogHeader>
      <div className="px-6 py-5 text-sm text-slate-700 dark:text-slate-200">
        <ul className="list-disc pl-5" aria-label="Canvases in This Browser">
          {phase.rows.map((row) => (
            <li key={row.id}>{row.name}</li>
          ))}
        </ul>
        {notNowHint ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{notNowHint}</p>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="secondary" size="xs" onClick={onNotNow}>
          Not Now
        </Button>
        <Button variant="primary" size="xs" onClick={onMove}>
          Move Them
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
