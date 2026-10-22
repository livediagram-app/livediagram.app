import { BrandMark, lucideGlyph } from '@livediagram/ui';
import { BrandMark as LiveplannerMark } from '@liveplanner/ui';
import {
  lucideChartLine,
  lucideGift,
  lucideLink,
  lucideShieldCheck,
  lucideUsers,
} from '@livediagram/icons/lucide';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import type { ReactNode } from 'react';
import { Cursor } from './Cursor';

const LinkIcon = lucideGlyph(lucideLink, 20);
const UsersIcon = lucideGlyph(lucideUsers, 20);
const ShieldIcon = lucideGlyph(lucideShieldCheck, 20);
const GiftIcon = lucideGlyph(lucideGift, 20);
const ActivityIcon = lucideGlyph(lucideChartLine, 20);

const STEPS: { mark: ReactNode; app: string; colour: string; title: string; body: string }[] = [
  {
    mark: <BrandMark className="size-10" />,
    app: 'livediagram',
    colour: 'text-sky-700 dark:text-sky-300',
    title: 'Sketch the idea',
    body: 'Draw it out together on one canvas: the flow, the map, the whiteboard mess that finally makes sense.',
  },
  {
    mark: <LiveplannerMark className="size-10" />,
    app: 'liveplanner',
    colour: 'text-violet-700 dark:text-violet-300',
    title: 'Plan the work',
    body: 'Turn it into cards, owners and dates. Track it on a board, total it in a sheet, collect it with a form.',
  },
  {
    mark: <BrandMark accentColor={PLATFORM_SITE.accent} className="size-10" />,
    app: 'liveworkspace',
    colour: 'text-slate-600 dark:text-slate-300',
    title: 'Share one link',
    body: 'Anyone you send it to lands in the work itself, live, with you. Same account, whichever app it opens.',
  },
];

// How it fits together (liveworkspace/docs/site.md "The front door"): the path a piece of work takes
// across the apps, then what every app shares. The header's "How it fits" lands here.
export function Journey() {
  return (
    <section
      id="how-it-fits"
      className="scroll-mt-20 border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-sm font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
          How it fits together
        </p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          From the first sketch to the finished plan, without starting again.
        </h2>

        <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
          {/* The thread through the three steps, in each app's colour. */}
          <span
            aria-hidden
            className="absolute top-12 right-[16%] left-[16%] hidden h-0.5 rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-slate-400 md:block"
          />
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="lw-rise relative flex flex-col items-center rounded-3xl border border-slate-200 bg-slate-50/80 p-6 text-center backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/80"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                {step.mark}
              </span>
              <span
                className={`mt-5 text-xs font-semibold tracking-[.18em] uppercase ${step.colour}`}
              >
                {i + 1} · {step.app}
              </span>
              <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>
            </li>
          ))}
        </ol>

        <h3 className="mt-24 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          What every app shares
        </h3>
        <p className="mt-3 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Different apps, the same promises. Whichever one you open, this is what you get.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile
            className="sm:col-span-2 lg:row-span-2"
            icon={null}
            title="One account, every app"
            body="Sign in once at liveworkspace.app, with Google or a code by email. Every app that uses it knows you, and opening the next one needs no second sign-in."
          >
            <AccountArt />
            <a
              href="/sign-up?return=%2F"
              className="relative touch-target-y mt-6 inline-flex w-fit items-center gap-1 font-semibold text-slate-900 underline-offset-4 hover:underline dark:text-white"
            >
              Create your account <span aria-hidden>→</span>
            </a>
          </Tile>
          <Tile
            icon={<UsersIcon />}
            title="Live by default"
            body="Everyone in a document sees each change as it happens, with a cursor for every person in it."
          >
            <PeopleArt />
          </Tile>
          <Tile
            icon={<LinkIcon />}
            title="Share by link"
            body="One link opens the work in any browser, on a laptop, tablet or phone. Choose who can view, and who can edit."
          />
          <Tile
            icon={<ActivityIcon />}
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
            icon={<ShieldIcon />}
            title="Yours to keep"
            body="No password to leak. Close your account from any app, and it is gone from all of them."
          />
          <Tile
            icon={<GiftIcon />}
            title="Completely free"
            body="Every app, every feature, for everyone. No paywalls, no subscriptions, and you can start before you sign in."
          />
        </div>
      </div>
    </section>
  );
}

function Tile({
  icon,
  title,
  body,
  className = '',
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {icon ? (
        <span className="flex size-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
          {icon}
        </span>
      ) : null}
      <h4 className={`${icon ? 'mt-4' : ''} text-lg font-semibold text-slate-900 dark:text-white`}>
        {title}
      </h4>
      <p className="mt-1.5 leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
      {children}
    </div>
  );
}

// One sign-in, then each app already signed in. Decorative.
function AccountArt() {
  return (
    <div
      aria-hidden
      className="mt-8 flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl bg-white p-6 ring-1 ring-slate-200 select-none sm:flex-row sm:gap-6 dark:bg-slate-950/50 dark:ring-slate-800"
    >
      <div className="w-full max-w-56 rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <BrandMark accentColor={PLATFORM_SITE.accent} className="size-5" />
          Sign in
        </div>
        <div className="mt-3 h-8 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800" />
        <div className="mt-2 h-8 rounded-lg bg-slate-900 dark:bg-white" />
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
        {[
          {
            mark: <BrandMark className="size-5" />,
            name: 'livediagram',
            ink: 'text-sky-700 dark:text-sky-300',
          },
          {
            mark: <LiveplannerMark className="size-5" />,
            name: 'liveplanner',
            ink: 'text-violet-700 dark:text-violet-300',
          },
        ].map((app) => (
          <div
            key={app.name}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {app.mark}
            <span className={app.ink}>{app.name}</span>
            <span className="ml-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Signed in
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A few people in one document. Decorative.
function PeopleArt() {
  return (
    <div
      aria-hidden
      className="relative mt-5 h-20 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 select-none dark:bg-slate-950/50 dark:ring-slate-800"
    >
      <div className="absolute top-3 left-3 flex -space-x-2">
        {['bg-sky-500', 'bg-violet-500', 'bg-amber-400', 'bg-emerald-500'].map((c) => (
          <span
            key={c}
            className={`size-7 rounded-full ring-2 ring-white dark:ring-slate-900 ${c}`}
          />
        ))}
      </div>
      <Cursor name="Ada" colour="#0284c7" className="lw-drift-a absolute top-8 left-[45%]" />
      <Cursor name="Sam" colour="#7c3aed" className="lw-drift-b absolute top-2 left-[70%]" />
    </div>
  );
}
