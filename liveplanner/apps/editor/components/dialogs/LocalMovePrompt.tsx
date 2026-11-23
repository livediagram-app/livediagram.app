'use client';

import { useId, type ReactNode } from 'react';
import { Button } from '@liveplanner/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { localMoveHeroArt } from '@liveworkspace/ui/dialog-hero-art/local-move';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { ImportChecklist } from '@liveworkspace/workbench/components/dialogs/ImportChecklist';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { Spinner } from '@/components/palette/template-picker-icons';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useLocalMovePrompt } from '@/hooks/persistence/useLocalMovePrompt';

// The move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving projects kept Offline
// after signing in"), mounted by the Explorer and the editor. Renders nothing until there is
// something to offer.
// The hero header's title: these run long for a 30rem dialog, so they wrap inside the 100px band instead of
// truncating.
function WrappingTitle({ children }: { children: ReactNode }) {
  return <span className="block whitespace-normal">{children}</span>;
}

export function LocalMovePrompt({ enabled = true }: { enabled?: boolean }) {
  const { authLoaded, accountUserId } = useAccountBootstrap();
  const prompt = useLocalMovePrompt({ enabled, authLoaded, accountUserId });
  const { phase } = prompt;
  const titleId = useId();
  if (phase.kind === 'idle') return null;

  const title = 'Move Offline Plans to Your Account?';
  if (phase.kind === 'moving') {
    return (
      <Dialog open onClose={() => {}} titleId={titleId} size="md">
        <HeroDialogHeader
          art={localMoveHeroArt}
          titleId={titleId}
          title={<WrappingTitle>{title}</WrappingTitle>}
        />
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
      <Dialog open onClose={prompt.finish} titleId={titleId} size="md">
        <HeroDialogHeader
          art={localMoveHeroArt}
          titleId={titleId}
          title={<WrappingTitle>Some Plans Stayed Offline</WrappingTitle>}
          onClose={prompt.finish}
        />
        <div className="px-6 py-5 text-sm text-slate-700 dark:text-slate-200">
          <p role="alert">
            {phase.failed.length === 1
              ? 'This one could not be moved and is still Offline:'
              : `These ${phase.failed.length} could not be moved and are still Offline:`}
          </p>
          <ul className="mt-2 list-disc pl-5 text-slate-600 dark:text-slate-300">
            {phase.failed.map((name, i) => (
              <li key={`${i}-${name}`}>{name}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Try Sync Plan on it later from the Explorer.
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
    // Focus rests on the dialog itself: its first control is the header's Help link, whose hover card would open
    // over the subtitle the moment the prompt appears (it comes up on load, with no click before it).
    <Dialog open onClose={prompt.notNow} titleId={titleId} size="md" initialFocus="container">
      <HeroDialogHeader
        art={localMoveHeroArt}
        titleId={titleId}
        title={<WrappingTitle>{title}</WrappingTitle>}
        actions={<HelpArticleLink article="offlineMode" size="md" />}
        onClose={prompt.notNow}
      />
      <div className="px-6 py-5">
        {/* The header's one line would cut this short beside so long a title, so it leads the body whole. */}
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          You made these before signing in. They live only in this browser until you move them.
        </p>
        <ImportChecklist
          legend="Offline Plans"
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
