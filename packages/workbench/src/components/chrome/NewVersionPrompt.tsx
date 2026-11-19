'use client';

// "A new version of <product> is ready." (docs/specs/016-platform/new-version-prompt.md, in each
// product): shown when the server serves a newer stored format than this editor was built for, and a
// reload would load a newer editor. Calm and non-blocking: a polite status that never takes focus,
// never reloads by itself, reloads only once everything edited has been saved, and never reloads into
// the same build. Each editor binds it once (its components/chrome/NewVersionPrompt.tsx) with its
// product's name, format number, server release store and build id.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useToast } from '@liveworkspace/ui/toast';
import { workbench } from '../../bindings';
import { useLatest } from '../../hooks/ui/useLatest';
import { useNewerEditorLive } from '../../hooks/ui/useNewerEditorLive';
import { debugLog } from '../../lib/debug-log';
import { checkLiveEditor } from '../../lib/live-editor-build';
import { reloadWhenSaved } from '../../lib/reload-when-saved';

type Phase = 'offered' | 'saving' | 'unsaved' | 'arriving';

/** The toast's key: one standing toast, upserted in place as its phase changes. */
export const NEW_VERSION_TOAST_KEY = 'new-version';

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
  const toast = useToast();

  useEffect(() => {
    if (!visible || announced.current) return;
    announced.current = true;
    debugLog(`[${workbench.formatLogScope}] newer on the server`, { editor: editorFormat, server });
    workbench.track('UI', 'Opened', 'NewVersionPrompt');
  }, [visible, server, editorFormat]);

  // Reload, read by the toast's button at its newest without re-raising the toast.
  const onReload = useLatest(async () => {
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
  });

  const copy =
    phase === 'saving'
      ? SAVING
      : phase === 'unsaved'
        ? UNSAVED
        : phase === 'arriving'
          ? STILL_ARRIVING
          : `A new version of ${product} is ready.`;

  // A standing toast (liveworkspace/docs/specs/016-notifications/toasts.md "Timing"): Reload is its action, closing it
  // is Not now (it comes back only for a newer version still), and it leaves when the page no longer needs a reload.
  useEffect(() => {
    if (!visible) {
      toast.dismissAction(NEW_VERSION_TOAST_KEY);
      return;
    }
    toast.action({
      key: NEW_VERSION_TOAST_KEY,
      message: copy,
      sticky: true,
      important: true,
      actions: [
        { label: 'Reload', onSelect: () => void onReload.current(), disabled: phase === 'saving' },
      ],
      onDismiss: () => {
        setDismissedAt(server);
        setPhase('offered');
      },
    });
  }, [toast, visible, copy, phase, server, onReload]);
  useEffect(() => () => toast.dismissAction(NEW_VERSION_TOAST_KEY), [toast]);

  return null;
}

function noReload(): void {}
