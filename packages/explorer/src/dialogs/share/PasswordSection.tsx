'use client';

// Password Protection: one optional password that guards every link of the item, behind a switch. Off hides the
// field and on shows it; with a password saved, switching off removes it, so the switch never disagrees with what
// the index enforces. The index keeps only a hash, so a saved password can't be shown again: it reads "Password Set"
// with Replace and Remove. Spaces around a password are trimmed, and a field of spaces alone saves nothing. A new
// password needs SHARE_PASSWORD_MIN characters (the index refuses fewer); until then Save waits and the field says so.

import { useRef, useState } from 'react';
import { SHARE_PASSWORD_MAX, SHARE_PASSWORD_MIN } from '@liveworkspace/index-client';
import { Button, Switch } from '@liveworkspace/ui';
import { LockIcon } from '../../ui/icons';
import { HelpLink } from './HelpLink';
import type { ShareHelpHref } from './types';

const DETAIL =
  'ml-3.5 flex animate-fade-in items-center gap-2 border-l-2 border-slate-200 py-0.5 pl-3 dark:border-slate-700';

/** What a typed password saves as: trimmed, or nothing for spaces alone. */
export function passwordToSave(typed: string): string | null {
  const trimmed = typed.trim();
  return trimmed ? trimmed : null;
}

export function PasswordSection({
  passwordSet,
  busy,
  helpHref,
  lockedReason = null,
  onSet,
}: {
  passwordSet: boolean;
  busy: boolean;
  helpHref?: ShareHelpHref;
  // Why it cannot be switched on now; a password already set can still be removed.
  lockedReason?: string | null;
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
    if (!next || next.length < SHARE_PASSWORD_MIN) return;
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
  // The host's lock: a password already in force stays removable; only setting a new one is locked.
  const locked = !!lockedReason && !passwordSet;
  const next = passwordToSave(typed);
  const tooShort = next !== null && next.length < SHARE_PASSWORD_MIN;
  const canSave = !busy && next !== null && !tooShort;

  return (
    <section
      aria-label="Password"
      data-tour-id="share-password"
      className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"
    >
      {/* The Settings dialog's own row, as a card: the words, Learn more, and the switch, which a press anywhere on
          the card flips (its hit area covers the card; Learn more sits above it and keeps its own click). */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div
          className={`relative flex items-center gap-4 rounded-[inherit] px-4 py-3 ${
            locked
              ? ''
              : 'transition-colors duration-micro hover:bg-slate-50 dark:hover:bg-slate-700/40'
          }`}
        >
          <div className={`min-w-[9rem] flex-1 ${locked ? 'opacity-50' : ''}`}>
            <div
              id="share-password-label"
              className="text-sm font-medium text-slate-800 dark:text-slate-100"
            >
              Password Protection
            </div>
            <p
              id="share-password-description"
              className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
            >
              Everyone opening a pass must enter it first, embeds included.
              {helpHref?.('sharePasswords') ? (
                <span className="relative z-[1]">
                  {' '}
                  <HelpLink
                    href={helpHref('sharePasswords')}
                    label="How share passwords work"
                    variant="text"
                  />
                </span>
              ) : null}
            </p>
          </div>
          <Switch
            size="sm"
            checked={on}
            labelledBy="share-password-label"
            describedBy="share-password-description"
            disabled={locked}
            busy={busy}
            onChange={toggle}
            coversRow
            className="ml-auto"
          />
        </div>
      </div>
      {/* While the host locks it (a listed Community post), why, on the detail's guide rule. */}
      {locked ? (
        <p className="ml-3.5 border-l-2 border-slate-200 pl-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {lockedReason}
        </p>
      ) : null}
      {on && showSet ? (
        <div className={DETAIL}>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span className="shrink-0 text-slate-400">
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
          <Button variant="secondary" size="xs" busy={busy} onClick={() => void remove()}>
            Remove
          </Button>
        </div>
      ) : null}
      {on && !showSet && !locked ? (
        <>
          <form
            className={DETAIL}
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave) void save();
            }}
          >
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <LockIcon />
              </span>
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
                aria-describedby={tooShort ? 'share-password-hint' : undefined}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 font-mono text-sm text-slate-800 outline-none transition duration-micro placeholder:font-sans placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <Button
              type="submit"
              size="xs"
              // Busy, not disabled, while it saves (busy-buttons.md); disabled only while the password is not ready.
              disabled={next === null || tooShort}
              busy={busy}
              className="shadow-sm"
            >
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
          {tooShort ? (
            <p
              id="share-password-hint"
              className="ml-3.5 border-l-2 border-slate-200 pl-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
            >
              At least {SHARE_PASSWORD_MIN} characters.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
