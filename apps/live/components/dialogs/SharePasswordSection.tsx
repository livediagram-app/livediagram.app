import { Button, LockIcon } from '@livediagram/ui';
import { useRef, useState } from 'react';
import { SettingsRow } from '@/components/dialogs/settings/SettingsRow';

// The share-password band (docs/specs/013-workspace/share-password.md): one optional password that gates every
// link. Owns its own field + "Saved" flash state; the busy flag is shared with
// the dialog's link actions (passed in) so a save and a link create can't race.
// Split out of ShareDialog.
//
// Fronted by a switch (docs/specs/007-editor/live-app.md "Layout, top to bottom"): off hides the
// field, on reveals it. With a password saved, switching off removes it, so
// the switch never disagrees with what the server enforces.
//
// The api keeps only a hash, so a saved password cannot be shown again: once
// one is set the field gives way to a "Password Set" line with Replace and
// Remove, and Replace brings back an empty field.
type SharePasswordSectionProps = {
  sharePasswordSet: boolean;
  // Resolves to whether a password is now set on success (`false` = cleared)
  // and `undefined` on FAILURE: the two must stay distinct or a failed write
  // renders the success UI (see useShareLinks).
  onSetPassword: (password: string | null) => Promise<boolean | undefined> | void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  // Why a password can't be set (the document is in the Community: docs/specs/025-community/
  // community.md, a post and a password exclude each other). Disables the switch and says why.
  lockedReason?: string | null;
};

// The nested detail under the switch: indented to the footnote's edge with a
// guide rule, so it reads as the switch's detail rather than a stray row.
const DETAIL_ROW =
  'ml-3.5 flex animate-fade-in items-center gap-2 border-l-2 border-slate-200 py-0.5 pl-3 dark:border-slate-700';

export function SharePasswordSection({
  sharePasswordSet,
  onSetPassword,
  busy,
  setBusy,
  lockedReason = null,
}: SharePasswordSectionProps) {
  // The new password being typed. Never seeded: the saved one is unknowable.
  const [pw, setPw] = useState('');
  const [pwSaved, setPwSaved] = useState(false);
  // The owner switched on with no password saved yet (the field is open). The
  // switch itself is on whenever a password is in force: deriving it, rather
  // than seeding state at mount, keeps it right when the dialog opens before
  // the share list has loaded.
  const [enabled, setEnabled] = useState(false);
  const switchOn = sharePasswordSet || enabled;
  // Replacing a saved password: the field is showing in place of "Password Set".
  const [replacing, setReplacing] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  const focusField = () => requestAnimationFrame(() => fieldRef.current?.focus());

  const savePassword = async () => {
    setBusy(true);
    try {
      const next = pw.trim() ? pw : null;
      const result = onSetPassword(next);
      // Sync (void) handlers (tests) count as success; a promise resolving to
      // `undefined` is a FAILED write (the hook already toasted), so leave the
      // field + button untouched rather than flashing "Saved" over a password
      // that isn't stored.
      const nowSet = result instanceof Promise ? await result : next !== null;
      if (nowSet === undefined) return;
      setPw('');
      setReplacing(false);
      // Saving an empty field clears the password, which is the switch off.
      if (!nowSet) setEnabled(false);
      setPwSaved(true);
      window.setTimeout(() => setPwSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  const removePassword = async () => {
    setBusy(true);
    try {
      const result = onSetPassword(null);
      const nowSet = result instanceof Promise ? await result : false;
      // Failed remove: the password still gates every link, so keep showing it as set.
      if (nowSet === undefined) return;
      setPw('');
      setReplacing(false);
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    if (!switchOn) {
      setEnabled(true);
      // The field mounts on this render; focus it on the next frame.
      focusField();
      return;
    }
    if (sharePasswordSet) {
      void removePassword();
      return;
    }
    setEnabled(false);
    setPw('');
  };

  const startReplace = () => {
    setReplacing(true);
    focusField();
  };

  const cancelReplace = () => {
    setReplacing(false);
    setPw('');
  };

  const showSetLine = sharePasswordSet && !replacing;
  const canSave = !busy && pw.trim().length > 0;

  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
      {/* The Settings dialog's own toggle row, so the switch looks and
          behaves like every other setting in the app. */}
      <SettingsRow
        row={{
          key: 'share-password',
          label: 'Password Protection',
          description: 'Everyone opening a pass must enter it first, embeds included.',
          helpArticle: 'sharePasswords',
        }}
        checked={switchOn}
        onChange={toggle}
        // A password already in force stays removable; only setting a new one is locked.
        disabled={busy || (lockedReason !== null && !sharePasswordSet)}
      />
      {lockedReason !== null && !sharePasswordSet ? (
        <p className="ml-3.5 border-l-2 border-slate-200 pl-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {lockedReason}
        </p>
      ) : null}
      {switchOn && showSetLine ? (
        <div className={DETAIL_ROW}>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <LockIcon size={13} className="shrink-0 text-slate-400" />
            {pwSaved ? 'Password Saved' : 'Password Set'}
          </p>
          <Button variant="secondary" size="xs" onClick={startReplace} disabled={busy}>
            Replace
          </Button>
          <Button variant="secondary" size="xs" onClick={removePassword} disabled={busy}>
            Remove
          </Button>
        </div>
      ) : null}
      {switchOn && !showSetLine && (lockedReason === null || sharePasswordSet) ? (
        <div className={DETAIL_ROW}>
          <div className="relative min-w-0 flex-1">
            <LockIcon
              size={13}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={fieldRef}
              type="text"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) void savePassword();
                if (e.key === 'Escape' && replacing) {
                  // Leave the dialog open: Escape here only backs out of Replace.
                  e.stopPropagation();
                  cancelReplace();
                }
              }}
              placeholder={replacing ? 'Choose a new password' : 'Choose a password'}
              aria-label="Share password"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-2 pl-8 font-mono text-sm text-slate-800 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <Button size="xs" onClick={savePassword} disabled={!canSave} className="shadow-sm">
            Save
          </Button>
          {replacing ? (
            <Button variant="secondary" size="xs" onClick={cancelReplace} disabled={busy}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
