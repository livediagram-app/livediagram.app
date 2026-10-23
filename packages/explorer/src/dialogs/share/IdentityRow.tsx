'use client';

// "Sharing as", for a guest: the name people in the item see on cursors and comments, in the footer so it stays in
// view without leading the dialog with a form. Controlled: the dialog holds the draft and saves it.

import { ShuffleGlyph } from './glyphs';
import type { ShareIdentity } from './types';

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]![0]}${words[words.length - 1]![0]}`
      : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

export function IdentityRow({
  identity,
  name,
  onChange,
}: {
  identity: ShareIdentity;
  name: string;
  onChange: (name: string) => void;
}) {
  const shown = name.trim() || identity.name;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2" data-share-identity="">
      <span
        role="img"
        aria-label="Your avatar"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-500 text-[11px] font-semibold text-white"
        style={identity.color ? { backgroundColor: identity.color } : undefined}
      >
        {initialsOf(shown)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <label
          htmlFor="share-name"
          className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Sharing as
        </label>
        <div className="-ml-1 flex min-w-0 items-center">
          {identity.randomName ? (
            <button
              type="button"
              onClick={() => onChange(identity.randomName!())}
              aria-label="Pick a different name"
              title="Pick a different random name"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <ShuffleGlyph />
            </button>
          ) : null}
          <input
            id="share-name"
            value={name}
            onChange={(e) => onChange(e.target.value)}
            placeholder={identity.name}
            aria-label="Your name"
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-200 focus:border-brand-400 dark:text-slate-100 dark:hover:border-slate-700"
          />
        </div>
      </div>
    </div>
  );
}
