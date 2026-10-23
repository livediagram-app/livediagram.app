'use client';

// The guest's sign-in nudge, last in Spaces in place of Manage Teams: teams need an account. A deep navy card in
// both appearances with a brand glow in its corner. The host says where signing in is (`signInHref`).

import { useExplorer } from './context';

export function SidebarSignInNudge({ href }: { href: string }) {
  const { kind } = useExplorer();
  return (
    <a
      href={href}
      data-sign-in-nudge=""
      className="relative mx-1 mt-3 flex flex-col gap-1.5 overflow-hidden rounded-2xl bg-[#0b1230] p-4 text-left transition hover:bg-[#101a40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:ring-1 dark:ring-brand-400/30"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-[120px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-brand-400)_45%,transparent),transparent_70%)]"
      />
      <span className="relative text-sm font-semibold text-white">Sign in to access Teams</span>
      <span className="relative text-[12.5px] leading-normal text-[#a9b8d0]">
        Free, and your guest {kind.lowerMany} come with you.
      </span>
    </a>
  );
}

/** A team's sidebar badge: how many people are in it, once there is more than the person. */
export function teamMemberBadge(memberCount: number | undefined): {
  badge?: number;
  badgeLabel?: string;
} {
  if (memberCount === undefined || memberCount <= 1) return {};
  return { badge: memberCount, badgeLabel: `${memberCount} members` };
}
