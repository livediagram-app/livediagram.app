'use client';

import type { CSSProperties, ReactNode } from 'react';
import { avatarFill, initials } from '@liveworkspace/account-menu/initials';
import { presenceColour } from '@liveworkspace/settings/presence';
import { buttonClassName, PictureDisc } from '@liveworkspace/ui';

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
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
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
}: {
  identity?: AccountIdentity | null;
  guest?: AccountGuest | null;
}) {
  const isGuest = !identity && Boolean(guest);
  const name = identity?.name || guest?.name || (isGuest ? 'Guest' : 'You');
  const colour = identity?.colour ?? guest?.colour ?? null;
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
        <ul aria-label="About this account" className="mt-4 flex flex-wrap gap-2">
          {isGuest ? (
            <Chip tone="muted">Guest · This browser only</Chip>
          ) : (
            <Chip tone="brand">
              <AccountGlyph />
              liveworkspace account
            </Chip>
          )}
          {joined ? <Chip tone="muted">Joined {joined}</Chip> : null}
          <Chip tone="muted">
            <span
              aria-hidden
              className="size-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/20"
              style={
                colour
                  ? { backgroundColor: cursorColour(name, colour) }
                  : { background: AUTOMATIC_SWATCH }
              }
            />
            Colour: {colourLabel(colour)}
          </Chip>
        </ul>
        {isGuest && guest ? <GuestInvitation guest={guest} /> : null}
      </div>
    </div>
  );
}

const AUTOMATIC_SWATCH =
  'conic-gradient(#0ea5e9, #10b981, #f59e0b, #ef4444, #8b5cf6, #ec4899, #0ea5e9)';

function Chip({ tone, children }: { tone: 'brand' | 'muted'; children: ReactNode }) {
  return (
    <li
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        tone === 'brand'
          ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/30'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200'
      }`}
    >
      {children}
    </li>
  );
}

function AccountGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor">
      <path
        d="M8 1.75 13.25 4v4c0 3-2.25 5.25-5.25 6.25C5 13.25 2.75 11 2.75 8V4z"
        strokeWidth={1.4}
      />
      <path
        d="m5.75 8 1.6 1.6 2.9-3.1"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      <svg
        viewBox="0 0 480 112"
        preserveAspectRatio="xMaxYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        {/* Two cards on the canvas, joined, in the brand's tint. */}
        <g className="text-brand-300 dark:text-brand-500/50">
          <rect
            x="250"
            y="22"
            width="78"
            height="40"
            rx="8"
            className="fill-white dark:fill-slate-800"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="262" y="34" width="44" height="5" rx="2.5" fill="currentColor" opacity="0.7" />
          <rect x="262" y="45" width="30" height="5" rx="2.5" fill="currentColor" opacity="0.45" />
          <rect
            x="374"
            y="58"
            width="78"
            height="40"
            rx="8"
            className="fill-white dark:fill-slate-800"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="386" y="70" width="40" height="5" rx="2.5" fill="currentColor" opacity="0.7" />
          <rect x="386" y="81" width="52" height="5" rx="2.5" fill="currentColor" opacity="0.45" />
          <path
            d="M328 42c26 0 22 36 46 36"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        </g>
        {/* A collaborator, faint. */}
        <path
          d="M440 14l10 4.8-4.5 1.2-2.2 4.6z"
          className="fill-slate-400/70 dark:fill-slate-500/70"
        />
      </svg>
      {/* Their own cursor and tag, in their colour. */}
      <div className="absolute top-7 right-[22.5rem] flex items-start">
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
          <span className="text-optical-centre min-w-0 truncate">{name}</span>
        </span>
      </div>
    </div>
  );
}
