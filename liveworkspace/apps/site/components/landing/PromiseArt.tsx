import { lucideGlyph } from '@livediagram/ui';
import {
  lucideAtSign,
  lucideCheck,
  lucideChevronDown,
  lucideGlobe,
  lucideKey,
  lucideLock,
} from '@liveworkspace/icons/lucide';
import type { CSSProperties, ReactNode } from 'react';
import { type ListedApp, listedApps } from '@/lib/apps';
import { AppMark } from './AppLogo';
import { Cursor } from './Cursor';

// The illustrations on "What every app shares" (liveworkspace/docs/specs/010-site/site.md "The front door"): each
// promise drawn as a small piece of the product, in the apps' own colours, light and dark. All
// decorative; the tile's words carry the meaning.

const CheckGlyph = lucideGlyph(lucideCheck, 12);
const ChevronGlyph = lucideGlyph(lucideChevronDown, 12);
const GlobeGlyph = lucideGlyph(lucideGlobe, 14);
const AtGlyph = lucideGlyph(lucideAtSign, 12);
const KeyGlyph = lucideGlyph(lucideKey, 14);
const LockGlyph = lucideGlyph(lucideLock, 12);

const ink = (app: ListedApp) =>
  ({
    '--lw-ink': app.deep,
    '--lw-ink-dark': app.light,
    '--lw-accent': app.accent,
  }) as CSSProperties;

const appById = (id: string) => listedApps().find((a) => a.id === id) ?? listedApps()[0]!;

// The panel every illustration sits in: the same white card, the same height, so a row of tiles
// lines up.
export function ArtFrame({
  children,
  className = '',
  surface = 'bg-white ring-slate-200 dark:bg-slate-950/50 dark:ring-slate-800',
}: {
  children: ReactNode;
  className?: string;
  surface?: string;
}) {
  return (
    <div
      aria-hidden
      className={`relative h-44 overflow-hidden rounded-2xl ring-1 select-none ${surface} ${className}`}
    >
      {children}
    </div>
  );
}

// A faint dot grid, as the apps' canvases have.
function Dots() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1px,transparent_1px)] [background-size:14px_14px] dark:bg-[radial-gradient(circle,rgb(71_85_105/0.5)_1px,transparent_1px)]" />
  );
}

// Live by default: a canvas with people in it, one moving a card, one typing in a note.
export function LiveArt() {
  const diagram = appById('livediagram.app');
  const planner = appById('liveplanner.app');
  return (
    <ArtFrame>
      <Dots />
      <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-white/90 py-1 pr-2.5 pl-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/90 dark:ring-slate-700">
        <div className="flex -space-x-1.5">
          {['bg-sky-500', 'bg-violet-500', 'bg-amber-400'].map((c) => (
            <span
              key={c}
              className={`size-5 rounded-full ring-2 ring-white dark:ring-slate-900 ${c}`}
            />
          ))}
        </div>
        <span className="relative flex size-2">
          <span className="lw-ping absolute inset-0 rounded-full bg-emerald-500" />
          <span className="relative size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">3 here</span>
      </div>
      <div
        className="absolute top-12 left-5 w-28 rounded-lg border-2 border-[var(--lw-ink)] bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 shadow-sm dark:border-[var(--lw-ink-dark)] dark:bg-slate-900 dark:text-slate-100"
        style={ink(diagram)}
      >
        Research
        <span className="absolute -top-1 -left-1 size-2 rounded-sm bg-white ring-2 ring-[var(--lw-ink)] dark:bg-slate-900 dark:ring-[var(--lw-ink-dark)]" />
        <span className="absolute -right-1 -bottom-1 size-2 rounded-sm bg-white ring-2 ring-[var(--lw-ink)] dark:bg-slate-900 dark:ring-[var(--lw-ink-dark)]" />
      </div>
      <Cursor name="Ada" colour={diagram.deep} className="absolute top-[88px] left-[118px]" />
      <div className="absolute right-6 bottom-5 w-32 rotate-2 rounded-md bg-amber-100 px-2.5 py-2 text-[11px] leading-snug text-amber-950 shadow-md dark:bg-amber-300">
        Ship it on Friday
        <span className="ml-px inline-block h-3 w-px translate-y-0.5 animate-pulse bg-amber-950 motion-reduce:animate-none" />
      </div>
      <Cursor name="Sam" colour={planner.deep} className="lw-drift-b absolute right-2 bottom-1" />
    </ArtFrame>
  );
}

// Share by link: the share box, the link copied, and who it lets in.
export function ShareArt() {
  const design = appById('livedesign.app');
  return (
    <ArtFrame
      className="flex items-center justify-center px-4"
      surface="bg-gradient-to-br from-slate-50 to-white ring-slate-200 dark:from-slate-900 dark:to-slate-950/50 dark:ring-slate-800"
    >
      <div className="w-full max-w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 dark:text-white">Share</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <GlobeGlyph />
            Anyone with the link
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            livedesign.app/s/NW7Q2K
          </span>
          <span
            className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--lw-ink)] px-2 py-1.5 text-[11px] font-semibold text-white"
            style={ink(design)}
          >
            <CheckGlyph />
            Copied
          </span>
        </div>
        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-800/70">
          <span className="text-[11px] text-slate-600 dark:text-slate-300">
            People with the link
          </span>
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-slate-900 dark:text-white">
            Can edit
            <ChevronGlyph />
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <LockGlyph />
          Password and expiry, if you want them
        </div>
      </div>
    </ArtFrame>
  );
}

// One Inbox: what needs you, from every app, newest first.
export function InboxArt() {
  const rows = [
    {
      app: 'liveplanner.app',
      who: 'Sam',
      colour: 'bg-violet-500',
      what: 'assigned you',
      item: 'Pick a date',
      fresh: true,
    },
    {
      app: 'livediagram.app',
      who: 'Ada',
      colour: 'bg-sky-500',
      what: 'mentioned you in',
      item: 'Launch flow',
      fresh: true,
    },
    {
      app: 'livedesign.app',
      who: 'Kai',
      colour: 'bg-rose-500',
      what: 'replied on',
      item: 'Launch logo',
      fresh: false,
    },
  ];
  return (
    <ArtFrame className="p-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-slate-900 dark:text-white">Inbox</span>
        <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900">
          2 new
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {rows.map((r) => {
          const app = appById(r.app);
          return (
            <div
              key={r.app}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
              style={ink(app)}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${r.colour}`}
              >
                <span className="text-optical-centre">{r.who[0]}</span>
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">{r.who}</span>{' '}
                {r.what}{' '}
                <span className="font-semibold text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">
                  {r.item}
                </span>
              </span>
              <AppMark app={app} className="size-4 shrink-0" />
              <span
                className={`size-1.5 shrink-0 rounded-full ${r.fresh ? 'bg-[var(--lw-accent)]' : 'bg-transparent'}`}
              />
            </div>
          );
        })}
      </div>
      <span className="absolute right-3 bottom-2 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
        <AtGlyph />
        Mentions, comments and actions
      </span>
    </ArtFrame>
  );
}

// Teams across every app: one team, its people, and its work in each app.
export function TeamsArt() {
  return (
    <ArtFrame className="flex flex-col items-center justify-center gap-3 px-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-xs font-bold text-white">
          N
        </span>
        <span>
          <span className="block text-xs font-semibold text-slate-900 dark:text-white">
            Northwind
          </span>
          <span className="block text-[10px] text-slate-500 dark:text-slate-400">5 members</span>
        </span>
        <span className="ml-1 flex -space-x-1.5">
          {['bg-sky-500', 'bg-violet-500', 'bg-amber-400', 'bg-rose-500', 'bg-emerald-500'].map(
            (c) => (
              <span
                key={c}
                className={`size-5 rounded-full ring-2 ring-white dark:ring-slate-900 ${c}`}
              />
            ),
          )}
        </span>
      </div>
      <svg viewBox="0 0 240 18" className="h-4 w-60 text-slate-300 dark:text-slate-600" fill="none">
        {[30, 90, 150, 210].map((x) => (
          <path
            key={x}
            d={`M120 1 C120 10 ${x} 8 ${x} 17`}
            stroke="currentColor"
            strokeWidth="1.25"
          />
        ))}
      </svg>
      <div className="grid w-full max-w-72 grid-cols-4 gap-1.5">
        {listedApps().map((app) => (
          <div
            key={app.id}
            className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 dark:border-slate-700 dark:bg-slate-900"
            style={ink(app)}
          >
            <AppMark app={app} className="size-5" />
            <span className="text-[10px] font-semibold text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">
              Northwind
            </span>
          </div>
        ))}
      </div>
    </ArtFrame>
  );
}

// One key for scripts and AI: a token at work from the command line, good in every app.
export function KeyArt() {
  return (
    <ArtFrame surface="bg-slate-950 ring-slate-800 dark:ring-slate-700">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
        {['bg-rose-400/80', 'bg-amber-400/80', 'bg-emerald-400/80'].map((c) => (
          <span key={c} className={`size-2 rounded-full ${c}`} />
        ))}
        <span className="ml-2 text-[10px] text-slate-400">terminal</span>
      </div>
      <div className="px-3 py-2.5 font-mono text-[11px] leading-relaxed">
        <div className="text-slate-300">
          <span className="text-emerald-400">$</span> export LW_TOKEN=lwt_
          <span className="text-slate-500">••••</span>3f9a
        </div>
        <div className="text-slate-300">
          <span className="text-emerald-400">$</span> liveworkspace list --all
        </div>
        {listedApps().map((app) => (
          <div key={app.id} className="flex items-center gap-2 text-slate-400">
            <span style={{ color: app.accent }}>●</span>
            <span className="w-24 text-slate-300">{app.name}</span>
            <span className="text-emerald-400">ok</span>
          </div>
        ))}
      </div>
      <span className="absolute top-9 right-3 flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white ring-1 ring-white/15">
        <KeyGlyph />
        One token
      </span>
    </ArtFrame>
  );
}

// Open about data: a public chart of anonymous totals, each app in its colour.
export function DataArt() {
  const apps = listedApps();
  // Four weeks of made-up totals per app, stacked.
  const weeks = [
    [14, 9, 6, 4],
    [17, 11, 7, 6],
    [16, 13, 9, 7],
    [21, 15, 10, 9],
    [24, 17, 12, 10],
    [27, 20, 15, 12],
  ];
  const max = Math.max(...weeks.map((w) => w.reduce((a, b) => a + b, 0)));
  return (
    <ArtFrame className="flex flex-col p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-900 dark:text-white">
          Items made, by week
        </span>
        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <GlobeGlyph />
          Public
        </span>
      </div>
      <div className="mt-3 flex flex-1 items-end gap-2 border-b border-slate-200 px-1 dark:border-slate-700">
        {weeks.map((w, i) => {
          const total = w.reduce((a, b) => a + b, 0);
          return (
            <div
              key={i}
              className="flex flex-1 flex-col-reverse overflow-hidden rounded-t-md"
              style={{ height: `${(total / max) * 100}%` }}
            >
              {w.map((n, j) => (
                <span
                  key={j}
                  style={{ height: `${(n / total) * 100}%`, backgroundColor: apps[j]?.accent }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {apps.map((app) => (
          <span
            key={app.id}
            className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"
          >
            <AppMark app={app} className="size-3 shrink-0" />
            {app.name}
          </span>
        ))}
      </div>
    </ArtFrame>
  );
}

// Yours to keep: a code by email instead of a password, and one close that reaches every app.
export function KeepArt() {
  return (
    <ArtFrame className="flex flex-col items-center justify-center gap-3 px-3">
      <div className="text-center">
        <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          Your code, no password
        </span>
        <div className="mt-1.5 flex gap-1.5">
          {['4', '8', '2', '9', '1', '6'].map((d, i) => (
            <span
              key={i}
              className="flex h-8 w-6 items-center justify-center rounded-md border border-slate-200 bg-white font-mono text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
      <div className="flex w-full max-w-72 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 dark:border-rose-500/30 dark:bg-rose-500/10">
        <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
          Close account
        </span>
        <span className="text-rose-300 dark:text-rose-500/60">→</span>
        <span className="flex gap-1">
          {listedApps().map((app) => (
            <span key={app.id} className="relative">
              <AppMark app={app} className="size-4 opacity-40 grayscale" />
            </span>
          ))}
        </span>
        <span className="ml-auto text-[10px] font-semibold text-rose-700 dark:text-rose-300">
          All gone
        </span>
      </div>
    </ArtFrame>
  );
}

// Completely free: the whole price list.
export function FreeArt() {
  return (
    <ArtFrame
      className="flex items-center justify-center"
      surface="bg-gradient-to-br from-emerald-50 to-white ring-slate-200 dark:from-emerald-500/10 dark:to-slate-950/50 dark:ring-slate-800"
    >
      <div className="w-full max-w-60 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
        <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          Every app, every feature
        </span>
        <div className="mt-1 flex items-baseline justify-center gap-1">
          <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            £0
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">for everyone</span>
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {listedApps().map((app) => (
            <AppMark key={app.id} app={app} className="size-5" />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckGlyph />
          No card, no trial, no paywall
        </div>
      </div>
    </ArtFrame>
  );
}
