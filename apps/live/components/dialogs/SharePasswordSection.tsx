import { useState } from 'react';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// The share-password band (spec/24): one optional password that gates every
// link. Owns its own field + "Saved" flash state; the busy flag is shared with
// the dialog's link actions (passed in) so a save and a link create can't race.
// Split out of ShareDialog.
type SharePasswordSectionProps = {
  sharePassword: string | null;
  onSetPassword: (password: string | null) => Promise<string | null> | void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  sectionLabel: string;
};

export function SharePasswordSection({
  sharePassword,
  onSetPassword,
  busy,
  setBusy,
  sectionLabel,
}: SharePasswordSectionProps) {
  // Password field. Kept in the clear (type="text") so the owner can always
  // read it. Seeded from the saved value; `pwSaved` flips the button to
  // "Saved" for a beat after a successful write.
  const [pw, setPw] = useState(sharePassword ?? '');
  const [pwSaved, setPwSaved] = useState(false);

  const savePassword = async () => {
    setBusy(true);
    try {
      const next = pw.trim() ? pw : null;
      const stored = await onSetPassword(next);
      // onSetPassword returns the server-normalised value (or void in
      // tests); reflect it so a whitespace-only entry visibly clears.
      setPw(typeof stored === 'string' ? stored : (next ?? ''));
      setPwSaved(true);
      window.setTimeout(() => setPwSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  const removePassword = async () => {
    setBusy(true);
    try {
      await onSetPassword(null);
      setPw('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <p className={sectionLabel}>Password</p>
          <HelpArticleLink
            article="sharePasswords"
            title="Share passwords"
            description="How the optional password gate protects every link."
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="No password"
            aria-label="Share password"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={savePassword}
            disabled={busy || pw === (sharePassword ?? '')}
            className="inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
          >
            {pwSaved ? 'Saved' : 'Save'}
          </button>
          {sharePassword ? (
            <button
              type="button"
              onClick={removePassword}
              disabled={busy}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            >
              Remove
            </button>
          ) : null}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Optional, applies to every link: anyone opening one must enter it first (embed viewers are
          prompted inside the frame). Shown in the clear so you can always read it.
        </p>
      </div>
    </div>
  );
}
