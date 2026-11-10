import { BrandMark } from '@livediagram/ui';
import { PLATFORM_SITE, type SiteId } from '@liveworkspace/sites';
import type { CSSProperties, ReactNode } from 'react';
import { listedApps } from '@/lib/apps';
import { AppLogo } from './AppLogo';
import { HeldBy } from './AppWindow';
import { Character } from './Character';
import { Cursor } from './Cursor';

// The hero's picture of how liveworkspace fits together (liveworkspace/docs/specs/010-site/site.md "The front
// door"): the platform's prism at the centre and the apps round it at the points of a pentagon, each joined to it by
// a line in the app's accent with a current running along it, read clockwise in the order work moves through them.
// Laid out on a 600 × 500 grid that the lines and the cards share, so it scales as one. Each app is a
// link to its site; the lines, the glow and the people at work are decoration.

type Point = { x: number; y: number };

const HUB: Point = { x: 300, y: 250 };

// Someone at work in an app, drawn as that app shows them: a cursor on a canvas, a ring and name on the card they
// hold on a liveplanner board (which draws no cursors), a character walking a livehuddle Space.
type Worker = { name: string; colour: string; at: string; shows: 'cursor' | 'card' | 'character' };

// Where each app sits, what it makes, and who is at work in it. `glow` places the soft wash of the app's colour
// behind its corner: a box twice the old blurred disc's size, centred where that disc was, that GLOW fades out.
const PLACES: Partial<Record<SiteId, { at: Point; makes: string; glow: string; worker: Worker }>> =
  {
    'livediagram.app': {
      at: { x: 300, y: 62 },
      makes: 'Diagrams · whiteboards · mind maps',
      glow: 'top-[-27%] left-[8%] from-sky-400/22 dark:from-sky-500/17',
      worker: { name: 'Ada', colour: '#0369a1', at: 'top-[20%] left-[56%]', shows: 'cursor' },
    },
    'liveplanner.app': {
      at: { x: 506, y: 200 },
      makes: 'Boards · sheets · forms',
      glow: 'top-[-3%] right-[-25%] from-violet-400/22 dark:from-violet-500/17',
      worker: { name: 'Sam', colour: '#7c3aed', at: 'top-[55%] left-[77%]', shows: 'card' },
    },
    'livedocuments.app': {
      at: { x: 430, y: 420 },
      makes: 'Articles · slides · infographics',
      glow: 'right-[-17%] bottom-[-25%] from-amber-400/22 dark:from-amber-500/13',
      worker: { name: 'Lena', colour: '#b45309', at: 'top-[66%] left-[60%]', shows: 'cursor' },
    },
    'livedesign.app': {
      at: { x: 170, y: 420 },
      makes: 'Logos · wireframes · photos',
      glow: 'bottom-[-25%] left-[-17%] from-rose-400/22 dark:from-rose-500/13',
      worker: { name: 'Kai', colour: '#be123c', at: 'top-[66%] left-[22%]', shows: 'cursor' },
    },
    'livehuddle.app': {
      at: { x: 94, y: 200 },
      makes: 'Spaces · rooms · calls',
      glow: 'top-[-3%] left-[-25%] from-emerald-400/22 dark:from-emerald-500/17',
      worker: { name: 'Ana', colour: '#047857', at: 'top-[52%] left-[12%]', shows: 'character' },
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
// under the pointer. Near-opaque rather than frosted: nothing over the art takes a `backdrop-filter`, whose layers
// re-sample the art when iPad Safari repaints under a touch (site.md "The front door", Paint).
const CARD =
  'lw-float group absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 transition-[scale,box-shadow] max-sm:px-2.5 max-sm:py-2 duration-micro ease-out hover:scale-[1.04] hover:shadow-2xl hover:ring-2 hover:ring-[var(--lw-accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--lw-accent)] motion-reduce:hover:scale-100 dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-black/40';

// Each app's glow: a radial gradient from its colour to nothing at the box's edge. Never a `filter` blur: iPad Safari
// re-rasterises a large blur in tiles when it repaints under a touch (a long press, a press-and-drag scroll), and
// its colours broke there (liveworkspace/docs/specs/010-site/site.md "The front door", Paint). A gradient paints the
// same in every layer, and costs a fill rather than a 64px blur.
const GLOW = 'pointer-events-none absolute size-[84%] bg-radial-[closest-side] to-transparent';

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
        <div key={app.id} aria-hidden data-hero-glow className={`${GLOW} ${place.glow}`} />
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
      {apps.map(({ app, place }, i) => {
        const { worker } = place;
        const motion = `${i % 2 ? 'lw-drift-b' : 'lw-drift-a'} absolute ${worker.at}`;
        if (worker.shows === 'card') {
          return (
            <span
              key={app.id}
              aria-hidden
              className={`${motion} flex w-[14%] rotate-3 flex-col gap-1 rounded-md bg-white p-1.5 shadow-lg ring-2 ring-violet-600 dark:bg-slate-900 dark:ring-violet-400`}
            >
              <HeldBy name={worker.name} />
              <span className="h-1 w-4/5 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="h-1 w-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
            </span>
          );
        }
        if (worker.shows === 'character') {
          return (
            <Character
              key={app.id}
              name={worker.name}
              look={{ shirt: worker.colour, hair: '#78350f', skin: '#f5d0b0', long: true }}
              className={`${motion} w-[4%]`}
            />
          );
        }
        return <Cursor key={app.id} name={worker.name} colour={worker.colour} className={motion} />;
      })}
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
