'use client';

import { Button, DialogCloseButton, DialogHeader } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { ImportChecklist } from '@/components/dialogs/ImportChecklist';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { Spinner } from '@/components/palette/template-picker-icons';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useLocalMovePrompt } from '@/hooks/persistence/useLocalMovePrompt';

// The move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving documents in This Browser
// after signing in"), mounted by the Explorer and the editor. Renders nothing until there is
// something to offer.
export function LocalMovePrompt({ enabled = true }: { enabled?: boolean }) {
  const { authLoaded, accountUserId } = useAccountBootstrap();
  const prompt = useLocalMovePrompt({ enabled, authLoaded, accountUserId });
  const { phase } = prompt;
  if (phase.kind === 'idle') return null;

  const title = 'Move Canvases in This Browser to Your Account?';
  if (phase.kind === 'moving') {
    return (
      <Dialog open onClose={() => {}} ariaLabel={title} size="md">
        <DialogHeader title={title} />
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

  if (phase.kind === 'partial') {
    return (
      <Dialog open onClose={prompt.finish} ariaLabel={title} size="md">
        <DialogHeader title="Some Canvases Stayed in This Browser">
          <DialogCloseButton onClick={prompt.finish} />
        </DialogHeader>
        <div className="px-6 py-5 text-sm text-slate-700 dark:text-slate-200">
          <p role="alert">
            {phase.failed.length === 1
              ? 'This one could not be moved and is still This Browser:'
              : `These ${phase.failed.length} could not be moved and are still This Browser:`}
          </p>
          <ul className="mt-2 list-disc pl-5 text-slate-600 dark:text-slate-300">
            {phase.failed.map((name, i) => (
              <li key={`${i}-${name}`}>{name}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Try Sync Canvas on it later from the Explorer.
          </p>
        </div>
        <DialogFooter>
          <Button variant="primary" size="xs" onClick={prompt.finish}>
            Done
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={prompt.notNow} ariaLabel={title} size="md">
      <DialogHeader
        title={title}
        subtitle="You made these before signing in. They live only in this browser until you move them."
      >
        <HelpArticleLink article="offlineMode" size="md" />
        <DialogCloseButton onClick={prompt.notNow} />
      </DialogHeader>
      <div className="px-6 py-5">
        <ImportChecklist
          legend="Canvases in This Browser"
          rows={prompt.rows}
          checked={prompt.checked}
          onToggle={prompt.toggle}
          onToggleAll={prompt.toggleAll}
          importLabel="Move"
          cancelLabel="Not Now"
          onImport={() => void prompt.move()}
          onCancel={prompt.notNow}
        />
      </div>
    </Dialog>
  );
}
