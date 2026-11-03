'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { Button, CloseIcon, useEscape } from '@livehuddle/ui';
import { BLANK_TEMPLATE_FOR_MODE, type TemplateKind } from '@livehuddle/templates';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { takeEarlyModeChoice } from '@/app/new/early-mode-choice';
import { useModalGuard } from '@liveworkspace/workbench/hooks/ui/useModalGuard';
import { CanvasModalCard } from '@liveworkspace/workbench/components/palette/CanvasModalCard';
import {
  FolderOpenIcon,
  SparkleIcon,
  Spinner,
} from '@liveworkspace/workbench/components/palette/template-picker-icons';

// The New Document wizard (docs/specs/007-editor/new-document-route.md "One-step wizard"): no question, as there is
// one mode; Create makes a Blank Space document at once. It asks nothing about where the document goes or what it
// is called: /new stores and files it by default (Save Locations, Default folders), and it opens on its start, where
// the templates are. Escape and the X back out, creating nothing; Skip makes a Blank Space with its start closed.
export function NewDocumentWizard({
  busy = false,
  onCreate,
  onSkip,
  onBackOut,
  onOpenExisting,
  saveSwitch,
}: {
  // The create is in flight: Create shows its spinner and nothing else creates.
  busy?: boolean;
  // Make the document from the blank.
  onCreate: (kind: TemplateKind) => void;
  // Make a Blank Space with its start closed (the documented Skip defaults).
  onSkip: () => void;
  // Back to the page that opened /new, creating nothing.
  onBackOut: () => void;
  // To the Explorer, to open a document that exists.
  onOpenExisting?: () => void;
  // Where the new space will be saved: the Sync Space to Server switch, under Create
  // (docs/specs/006-document/save-locations.md "On the start screen"). Absent where /new names a server place.
  saveSwitch?: ReactNode;
}) {
  useModalGuard(true);
  const create = () => {
    if (busy) return;
    onCreate(BLANK_TEMPLATE_FOR_MODE.workshop);
  };
  // Create pressed before hydration is pressed now, before the browser can hand React another event.
  useLayoutEffect(() => {
    if (takeEarlyModeChoice()) create();
    // Once, as the wizard mounts.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);
  useEscape(() => {
    if (!busy) onBackOut();
  });
  return (
    <CanvasModalCard label="Start a new space" width="sm:w-[44rem]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-5 pt-6 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            New Space
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            What are you making today?
          </p>
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0 items-center gap-0.5">
          <HelpArticleLink
            article="templates"
            className="!h-8 !w-8 !rounded-lg !border-0 !text-sm !text-slate-500 hover:!bg-slate-100 hover:!text-slate-700 dark:!text-slate-400 dark:hover:!bg-slate-800 dark:hover:!text-slate-200"
          />
          <button
            type="button"
            // The X backs out as Escape does, creating nothing (new-document-route.md "Escape backs out").
            onClick={() => {
              if (!busy) onBackOut();
            }}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      {saveSwitch ? (
        <div className="border-t border-slate-100 px-6 py-1.5 dark:border-slate-800">
          {saveSwitch}
        </div>
      ) : null}
      <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        {onOpenExisting ? (
          <button
            type="button"
            onClick={onOpenExisting}
            className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <FolderOpenIcon />
            Open Existing Space
          </button>
        ) : (
          <span className="mr-auto" />
        )}
        <Button
          variant="secondary"
          size="xs"
          onClick={onSkip}
          disabled={busy}
          className="rounded-lg py-2"
        >
          Skip
        </Button>
        <Button
          size="xs"
          onClick={create}
          busy={busy}
          // The early script's target: a press before hydration is kept (early-mode-choice.ts).
          data-new-mode="workshop"
          className="gap-1.5 rounded-lg px-4 py-2 shadow-sm"
        >
          {busy ? <Spinner /> : <SparkleIcon />}
          {busy ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </CanvasModalCard>
  );
}
