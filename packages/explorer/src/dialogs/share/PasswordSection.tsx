'use client';

// Password Protection: one optional password that guards every link of the item, behind a switch. Off hides the
// field and on shows it; with a password saved, switching off removes it, so the switch never disagrees with what
// the index enforces. The index keeps only a hash, so a saved password can't be shown again: it reads "Password Set"
// with Replace and Remove. Spaces around a password are trimmed, and a field of spaces alone saves nothing.

import { useRef, useState } from 'react';
import { SHARE_PASSWORD_MAX } from '@liveworkspace/index-client';
import { Button } from '../../ui/Button';
import { LockIcon } from '../../ui/icons';
import { HelpLink } from './HelpLink';
import type { ShareHelpHref } from './types';

const DETAIL =
  'ml-3.5 flex items-center gap-2 border-l-2 border-slate-200 py-0.5 pl-3 dark:border-slate-700';

/** What a typed password saves as: trimmed, or nothing for spaces alone. */
export function passwordToSave(typed: string): string | null {
  const trimmed = typed.trim();
  return trimmed ? trimmed : null;
}

export function PasswordSection({
  passwordSet,
  busy,
  helpHref,
  onSet,
}: {
  passwordSet: boolean;
  busy: boolean;
  helpHref?: ShareHelpHref;
  // Resolves true once the index took it; false when it refused (the dialog has said so).
  onSet: (password: string | null) => Promise<boolean>;
}) {
  const [typed, setTyped] = useState('');
  const [saved, setSaved] = useState(false);
  // Switched on with nothing saved yet: the field is open.
  const [enabled, setEnabled] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const on = passwordSet || enabled;
  const focusField = () => requestAnimationFrame(() => field.current?.focus());

  const save = async () => {
    const next = passwordToSave(typed);
    if (!next) return;
    if (!(await onSet(next))) return;
    setTyped('');
    setReplacing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const remove = async () => {
    if (!(await onSet(null))) return;
    setTyped('');
    setReplacing(false);
    setEnabled(false);
  };
  const toggle = () => {
    if (!on) {
      setEnabled(true);
      focusField();
    } else if (passwordSet) {
      void remove();
    } else {
      setEnabled(false);
      setTyped('');
    }
  };
  const showSet = passwordSet && !replacing;
  const canSave = !busy && passwordToSave(typed) !== null;

  return (
    <section
      aria-label="Password"
      data-tour-id="share-password"
      className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-medium text-slate-800 dark:text-slate-100">
            Password Protection
            <HelpLink href={helpHref?.('sharePasswords')} label="How share passwords work" />
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Everyone opening a pass must enter it first, embeds included.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Password Protection"
          disabled={busy}
          onClick={toggle}
          className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
            on ? 'bg-brand-700 dark:bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${on ? 'translate-x-4' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
      {on && showSet ? (
        <div className={DETAIL}>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span className="text-slate-400">
              <LockIcon />
            </span>
            {saved ? 'Password Saved' : 'Password Set'}
          </p>
          <Button
            variant="secondary"
            size="xs"
            disabled={busy}
            onClick={() => {
              setReplacing(true);
              focusField();
            }}
          >
            Replace
          </Button>
          <Button variant="secondary" size="xs" disabled={busy} onClick={() => void remove()}>
            Remove
          </Button>
        </div>
      ) : null}
      {on && !showSet ? (
        <form
          className={DETAIL}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) void save();
          }}
        >
          <input
            ref={field}
            type="text"
            value={typed}
            maxLength={SHARE_PASSWORD_MAX}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && replacing) {
                // Escape here backs out of Replace, and leaves the dialog open.
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                setReplacing(false);
                setTyped('');
              }
            }}
            placeholder={replacing ? 'Choose a new password' : 'Choose a password'}
            aria-label="Share password"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-sm text-slate-800 outline-none placeholder:font-sans placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <Button type="submit" size="xs" disabled={!canSave}>
            Save
          </Button>
          {replacing ? (
            <Button
              variant="secondary"
              size="xs"
              disabled={busy}
              onClick={() => {
                setReplacing(false);
                setTyped('');
              }}
            >
              Cancel
            </Button>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
