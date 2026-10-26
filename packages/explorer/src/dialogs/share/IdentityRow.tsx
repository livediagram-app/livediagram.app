'use client';

// "Sharing as", for a guest: the name people in the item see on cursors and comments, in the footer so it stays in
// view without leading the dialog with a form. Controlled: the dialog holds the draft and saves it.

import { avatarFill } from '../../ui/avatar-fill';
import { GlyphDisc, HoverCard, RefreshIcon } from '@liveworkspace/ui';
import type { ShareIdentity } from './types';

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // Code points, so a name that starts with an emoji keeps it whole.
  const first = (word: string, n = 1) => Array.from(word).slice(0, n).join('');
  const letters =
    words.length > 1
      ? `${first(words[0]!)}${first(words[words.length - 1]!)}`
      : first(words[0] ?? '?', 2);
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
  // Their colour, dark enough for the white initials (ui/avatar-fill.ts).
  const color = identity.color ? avatarFill(identity.color) : null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2" data-share-identity="">
      <GlyphDisc
        size={28}
        as="div"
        role="img"
        aria-label="Your avatar"
        className="shrink-0 bg-slate-500 text-[11px] font-semibold text-white"
        style={color ? { backgroundColor: color } : undefined}
      >
        {initialsOf(shown)}
      </GlyphDisc>
      <div className="flex min-w-0 flex-1 flex-col">
        <label
          htmlFor="share-name"
          className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Sharing as
        </label>
        {/* Shuffle sits right against the name it changes, not out by Done. */}
        <div className="-ml-1 flex min-w-0 items-center">
          {identity.randomName ? (
            <HoverCard title="Shuffle name" description="Pick a different random name.">
              <button
                type="button"
                onClick={() => onChange(identity.randomName!())}
                aria-label="Pick a different name"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition duration-micro hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <RefreshIcon size={13} />
              </button>
            </HoverCard>
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
