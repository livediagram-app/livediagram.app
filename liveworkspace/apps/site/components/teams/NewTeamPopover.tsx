'use client';

import { lucideGlyph } from '@livediagram/ui';
import { lucidePlus } from '@livediagram/icons/lucide';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { accountApi, errorMessage, type MyTeam } from '@/lib/account-api';
import { teamPath } from '@/lib/teams';
import { BUTTON, INPUT } from '../settings/AccountShell';

const PlusGlyph = lucideGlyph(lucidePlus, 15);

// "New team" and the popover it opens (liveworkspace/docs/site.md "Your account"): one field for the
// name, focused as it opens, and Create, which makes the team and opens its page. Escape, Cancel or a
// click outside closes it and gives focus back to the button; Tab stays inside while it is open.
export function NewTeamPopover({
  align = 'end',
  label = 'New team',
  big = false,
  onCreated = (id: string) => window.location.assign(teamPath(id)),
}: {
  align?: 'end' | 'center';
  label?: string;
  big?: boolean;
  onCreated?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const fieldId = useId();
  const orgId = useId();

  function close() {
    setOpen(false);
    setError(null);
    trigger.current?.focus();
  }

  // Focus the name as it opens; close on a press anywhere outside.
  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return;
      setOpen(false);
      setError(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const focusable = [
      ...panel.current.querySelectorAll<HTMLElement>('input, button:not([disabled])'),
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await accountApi<MyTeam>('/teams', 'POST', { name, organisation });
    if (result.ok) {
      onCreated(result.data.id);
      return;
    }
    setError(result.error);
    setBusy(false);
  }

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={`${BUTTON.primary} relative touch-target-y gap-2 ${big ? 'px-5 py-2.5' : ''}`}
      >
        <PlusGlyph className="-ml-0.5" />
        {label}
      </button>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className={`absolute top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-in rounded-3xl motion-reduce:animate-none border border-slate-200 bg-white p-5 text-left shadow-2xl shadow-slate-900/15 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50 ${
            align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'
          }`}
        >
          <form onSubmit={(event) => void submit(event)}>
            <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-white">
              New team
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              You’ll be its admin. Invite people once it’s made.
            </p>
            <label
              htmlFor={fieldId}
              className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Team name
            </label>
            <input
              ref={field}
              id={fieldId}
              className={`${INPUT} mt-1.5`}
              placeholder="Northwind design"
              maxLength={80}
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-error` : undefined}
            />
            <label
              htmlFor={orgId}
              className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Organisation <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id={orgId}
              className={`${INPUT} mt-1.5`}
              placeholder="Northwind Ltd"
              maxLength={80}
              autoComplete="organization"
              value={organisation}
              onChange={(event) => setOrganisation(event.target.value)}
            />
            {error && (
              <p
                id={`${fieldId}-error`}
                role="alert"
                className="mt-2 text-sm text-rose-700 dark:text-rose-300"
              >
                {errorMessage(error)}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={`${BUTTON.secondary} relative touch-target-y`}
                onClick={close}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`${BUTTON.primary} relative touch-target-y`}
                disabled={busy || !name.trim()}
              >
                {busy ? 'Creating…' : 'Create team'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
