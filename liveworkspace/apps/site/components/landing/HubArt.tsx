import { BrandMark } from '@livediagram/ui';
import { PLATFORM_SITE, type SiteId } from '@liveworkspace/sites';
import type { CSSProperties, ReactNode } from 'react';
import { listedApps } from '@/lib/apps';
import { AppLogo } from './AppLogo';
import { Cursor } from './Cursor';

// The hero's picture of how liveworkspace fits together (liveworkspace/docs/site.md "The front
// door"): the platform's prism at the centre and each app at a corner, joined to it by a line in the
// app's accent with a current running along it, read clockwise in the order work moves through them.
// Laid out on a 600 × 500 grid that the lines and the cards share, so it scales as one. Each app is a
// link to its site; the lines, the glow and the cursors are decoration.

type Point = { x: number; y: number };

const HUB: Point = { x: 300, y: 250 };

// Where each app sits, what it makes, and who is at work in it.
const PLACES: Partial<
  Record<
    SiteId,
    { at: Point; makes: string; glow: string; cursor: { name: string; colour: string; at: string } }
  >
> = {
  'livediagram.app': {
    at: { x: 140, y: 108 },
    makes: 'Diagrams · whiteboards · mind maps',
    glow: 'top-[2%] left-[0%] bg-sky-400/25 dark:bg-sky-500/20',
    cursor: { name: 'Ada', colour: '#0284c7', at: 'top-[32%] left-[18%]' },
  },
  'liveplanner.app': {
    at: { x: 460, y: 108 },
    makes: 'Boards · sheets · forms',
    glow: 'top-[2%] right-[0%] bg-violet-400/25 dark:bg-violet-500/20',
    cursor: { name: 'Sam', colour: '#7c3aed', at: 'top-[30%] left-[70%]' },
  },
  'livedocuments.app': {
    at: { x: 460, y: 392 },
    makes: 'Articles · slides · infographics',
    glow: 'right-[0%] bottom-[2%] bg-amber-400/25 dark:bg-amber-500/15',
    cursor: { name: 'Lena', colour: '#b45309', at: 'top-[63%] left-[62%]' },
  },
  'livedesign.app': {
    at: { x: 140, y: 392 },
    makes: 'Logos · wireframes · photos',
    glow: 'bottom-[2%] left-[0%] bg-rose-400/25 dark:bg-rose-500/15',
    cursor: { name: 'Kai', colour: '#be123c', at: 'top-[64%] left-[22%]' },
  },
};

const at = ({ x, y }: Point) => ({
  left: `${(x / 600) * 100}%`,
  top: `${(y / 500) * 100}%`,
});

function curve(from: Point, to: Point) {
  const mx = (from.x + to.x) / 2;
  return `M${from.x} ${from.y} C${mx} ${from.y} ${mx} ${to.y} ${to.x} ${to.y}`;
}

// Each app's card, a link to its site. It lifts a little and rings in the app's accent (`--lw-accent`)
// on hover, and stops floating while pointed at or focused (landing-motion.css), so it holds still
// under the pointer.
const CARD =
  'lw-float group absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur-md transition-[scale,box-shadow] max-sm:px-2.5 max-sm:py-2 duration-micro ease-out hover:scale-[1.04] hover:shadow-2xl hover:ring-2 hover:ring-[var(--lw-accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--lw-accent)] motion-reduce:hover:scale-100 dark:border-slate-700/80 dark:bg-slate-900/85 dark:shadow-black/40';

export function HubArt() {
  const apps = listedApps().flatMap((app) => {
    const place = PLACES[app.id];
    return place ? [{ app, place }] : [];
  });
  return (
    <nav
      aria-label="The apps"
      className="relative mx-auto aspect-[6/5] w-full max-w-xl select-none"
    >
      {apps.map(({ app, place }) => (
        <div
          key={app.id}
          aria-hidden
          className={`absolute size-[42%] rounded-full blur-3xl ${place.glow}`}
        />
      ))}

      <svg
        aria-hidden
        viewBox="0 0 600 500"
        className="absolute inset-0 size-full overflow-visible"
        fill="none"
      >
        <defs>
          <radialGradient id="lw-hub-grid-fade">
            <stop offset="40%" stopColor="white" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="lw-hub-grid-mask">
            <rect width="600" height="500" fill="url(#lw-hub-grid-fade)" />
          </mask>
          <pattern id="lw-hub-dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" className="fill-slate-300 dark:fill-slate-700" />
          </pattern>
        </defs>
        <rect width="600" height="500" fill="url(#lw-hub-dots)" mask="url(#lw-hub-grid-mask)" />
        {/* Each app's line: a faint rail, and the current along it. */}
        {apps.map(({ app, place }) => (
          <g key={app.id}>
            <path d={curve(place.at, HUB)} stroke={app.accent} strokeWidth="3" opacity="0.25" />
            <path
              d={curve(place.at, HUB)}
              stroke={app.accent}
              strokeWidth="3"
              strokeLinecap="round"
              className="lw-flow"
            />
          </g>
        ))}
      </svg>

      {/* The hub. */}
      <div aria-hidden className="absolute -translate-x-1/2 -translate-y-1/2" style={at(HUB)}>
        <span className="lw-ping absolute inset-0 rounded-full border-2 border-slate-400/50 dark:border-slate-500/60" />
        <span className="relative flex size-32 items-center justify-center rounded-full border border-white/80 bg-gradient-to-b from-white to-slate-100 shadow-2xl shadow-slate-900/20 sm:size-36 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900 dark:shadow-black/50">
          <BrandMark
            variant="full"
            accentColor={PLATFORM_SITE.accent}
            className="size-20 sm:size-24"
          />
        </span>
      </div>

      {/* The apps, by their own logos, each opening its site. */}
      {apps.map(({ app, place }, i) => (
        <a
          key={app.id}
          href={app.url}
          aria-label={`Open ${app.id}`}
          className={CARD}
          style={
            {
              ...at(place.at),
              '--lw-accent': app.accent,
              animationDelay: `${-i * 1.5}s`,
            } as CSSProperties
          }
        >
          {/* A phone has room for the small logo alone. */}
          <span className="sm:hidden">
            <AppLogo app={app} size="sm" />
          </span>
          <span className="max-sm:hidden">
            <AppLogo app={app} size="md" />
            <Caption>{place.makes}</Caption>
          </span>
        </a>
      ))}

      {/* People at work in each app. */}
      {apps.map(({ app, place }, i) => (
        <Cursor
          key={app.id}
          name={place.cursor.name}
          colour={place.cursor.colour}
          className={`${i % 2 ? 'lw-drift-b' : 'lw-drift-a'} absolute ${place.cursor.at}`}
        />
      ))}
    </nav>
  );
}

// Under an app's logo: what it makes, and an arrow that comes in on hover.
function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
      {children}
      <span
        aria-hidden
        className="-translate-x-1 opacity-0 transition-[opacity,translate] duration-micro ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
      >
        →
      </span>
    </p>
  );
}
