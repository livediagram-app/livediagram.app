'use client';

import { GlyphDisc, HoverCard, RefreshIcon, IDENTITY_FILL, identityVars } from '@livediagram/ui';
import { initialsOf, randomName, type Participant } from '@/lib/identity';

// "Sharing as" (guests only, docs/specs/007-editor/live-app.md "Layout, top to bottom"): the
// name peers see on cursors and comments, in the footer so it is always in
// view without leading the dialog with a form. Controlled: the dialog holds
// the draft and saves it when a pass is issued or the dialog closes.
export function ShareIdentity({
  participant,
  name,
  onChange,
}: {
  participant: Participant;
  name: string;
  onChange: (name: string) => void;
}) {
  const shown = name.trim() || participant.name;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <GlyphDisc
        size={28}
        as="div"
        role="img"
        aria-label={`Your avatar colour: ${participant.color}`}
        style={identityVars(participant.color)}
        className={`shrink-0 text-[11px] font-semibold text-white ${IDENTITY_FILL}`}
      >
        {initialsOf(shown)}
      </GlyphDisc>
      <div className="flex min-w-0 flex-1 flex-col">
        <label
          htmlFor="share-name"
          className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
        >
          Sharing as
        </label>
        {/* Shuffle sits right against the name it changes, not out by Done. */}
        <div className="-ml-1 flex min-w-0 items-center">
          <HoverCard title="Shuffle name" description="Pick a different random name.">
            <button
              type="button"
              onClick={() => onChange(randomName())}
              aria-label="Generate a different name"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <RefreshIcon size={13} />
            </button>
          </HoverCard>
          <input
            id="share-name"
            value={name}
            onChange={(e) => onChange(e.target.value)}
            placeholder={participant.name}
            aria-label="Your name"
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-200 focus:border-brand-400 dark:text-slate-100 dark:hover:border-slate-700"
          />
        </div>
      </div>
    </div>
  );
}
