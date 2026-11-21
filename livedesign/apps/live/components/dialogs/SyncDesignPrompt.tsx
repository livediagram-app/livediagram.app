'use client';

import { useState, type ReactNode } from 'react';
import { Button, ButtonContent, Glyph, buttonClassName } from '@livedesign/ui';
import { useToast } from '@/hooks/ui/useToast';
import { syncFailureMessage } from '@/lib/offline/offline-convert';
import { Spinner } from '@liveworkspace/workbench/components/palette/template-picker-icons';

// The offer to move a design kept Offline onto livedesign (docs/specs/006-design/offline-mode.md "Sharing a
// design kept Offline"), drawn inside a dialog: the design Share dialog's gate and Share Form's. It says
// the design is offline and offers Sync Design; the sync converts the open design in place, and the dialog around it swaps this prompt for what it was
// opened for as the design stops being offline. Sync waits for `ready` (the reader is known). Automations' gate draws
// it too (the workbench's SyncGateDialog), with its own title, and for a guest on a stored design Sign In
// (`signInHref`) in place of Sync Design.
export function SyncDesignPrompt({
  onSyncToCloud,
  ready = true,
  title = 'This Design Is Offline',
  message,
  onBusyChange,
  signInHref,
}: {
  onSyncToCloud: () => Promise<void>;
  ready?: boolean;
  // What the prompt says first; the dialog's own reason when it has one.
  title?: ReactNode;
  // Why this dialog needs the design on livedesign.
  message: ReactNode;
  // Told while the sync runs, so the dialog can hold its own buttons.
  onBusyChange?: (busy: boolean) => void;
  // A guest's way on: the prompt offers Sign In (back to this design) instead of Sync Design.
  signInHref?: string | undefined;
}) {
  const [busy, setBusyState] = useState(false);
  const toast = useToast();
  const setBusy = (next: boolean) => {
    setBusyState(next);
    onBusyChange?.(next);
  };

  const sync = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onSyncToCloud();
      // The design is a cloud design now: the dialog shows what it was opened for in place of this prompt.
      // The spinner stays until it does, so the button never flashes back.
      toast.success('Synced. Your design is on livedesign now.');
    } catch (e) {
      setBusy(false);
      toast.error(syncFailureMessage(e));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-7 text-center">
      <span
        data-prompt-glyph={signInHref ? 'person' : 'cloud-off'}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30"
      >
        {/* Cloud-off for a design kept Offline; a person (Lucide's user) for a guest, who signs in. */}
        <Glyph size={24} units={24}>
          {signInHref ? (
            <>
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </>
          ) : (
            <>
              <path d="M6 16.5h10a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.2-1.1A3.4 3.4 0 0 0 6 16.5Z" />
              <path d="M3.5 3.5l17 17" />
            </>
          )}
        </Glyph>
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {message}
        </p>
      </div>
      {signInHref ? (
        <a
          href={signInHref}
          className={buttonClassName({
            variant: 'primary',
            size: 'sm',
            className: 'mt-1 shadow-sm',
          })}
        >
          <ButtonContent>Sign In</ButtonContent>
        </a>
      ) : (
        <Button
          onClick={() => void sync()}
          // Keeps the keyboard while it syncs (busy-buttons.md); only a design not ready yet disables it.
          disabled={!ready}
          busy={busy}
          className="mt-1 shadow-sm"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              Syncing…
            </span>
          ) : (
            'Sync Design'
          )}
        </Button>
      )}
    </div>
  );
}
