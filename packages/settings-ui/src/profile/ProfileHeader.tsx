'use client';

import type { CSSProperties, ReactNode } from 'react';
import { avatarFill, initials } from '@liveworkspace/account-menu/initials';
import { presenceColour } from '@liveworkspace/settings/presence';
import { buttonClassName, PictureDisc } from '@liveworkspace/ui';
import { MONTH_YEAR } from '@liveworkspace/ui/date-format';
import { useLiveProfile } from './live-profile';
import type { ProfileHost } from './profile-host';

// The Profile's header card (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile"): who is signed in, as the old
// livediagram Profile page opened with, richer. A banner in the app's brand tint, drawn as a canvas where the person's
// cursor and name tag sit in their presence colour, then their avatar, name, email and what kind of account it is.
// A guest gets the same card as a guest, with the way to sign in, rather than empty rows.

/** Who the Profile is about, as the host knows them. */
export type AccountIdentity = {
  // The name collaborators see (the profile's display name, else the account's).
  name: string;
  email?: string | null;
  // The presence colour, null for Automatic (each app picks one).
  colour?: string | null;
  // Their own Google picture, null with none (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): the avatar shows
  // it over the initials. Their own screen always shows it, whatever Show My Google Picture says.
  picture?: string | null;
  // When the account was made.
  joined?: string | number | Date | null;
};

/** A guest, where the panel shows one a Profile: their name and colour where the app has them, and the way in. */
export type AccountGuest = {
  name?: string | null;
  colour?: string | null;
  signInHref: string;
  signUpHref?: string;
  // What their work is called in this app ("canvases", "plans").
  things?: string;
};

function joinedText(joined: AccountIdentity['joined']): string | null {
  if (joined === null || joined === undefined || joined === '') return null;
  const date = joined instanceof Date ? joined : new Date(joined);
  if (Number.isNaN(date.getTime())) return null;
  return MONTH_YEAR.format(date);
}

/** A colour's palette name ("Sky"), "Custom" for one off the palette, or "Automatic". */
export function colourLabel(colour: string | null | undefined): string {
  if (!colour) return 'Automatic';
  return presenceColour(colour)?.name ?? 'Custom';
}

// The avatar's fill as the account menu paints it: the presence colour's deep shade, else the colour picked from the
// name, so the disc here is the one in the header.
function avatarStyle(name: string, colour: string | null | undefined): CSSProperties {
  return { backgroundColor: avatarFill(name, colour ?? null) };
}

// The colour a cursor and name tag are drawn in: the presence colour, else the name's own.
function cursorColour(name: string, colour: string | null | undefined): string {
  return avatarFill(name, colour ?? null);
}

export function ProfileHeaderCard({
  identity,
  guest,
  profile,
}: {
  identity?: AccountIdentity | null;
  guest?: AccountGuest | null;
  // Where the panel edits the profile: the card reads its name and colour from there and follows each save.
  profile?: ProfileHost;
}) {
  const live = useLiveProfile(identity ? profile : undefined);
  const isGuest = !identity && Boolean(guest);
  const name = live?.name || identity?.name || guest?.name || (isGuest ? 'Guest' : 'You');
  const colour = live ? live.color : (identity?.colour ?? guest?.colour ?? null);
  const joined = joinedText(identity?.joined);
  return (
    <div data-profile-header="" className="rounded-[inherit]">
      <ProfileBanner name={name} colour={colour} />
      <div className="relative px-5 pb-5">
        <div className="-mt-9 flex flex-wrap items-end gap-x-4 gap-y-3">
          <PictureDisc
            aria-hidden
            data-profile-avatar=""
            pictureUrl={identity?.picture}
            name={name}
            size={72}
            style={avatarStyle(name, colour)}
            className="flex text-2xl font-semibold text-white shadow-md ring-4 ring-white dark:ring-slate-800"
          >
            {isGuest && !guest?.name ? 'G' : initials(name)}
          </PictureDisc>
          <div className="min-w-0 flex-1 pb-0.5">
            <h3 className="truncate text-lg leading-tight font-semibold text-slate-900 dark:text-white">
              {name}
            </h3>
            {identity?.email ? (
              <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
                {identity.email}
              </p>
            ) : isGuest ? (
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">Not signed in</p>
            ) : null}
          </div>
        </div>
        {isGuest || joined ? (
          <ul aria-label="About this account" className="mt-4 flex flex-wrap gap-2">
            {isGuest ? <Chip>Guest · This browser only</Chip> : null}
            {joined ? <Chip>Joined {joined}</Chip> : null}
          </ul>
        ) : null}
        {isGuest && guest ? <GuestInvitation guest={guest} /> : null}
      </div>
    </div>
  );
}

// No "liveworkspace account" chip (everyone signed in has one) and no colour chip (the banner's name tag, the avatar
// and Name and Colour below already show it): only what is worth a glance.
function Chip({ children }: { children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700/60 dark:text-slate-200">
      {children}
    </li>
  );
}

// What signing in adds, and the way in: a guest's Profile, in place of rows that couldn't apply.
function GuestInvitation({ guest }: { guest: AccountGuest }) {
  const things = guest.things ?? 'work';
  return (
    <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-400/25 dark:bg-brand-500/10">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">
        Sign in to make this yours
      </p>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        <li>Keep your {things} and settings on every device.</li>
        <li>Choose the name and colour collaborators see on your cursor.</li>
        <li>Share with your team, and get an email when someone comments.</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={guest.signInHref}
          data-settings-sign-in=""
          className={buttonClassName({ variant: 'primary', size: 'sm' })}
        >
          Sign in
        </a>
        {guest.signUpHref ? (
          <a
            href={guest.signUpHref}
            className={buttonClassName({ variant: 'secondary', size: 'sm' })}
          >
            Create account
          </a>
        ) : null}
      </div>
    </div>
  );
}

// The banner: a dotted canvas in the brand's tint, a collaborator's cursor faint in the corner, and the person's own
// cursor with their name tag in their colour, as others see it.
function ProfileBanner({ name, colour }: { name: string; colour: string | null }) {
  const fill = cursorColour(name, colour);
  return (
    <div
      aria-hidden
      data-profile-banner=""
      className="relative h-28 overflow-hidden rounded-t-[inherit] bg-gradient-to-br from-brand-50 via-white to-brand-100 dark:from-slate-900 dark:via-slate-900 dark:to-brand-500/25"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgb(100_116_139/0.28)_1px,transparent_1px)] bg-[length:14px_14px] dark:bg-[radial-gradient(circle,rgb(148_163_184/0.18)_1px,transparent_1px)]" />
      {/* A canvas across the whole banner, in the brand's tint: a sticky note, a small flow of cards and a decision
          joined by dashed lines, and a collaborator at work. Sliced from the middle, so any width fills edge to edge
          and the scene stays centred; the left end stays quiet where the avatar overlaps it. */}
      <svg
        viewBox="0 0 720 112"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <g className="text-brand-300 dark:text-brand-500/50">
          <g transform="rotate(-5 172 40)">
            <rect
              x="150"
              y="18"
              width="46"
              height="42"
              rx="3"
              className="fill-amber-100 dark:fill-amber-400/20"
            />
            <rect
              x="158"
              y="28"
              width="28"
              height="4"
              rx="2"
              className="fill-amber-300/80 dark:fill-amber-300/40"
            />
            <rect
              x="158"
              y="37"
              width="20"
              height="4"
              rx="2"
              className="fill-amber-300/60 dark:fill-amber-300/30"
            />
          </g>
          <path
            d="M200 44c18 0 16-12 34-12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <rect
            x="234"
            y="16"
            width="80"
            height="40"
            rx="8"
            className="fill-white dark:fill-slate-800"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="246" y="28" width="46" height="5" rx="2.5" fill="currentColor" opacity="0.7" />
          <rect x="246" y="39" width="30" height="5" rx="2.5" fill="currentColor" opacity="0.45" />
          <path
            d="M314 36c30 0 24 38 54 38"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <rect
            x="368"
            y="54"
            width="80"
            height="40"
            rx="8"
            className="fill-white dark:fill-slate-800"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="380" y="66" width="40" height="5" rx="2.5" fill="currentColor" opacity="0.7" />
          <rect x="380" y="77" width="54" height="5" rx="2.5" fill="currentColor" opacity="0.45" />
          <path
            d="M448 74c26 0 22-34 46-34"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <rect
            x="497"
            y="23"
            width="34"
            height="34"
            rx="5"
            transform="rotate(45 514 40)"
            className="fill-brand-50 dark:fill-slate-800"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M538 40c22 0 20 30 42 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <rect
            x="580"
            y="50"
            width="86"
            height="40"
            rx="8"
            className="fill-white dark:fill-slate-800"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="592" y="62" width="50" height="5" rx="2.5" fill="currentColor" opacity="0.7" />
          <rect x="592" y="73" width="34" height="5" rx="2.5" fill="currentColor" opacity="0.45" />
        </g>
        {/* A collaborator, faint. */}
        <path
          d="M612 14l10 4.8-4.5 1.2-2.2 4.6z"
          className="fill-slate-400/70 dark:fill-slate-500/70"
        />
        <rect
          x="620"
          y="24"
          width="34"
          height="11"
          rx="5.5"
          className="fill-slate-300/70 dark:fill-slate-600/60"
        />
      </svg>
      {/* Their own cursor and tag, in their colour. */}
      <div className="absolute top-3 left-[38%] flex items-start">
        <svg viewBox="0 0 16 16" className="size-5 drop-shadow-sm">
          <path
            d="M2 1.5 14 7.2l-5.4 1.4L6 14z"
            fill={fill}
            className="stroke-white dark:stroke-slate-900"
            strokeWidth={1.25}
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="mt-4 -ml-1 inline-flex h-6 max-w-40 items-center rounded-full px-2.5 text-xs font-semibold text-white shadow-sm"
          style={{ backgroundColor: fill }}
        >
          <span className="text-optical-line min-w-0 truncate">{name}</span>
        </span>
      </div>
    </div>
  );
}
