'use client';

import Link from 'next/link';
import { BrandMark } from '@livedesign/ui';
import { useAuthHrefs } from '@/components/chrome/auth-shared';

// The guest's sign-in nudge, last in Spaces in place of New Team
// (docs/specs/013-workspace/explorer-structure.md); sidebarGroups decides when it shows. A deep navy card in both
// appearances, the brand prism and a rose glow in its corner (explorer-structure.md "Look").
export function SidebarSignInNudge() {
  const { signInHref } = useAuthHrefs();
  return (
    <Link
      href={signInHref}
      className="relative mt-3 flex flex-col gap-1.5 overflow-hidden rounded-2xl bg-[#0b1230] p-4 text-left transition hover:bg-[#101a40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 dark:ring-1 dark:ring-rose-400/30"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-[120px] rounded-full bg-[radial-gradient(circle,rgba(251,113,133,0.45),transparent_70%)]"
      />
      <span className="relative flex items-center gap-2 text-sm font-semibold text-white">
        <BrandMark className="size-[18px] shrink-0" />
        Sign in to access Teams
      </span>
      <span className="relative text-[12.5px] leading-normal text-[#a9b8d0]">
        Free, and your guest designs come with you.
      </span>
    </Link>
  );
}
