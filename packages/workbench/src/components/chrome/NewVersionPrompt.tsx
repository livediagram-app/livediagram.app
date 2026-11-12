'use client';

// "A new version of <product> is ready." (docs/specs/016-platform/new-version-prompt.md, in each
// product): shown when the server serves a newer stored format than this editor was built for, and a
// reload would load a newer editor. Calm and non-blocking: a polite status that never takes focus,
// never reloads by itself, reloads only once everything edited has been saved, and never reloads into
// the same build. Each editor binds it once (its components/chrome/NewVersionPrompt.tsx) with its
// product's name, format number, server release store and build id.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@liveworkspace/ui';
import { workbench } from '../../bindings';
import { useNewerEditorLive } from '../../hooks/ui/useNewerEditorLive';
import { debugLog } from '../../lib/debug-log';
import { checkLiveEditor } from '../../lib/live-editor-build';
import { reloadWhenSaved } from '../../lib/reload-when-saved';
import { TOAST_SURFACE } from '../toast/ToastCard';
import { announceToastFloorChange } from '../toast/toast-floor';

type Phase = 'offered' | 'saving' | 'unsaved' | 'arriving';

const SAVING = 'Saving your changes…';
const UNSAVED = "Your latest changes aren't saved yet. Reload once they are.";
/** Reload pressed while the page still serves this editor: a deploy mid-way. */
export const STILL_ARRIVING = 'The new version is still on its way. Try again in a minute.';

export type NewVersionPromptProps = {
  /** The product's name as its copy says it (`liveplanner`). */
  product: string;
  /** The stored format this editor was built for (`PROJECT_FORMAT`, `DOCUMENT_FORMAT`, …). */
  editorFormat: number;
  /** The highest format this page has heard from the server (the product's server release store). */
  serverFormat: () => number | null;
  subscribe: (listener: () => void) => () => void;
  /** The name of the page's build meta (`liveplanner-build`), as the layout writes it. */
  buildMetaName: string;
  /** This editor's build id (`EDITOR_BUILD_ID`); null in local development, where it shows at once. */
  editorBuildId: string | null;
  hasUnsavedChanges: () => boolean;
  reload?: () => void;
};

const noServer = () => null;

export function NewVersionPrompt({
  product,
  editorFormat,
  serverFormat,
  subscribe,
  buildMetaName,
  editorBuildId,
  hasUnsavedChanges,
  reload = () => window.location.reload(),
}: NewVersionPromptProps) {
  const server = useSyncExternalStore(subscribe, serverFormat, noServer);
  const [phase, setPhase] = useState<Phase>('offered');
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const announced = useRef(false);
  const ahead = server !== null && server > editorFormat;
  const checkLive = useCallback(
    () => checkLiveEditor({ metaName: buildMetaName, ownBuild: editorBuildId }),
    [buildMetaName, editorBuildId],
  );
  const editorLive = useNewerEditorLive(ahead, checkLive);
  const visible = ahead && editorLive && (dismissedAt === null || server > dismissedAt);

  useEffect(() => {
    if (!visible || announced.current) return;
    announced.current = true;
    debugLog(`[${workbench.formatLogScope}] newer on the server`, { editor: editorFormat, server });
    workbench.track('UI', 'Opened', 'NewVersionPrompt');
  }, [visible, server, editorFormat]);
  // A toast already up stands on the prompt while it shows, and drops back when it goes.
  useEffect(() => {
    announceToastFloorChange();
  }, [visible]);

  if (!visible) return null;

  const onReload = async () => {
    workbench.track('UI', 'Used', 'NewVersionPrompt');
    setPhase('saving');
    // Saved first (no reload yet: `reload` here only marks it settled), then the same build check.
    const outcome = await reloadWhenSaved({ hasUnsavedChanges, reload: noReload });
    if (outcome === 'unsaved') {
      setPhase('unsaved');
      return;
    }
    if ((await checkLive()) === 'same') {
      debugLog(`[${workbench.formatLogScope}] reload held: the page still serves this editor`);
      setPhase('arriving');
      return;
    }
    reload();
  };

  const copy =
    phase === 'saving'
      ? SAVING
      : phase === 'unsaved'
        ? UNSAVED
        : phase === 'arriving'
          ? STILL_ARRIVING
          : `A new version of ${product} is ready.`;

  return (
    <div
      role="status"
      data-new-version-prompt=""
      // The toast's look, not its stack (docs/specs/004-interface-design/toasts.md "Out of scope"); the toasts
      // stand on it, as on any bottom chrome.
      data-toast-floor=""
      className={`fixed bottom-20 left-1/2 z-[var(--z-chrome)] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 animate-toast-in items-center gap-3 border-slate-200 px-4 py-3 text-sm dark:border-slate-700 ${TOAST_SURFACE}`}
    >
      <p className="min-w-0 flex-1">{copy}</p>
      <Button size="sm" busy={phase === 'saving'} onClick={() => void onReload()}>
        Reload
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={phase === 'saving'}
        onClick={() => {
          setDismissedAt(server);
          setPhase('offered');
        }}
      >
        Not now
      </Button>
    </div>
  );
}

function noReload(): void {}
