'use client';

// Describe to Set Up in the page tree (docs/specs/030-knowledgebase/describe-to-set-up.md "The control"): a
// full-width button directly above New Page while the knowledgebase is empty, with one line under it, in the
// sidebar and in a phone's Pages sheet (which closes as the dialog opens over the page: `onOpen`). It only
// opens the dialog; the dialog's code is fetched then (SetupHost.tsx). Once the knowledgebase has writing, or for
// anyone who is not its signed-in Editor, it draws nothing.
import { useId } from 'react';
import { Button } from '@liveknowledge/ui';
import { openSetup } from '@/lib/knowledge-setup/setup-open';
import { SETUP_BUTTON, SETUP_BUTTON_LINE } from '@/lib/knowledge-setup/setup-words';
import { track } from '@/lib/telemetry';
import { SetupSparkleIcon } from './setup-icons';
import { useSetupOffered } from './useSetupOffered';

export function DescribeToSetUpButton({ onOpen }: { onOpen?: () => void } = {}) {
  const offered = useSetupOffered();
  // Its own id: the sidebar's button and the sheet's can both be on the page.
  const lineId = useId();
  if (offered !== 'set-up') return null;
  return (
    <div className="mb-3" data-describe-to-set-up="">
      <Button
        variant="primary"
        className="w-full cursor-pointer justify-center pointer-coarse:min-h-11"
        aria-describedby={lineId}
        onClick={() => {
          track('UI', 'Opened', 'DescribeToSetUp');
          onOpen?.();
          openSetup('set-up');
        }}
      >
        <SetupSparkleIcon />
        {SETUP_BUTTON}
      </Button>
      <p
        id={lineId}
        className="mt-1.5 text-center text-xs leading-snug text-slate-600 dark:text-slate-400"
      >
        {SETUP_BUTTON_LINE}
      </p>
    </div>
  );
}
