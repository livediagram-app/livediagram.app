// What the account control's trigger looks like, shared by the menu (AccountMenu) and the Guest stand-in a
// marketing page shows before the menu's code is wanted (DeferredAccountMenu): one look, so the swap moves nothing.
// Plain markup with no dependencies, so the light entry (`/placeholder`) can carry it.

/** The trigger's box: the avatar then the name and chevron, in a row. The placeholder takes the same box, so the swap moves nothing. */
export const ACCOUNT_TRIGGER_BOX =
  'inline-flex max-w-56 items-center gap-2 py-1 pr-2.5 pl-1 text-sm font-medium whitespace-nowrap';

/** The trigger's own classes: its box as a rounded pill. */
export const ACCOUNT_TRIGGER_CLASS = `relative touch-target-y cursor-pointer rounded-full text-slate-900 transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800 ${ACCOUNT_TRIGGER_BOX}`;

/** The word a guest's control shows in place of a name. */
export const GUEST_LABEL = 'Guest';

/** A guest's avatar: a person glyph on a neutral disc, never a presence colour, so it never passes for someone. */
export function GuestAvatar({ large = false }: { large?: boolean }) {
  return (
    <span
      aria-hidden
      data-guest-avatar=""
      className={`flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 ring-1 ring-black/5 ring-inset dark:bg-slate-700 dark:text-slate-300 dark:ring-white/10 ${
        large ? 'size-10' : 'size-7'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={large ? 'size-5' : 'size-4'}
      >
        {/* Lucide's user, drawn 0.75 units higher: as drawn its ink sat 0.38px low in the disc, and a header that
            puts the disc on a half pixel took it to 0.88px (optical-alignment.md). */}
        <circle cx="12" cy="7.25" r="4" />
        <path d="M20 20.25a8 8 0 0 0-16 0" />
      </svg>
    </span>
  );
}

/** The chevron as the house icon set draws it (lucide's chevron-down), drawn inline for the light stand-in, which loads no icon set. */
export function ChevronGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
