'use client';

// Automations on a plan in Browser Storage (docs/specs/026-plan/automations.md "Who may do what"): rules, schedules
// and due-date reminders run on the server even while nobody has the plan open, so the screen says why there are none
// and offers Save to Your Account (the Sync Plan to Server switch's own move; a guest signs in first) and How Rules
// Work. Loads with its own chunk the first time it opens.

import { useId, useState } from 'react';
import {
  Button,
  ButtonContent,
  DialogCloseButton,
  buttonClassName,
  lucideGlyph,
} from '@liveplanner/ui';
import { lucideCloudUpload } from '@liveworkspace/icons/lucide';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useToast } from '@/hooks/ui/useToast';
import { ConversionInProgressError, syncFailureMessage } from '@/lib/offline/offline-convert';
import { BoltIcon } from './automation-glyphs';

const CloudIcon = lucideGlyph(lucideCloudUpload, 14);

export const OFFLINE_RULES_COPY =
  'Rules, schedules and due-date reminders run even when nobody has this plan open, so they need it saved to your account.';

export function AutomationsOfflineDialog({
  signedIn,
  signInHref,
  onSave,
  onClose,
}: {
  signedIn: boolean;
  // Where a guest signs in, coming back to this plan.
  signInHref: string;
  // Moves the plan to the account (Sync Plan to Server).
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  const titleId = useId();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await onSave();
      onClose();
    } catch (e) {
      // A conversion already running reports for itself.
      if (!(e instanceof ConversionInProgressError)) toast.error(syncFailureMessage(e));
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="md">
      <div
        data-automations-offline=""
        className="flex flex-col items-center gap-3 px-6 pb-6 pt-5 text-center"
      >
        <div className="flex w-full justify-end">
          <DialogCloseButton onClick={onClose} />
        </div>
        <span
          aria-hidden
          className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
        >
          <BoltIcon size={24} aria-hidden />
        </span>
        <h2 id={titleId} className="text-[17px] font-semibold text-slate-900 dark:text-slate-50">
          Rules Run on Our Servers
        </h2>
        <p className="max-w-sm text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          {OFFLINE_RULES_COPY}
        </p>
        {signedIn ? null : (
          <p className="max-w-sm text-[12px] text-slate-500 dark:text-slate-400">
            Sign in first, then come back to this plan to save it.
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {signedIn ? (
            <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving}>
              <CloudIcon aria-hidden />
              {saving ? 'Saving…' : 'Save to Your Account'}
            </Button>
          ) : (
            <a href={signInHref} className={buttonClassName({ variant: 'primary', size: 'sm' })}>
              <ButtonContent>
                <CloudIcon aria-hidden />
                Save to Your Account
              </ButtonContent>
            </a>
          )}
          <HelpArticleLink article="planAutomations" variant="button" label="How Rules Work" />
        </div>
      </div>
    </Dialog>
  );
}
