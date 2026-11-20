import { BrandMark, type BrandApp } from '@liveworkspace/brand';
import { BrowserWindow } from '@liveworkspace/marketing-site/components/BrowserWindow';
import type { CSSProperties, ReactNode } from 'react';

// A browser window onto an app's work, for the apps section (liveworkspace/docs/specs/010-site/site.md "The front
// door"): what someone sees when a link opens, the app's own bar across the top and another person already in it.
// Decorative.
//
// Everything inside is drawn on a 640-wide design grid in `em`: the screen's font size is a 64th of the window's
// width, so 1em is 10 design pixels, and the app's screen scales as one picture from a phone to a wide desktop,
// the way a screenshot would, instead of reflowing.
export const SCREEN: CSSProperties = { fontSize: 'calc(100cqw / 64)' };

export type Person = { initials: string; colour: string };

export function AppWindow({
  address,
  app,
  title,
  status,
  people,
  accent,
  children,
}: {
  address: string;
  app: BrandApp;
  // The work's name, and what the bar says beside it ("Shared", "4 here").
  title: string;
  status: string;
  // Who else is in it, as the bar's stack of initials.
  people: Person[];
  // The app's deep shade, for its Share button.
  accent: string;
  children: ReactNode;
}) {
  return (
    <div aria-hidden>
      <BrowserWindow address={address}>
        <div style={SCREEN} className="relative">
          <div className="flex h-[3.6em] items-center gap-[0.8em] border-b border-slate-200 bg-white px-[1.4em] dark:border-slate-800 dark:bg-slate-900">
            <BrandMark app={app} className="size-[2em] shrink-0" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[1.25em] font-semibold text-slate-900 dark:text-white">
                {title}
              </span>
              <span className="flex items-center gap-[0.35em] text-[0.95em] text-slate-500 dark:text-slate-400">
                <span className="size-[0.55em] rounded-full bg-emerald-500" />
                {status}
              </span>
            </span>
            <span className="ml-auto flex items-center">
              {people.map((p, i) => (
                <Avatar key={p.initials} person={p} className={i ? '-ml-[0.5em]' : ''} />
              ))}
            </span>
            <span
              className="flex h-[2.6em] items-center gap-[0.45em] rounded-[0.7em] px-[1em] text-[1.05em] font-semibold text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              <svg
                viewBox="0 0 16 16"
                className="size-[1.1em]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M6.5 9.5 9.5 6.5M7 4.5l1-1a3 3 0 0 1 4.5 4.5l-1 1M9 11.5l-1 1A3 3 0 0 1 3.5 8l1-1" />
              </svg>
              Share
            </span>
          </div>
          {children}
        </div>
      </BrowserWindow>
    </div>
  );
}

// Someone's initials on their colour, ringed in the surface they sit on, as the apps' presence stacks draw them.
export function Avatar({ person, className = '' }: { person: Person; className?: string }) {
  return (
    <span
      className={`flex size-[2.4em] items-center justify-center rounded-full text-[0.9em] font-semibold text-white ring-[0.2em] ring-white dark:ring-slate-900 ${className}`}
      style={{ backgroundColor: person.colour }}
    >
      <span className="text-optical-centre">{person.initials}</span>
    </span>
  );
}

// A collaborator's pointer and name tag on a scene, sized in the screen's `em`. Decorative.
export function SceneCursor({
  name,
  colour,
  className = '',
  style,
}: {
  name: string;
  colour: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`pointer-events-none absolute flex items-start ${className}`} style={style}>
      <svg viewBox="0 0 16 16" className="size-[1.8em] drop-shadow-sm">
        <path
          d="M2 1.5 13.5 7 8 8.5 5.5 14z"
          fill={colour}
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="mt-[1.3em] -ml-[0.3em] rounded-[0.5em] px-[0.6em] py-[0.3em] text-[1em] leading-none font-semibold whitespace-nowrap text-white shadow-md"
        style={{ backgroundColor: colour }}
      >
        {name}
      </span>
    </span>
  );
}

// Whose hands a liveplanner card is in: their first name on a tab in their colour, over the card's ring. A board
// draws no cursors (only a Dashboard tab does), so this is how a board shows who is there.
export function HeldBy({ name }: { name: string }) {
  return (
    <span className="absolute -top-2.5 right-2 rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white shadow-sm dark:bg-violet-400 dark:text-slate-950">
      {name}
    </span>
  );
}
