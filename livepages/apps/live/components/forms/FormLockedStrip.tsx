'use client';

// A live form's lock (docs/specs/030-forms/forms.md "A live form is locked"): while it takes responses its questions,
// sections, heading, cover and where its responses go cannot change, so nobody fills in a form that shifts under them
// and every answer keeps its meaning. Edit Form stops it taking responses (its link kept) and unlocks it; Accepting
// Responses opens it again once nothing stops it.
import { lucideGlyph } from '@livepages/ui';
import { lucideLock } from '@livepages/icons/lucide';

const LockGlyph = lucideGlyph(lucideLock, 15);

export function FormLockedStrip({ onEdit, busy }: { onEdit: () => void; busy: boolean }) {
  return (
    <div
      role="status"
      data-form-locked=""
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-700 max-sm:flex-wrap dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200"
    >
      <LockGlyph aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400" />
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Taking responses, so it can’t be changed.</span>{' '}
        <span className="text-slate-500 dark:text-slate-400">
          Edit Form stops it taking responses while you edit; its link stays the same.
        </span>
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onEdit}
        className="shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-700"
      >
        Edit Form
      </button>
    </div>
  );
}
