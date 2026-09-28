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
type SharePasswordSectionProps = {
  sharePassword: string | null;
  // Resolves to the stored value on success (`null` = cleared) and
  // `undefined` on FAILURE — the two must stay distinct or a failed
  // write renders the success UI (see useShareLinks).
  onSetPassword: (password: string | null) => Promise<string | null | undefined> | void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
};

export function SharePasswordSection({
  sharePassword,
  onSetPassword,
  busy,
  setBusy,
}: SharePasswordSectionProps) {
  // Password field. Kept in the clear (type="text") so the owner can always
  // read it. Seeded from the saved value; `pwSaved` flips the button to
  // "Saved" for a beat after a successful write.
  const [pw, setPw] = useState(sharePassword ?? '');
  const [pwSaved, setPwSaved] = useState(false);
  // The switch. Seeded on when a password is already saved.
  const [enabled, setEnabled] = useState(sharePassword !== null);
  const fieldRef = useRef<HTMLInputElement>(null);

  const savePassword = async () => {
    setBusy(true);
    try {
      const next = pw.trim() ? pw : null;
      const result = onSetPassword(next);
      // Sync (void) handlers — tests — count as success; a promise
      // resolving to `undefined` is a FAILED write (the hook already
      // toasted), so leave the field + button untouched rather than
      // flashing "Saved" over a password that isn't stored.
      const stored = result instanceof Promise ? await result : (next ?? null);
      if (stored === undefined) return;
      // Reflect the server-normalised value so a whitespace-only entry
      // visibly clears.
      setPw(stored ?? '');
      // Saving an empty field clears the password, which is the switch off.
      if (stored === null) setEnabled(false);
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
      const stored = result instanceof Promise ? await result : null;
      // Failed remove: the password still gates every link, so the
      // field must keep showing it.
      if (stored === undefined) return;
      setPw('');
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    if (!enabled) {
      setEnabled(true);
      // The field mounts on this render; focus it on the next frame.
      requestAnimationFrame(() => fieldRef.current?.focus());
      return;
    }
    if (sharePassword) {
      void removePassword();
      return;
    }
    setEnabled(false);
    setPw('');
  };

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
        checked={enabled}
        onChange={toggle}
        disabled={busy}
      />
      {enabled ? (
        // Nested under the setting it belongs to: indented to the footnote's
        // edge with a guide rule, so it reads as the switch's detail rather
        // than a stray field.
        <div className="ml-3.5 flex animate-fade-in items-center gap-2 border-l-2 border-slate-200 py-0.5 pl-3 dark:border-slate-700">
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
                if (e.key === 'Enter' && !busy && pw !== (sharePassword ?? '')) void savePassword();
              }}
              placeholder="Choose a password"
              aria-label="Share password"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-2 pl-8 font-mono text-sm text-slate-800 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <Button
            size="xs"
            onClick={savePassword}
            disabled={busy || pw === (sharePassword ?? '')}
            className="shadow-sm"
          >
            {pwSaved ? 'Saved' : 'Save'}
          </Button>
          {sharePassword ? (
            <Button variant="secondary" size="xs" onClick={removePassword} disabled={busy}>
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
