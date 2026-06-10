'use client';

import { useEffect, useRef, useState } from 'react';
import { Portal } from './Portal';

// Create / edit form for a team (spec/32): name + organisation.
// Visual sibling of ConfirmDialog (same backdrop, fly-up animation,
// border/shadow stack, button rhythm) but with form fields, so it's
// its own component rather than a ConfirmDialog contortion. The
// caller owns open/close and the submit side-effects; `initial`
// switches it between "New team" and "Edit team" duty.

export function TeamFormModal({
  open,
  title,
  submitLabel,
  initial,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  initial?: { name: string; organisation: string | null };
  onSubmit: (values: { name: string; organisation: string | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Re-seed the fields each time the modal opens: a reopened "New
  // team" must not show the previous attempt, and "Edit team" must
  // show the current values even after a prior edit.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setOrganisation(initial?.organisation ?? '');
    nameRef.current?.focus();
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
    onSubmit({ name: trimmed, organisation: organisation.trim() || null });
  };

  return (
    <Portal>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60"
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-form-title"
          className="flex w-[26rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="border-b border-slate-100 px-6 pt-6 pb-5 dark:border-slate-800">
              <h2
                id="team-form-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-50"
              >
                {title}
              </h2>
              <label className="mt-4 block">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Team name
                </span>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Platform squad"
                  maxLength={80}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Organisation <span className="normal-case text-slate-400">(optional)</span>
                </span>
                <input
                  type="text"
                  value={organisation}
                  onChange={(e) => setOrganisation(e.target.value)}
                  placeholder="e.g. ACME Corp"
                  maxLength={120}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
