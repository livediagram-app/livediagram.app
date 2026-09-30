'use client';

// One centred card on a bare page, for the top-level landings that sit
// outside the Explorer chrome: the team invite link (/join) and the Google
// Drive routes (/drive/connected, /drive/open).

import type { ReactNode } from 'react';
import { Brand, buttonClassName, ButtonContent } from '@livediagram/ui';

export function LandingCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-[26rem] max-w-full rounded-2xl border border-slate-200 bg-white px-8 py-9 text-center shadow-xl shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex justify-center">
          <Brand size="md" />
        </div>
        {children}
      </div>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-400">
      {children}
    </p>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">{children}</h1>
  );
}

export function Body({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  // Anchor styled as the shared primary button (buttonClassName is the
  // anchor escape hatch; Button itself is <button>-only).
  return (
    <a href={href} className={buttonClassName({ size: 'md', className: 'mt-5 px-5' })}>
      <ButtonContent>{children}</ButtonContent>
    </a>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={buttonClassName({ variant: 'secondary', size: 'md', className: 'px-5' })}
    >
      <ButtonContent>{children}</ButtonContent>
    </a>
  );
}
