import { BrandMark, lucideGlyph } from '@livediagram/ui';
import { lucideFolder } from '@liveworkspace/icons/lucide';
import { PLATFORM_SITE, type SiteId } from '@liveworkspace/sites';
import type { CSSProperties, ReactNode } from 'react';
import { listedApps } from '@/lib/apps';
import { AppMark } from './AppLogo';
import {
  DataArt,
  FreeArt,
  InboxArt,
  KeepArt,
  KeyArt,
  LiveArt,
  ShareArt,
  TeamsArt,
} from './PromiseArt';

const FolderIcon = lucideGlyph(lucideFolder, 20);

// What every app shares (liveworkspace/docs/specs/010-site/site.md "The front door"): the promises that hold in
// whichever app you open, each with a small piece of the product drawn above it.
export function Promises() {
  return (
    <section
      id="what-you-get"
      className="scroll-mt-20 border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-sm font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
          What every app shares
        </p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Different apps, the same promises.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Whichever one you open, this is what you get.
        </p>

        {/* 15 cells over 3 columns, 12 over 2: every row full. */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile
            className="sm:col-span-2 lg:row-span-2"
            art={<AccountArt />}
            title="One account, every app"
            body="Sign in once at liveworkspace.app, with Google or a code by email. Every app that uses it knows you, and opening the next one needs no second sign-in."
          >
            <a
              href="/sign-up?return=%2F"
              className="relative touch-target-y mt-4 inline-flex w-fit items-center gap-1 font-semibold text-slate-900 underline-offset-4 hover:underline dark:text-white"
            >
              Create your account <span aria-hidden>→</span>
            </a>
          </Tile>
          <Tile
            art={<LiveArt />}
            title="Live by default"
            body="Everyone in a document sees each change as it happens, with a cursor for every person in it."
          />
          <Tile
            art={<ShareArt />}
            title="Share by link"
            body="One link opens the work in any browser, on a laptop, tablet or phone. Choose who can view, and who can edit."
          />
          <Tile
            className="sm:col-span-2 lg:col-span-3"
            side={<ExplorerArt />}
            title="One Explorer for everything"
            body="Every diagram, plan, document and design you make is in one Explorer, which every app shows. One folder can hold work from all of them."
          />
          <Tile
            art={<InboxArt />}
            title="One Inbox"
            body="Comments, mentions and actions assigned to you, from every app, in one list. Open one and you land on the thing it is about."
          />
          <Tile
            art={<TeamsArt />}
            title="Teams across every app"
            body="Make a team once and invite people once. Its members share the team's work in every app."
          />
          <Tile
            art={<KeyArt />}
            title="One key for scripts and AI"
            body="An API token works in every app, from a script, the command line or a connected AI tool. Revoke it once and it stops everywhere."
          />
          <Tile
            art={<DataArt />}
            title="Open about data"
            body="No third-party trackers, no ads. The anonymous numbers we do count are public."
          >
            <a
              href="/telemetry"
              className="relative touch-target-y mt-4 inline-flex w-fit items-center gap-1 text-sm font-semibold text-slate-900 underline-offset-4 hover:underline dark:text-white"
            >
              See exactly what we measure <span aria-hidden>→</span>
            </a>
          </Tile>
          <Tile
            art={<KeepArt />}
            title="Yours to keep"
            body="No password to leak. Close your account from any app, and it is gone from all of them."
          />
          <Tile
            art={<FreeArt />}
            title="Completely free"
            body="Every app, every feature, for everyone. No paywalls, no subscriptions, and you can start before you sign in."
          />
        </div>
      </div>
    </section>
  );
}

// A promise: its illustration, then its words; or, for a full-width one, the words beside it.
function Tile({
  art,
  side,
  title,
  body,
  className = '',
  children,
}: {
  art?: ReactNode;
  side?: ReactNode;
  title: string;
  body: string;
  className?: string;
  children?: ReactNode;
}) {
  const words = (
    <div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
      {children}
    </div>
  );
  return (
    <div
      className={`flex flex-col rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {side ? (
        <div className="grid items-center gap-6 p-1 lg:grid-cols-2 lg:gap-10 lg:p-2">
          {words}
          {side}
        </div>
      ) : (
        <>
          {art}
          <div className="mt-5 px-1 pb-1">{words}</div>
        </>
      )}
    </div>
  );
}

// One folder holding a piece of work from each app. Decorative.
const EXPLORER_ITEMS: Partial<Record<SiteId, { name: string; kind: string }>> = {
  'livediagram.app': { name: 'Launch flow', kind: 'Canvas' },
  'liveplanner.app': { name: 'Launch plan', kind: 'Plan' },
  'livedocuments.app': { name: 'Launch announcement', kind: 'Document' },
  'livedesign.app': { name: 'Launch logo', kind: 'Design' },
};

function ExplorerArt() {
  return (
    <div
      aria-hidden
      className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 select-none sm:p-5 dark:bg-slate-950/50 dark:ring-slate-800"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <span className="text-slate-400 dark:text-slate-500">
          <FolderIcon />
        </span>
        Launch
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {listedApps().flatMap((app) => {
          const item = EXPLORER_ITEMS[app.id];
          return item
            ? [
                <div
                  key={app.id}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.light } as CSSProperties}
                >
                  <AppMark app={app} className="size-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {item.name}
                    </span>
                    <span className="block text-xs text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">
                      {item.kind} · {app.name}
                    </span>
                  </span>
                </div>,
              ]
            : [];
        })}
      </div>
    </div>
  );
}

// One sign-in, then each app already signed in. Decorative.
function AccountArt() {
  return (
    <div
      aria-hidden
      className="flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl bg-white p-6 ring-1 ring-slate-200 select-none sm:flex-row sm:gap-6 dark:bg-slate-950/50 dark:ring-slate-800"
    >
      <div className="w-full max-w-64 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <BrandMark accentColor={PLATFORM_SITE.accent} className="size-5" />
          Sign in to liveworkspace
        </div>
        <div className="mt-4 flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <span className="size-3.5 rounded-full bg-[conic-gradient(#ea4335_0_25%,#fbbc05_0_50%,#34a853_0_75%,#4285f4_0)]" />
          Continue with Google
        </div>
        <div className="my-3 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          or
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          ada@northwind.co
        </div>
        <div className="mt-2 flex h-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
          Email me a code
        </div>
      </div>
      <svg
        viewBox="0 0 60 24"
        className="h-6 w-14 rotate-90 text-slate-300 sm:rotate-0 dark:text-slate-600"
        fill="none"
      >
        <path
          d="M2 12h50m-8-8 8 8-8 8"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lw-flow"
        />
      </svg>
      <div className="flex flex-col gap-2.5">
        {listedApps().map((app) => (
          <div
            key={app.id}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.light } as CSSProperties}
          >
            <AppMark app={app} className="size-5" />
            <span className="text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">{app.name}</span>
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Signed in
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
