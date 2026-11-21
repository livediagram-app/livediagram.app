'use client';

// Describe to Set Up in the page tree (docs/specs/030-knowledgebase/describe-to-set-up.md "The control"): a
// full-width button directly above New Page while the knowledgebase is empty (what it does is its hover card's), in the
// sidebar and in a phone's Pages sheet (which closes as the dialog opens over the page: `onOpen`). It only
// opens the dialog; the dialog's code is fetched then (SetupHost.tsx). Once the knowledgebase has writing, or for
// anyone who is not its signed-in Editor, it draws nothing.
import { Button, HoverCard } from '@liveknowledge/ui';
import { openSetup } from '@/lib/knowledge-setup/setup-open';
import { SETUP_BUTTON, SETUP_BUTTON_LINE } from '@/lib/knowledge-setup/setup-words';
import { track } from '@/lib/telemetry';
import { SetupSparkleIcon } from './setup-icons';
import { useSetupOffered } from './useSetupOffered';

export function DescribeToSetUpButton({ onOpen }: { onOpen?: () => void } = {}) {
  const offered = useSetupOffered();
  if (offered !== 'set-up') return null;
  return (
    <div className="mb-3" data-describe-to-set-up="">
      <HoverCard block title={SETUP_BUTTON} description={SETUP_BUTTON_LINE}>
        <Button
          variant="primary"
          className="w-full cursor-pointer justify-center pointer-coarse:min-h-11"
          onClick={() => {
            track('UI', 'Opened', 'DescribeToSetUp');
            onOpen?.();
            openSetup('set-up');
          }}
        >
          <SetupSparkleIcon />
          {SETUP_BUTTON}
        </Button>
      </HoverCard>
    </div>
  );
}
