import { Brand as LivediagramBrand, BrandMark, lucideGlyph } from '@livediagram/ui';
import { Brand as LiveplannerBrand } from '@liveplanner/ui';
import { lucideChartLine, lucideLock } from '@livediagram/icons/lucide';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { UPCOMING_APPS } from '@/lib/apps';
import { Cursor } from './Cursor';

const ChartIcon = lucideGlyph(lucideChartLine, 14);
const LockIcon = lucideGlyph(lucideLock, 14);

// The hero's picture of how liveworkspace fits together (liveworkspace/docs/site.md "The front
// door"): the platform's prism at the centre, each live app joined to it by a line in its accent with
// a current running along it, the apps on their way on dashed lines, and what every app shares (the
// one sign-in, the open numbers) on dotted lines of its own. Laid out on a 600 × 500 grid that the lines and the cards share, so it scales as one.
// Decorative: the words beside it say all of this.

const HUB = { x: 300, y: 250 };
const NODES = {
  diagram: { x: 140, y: 112 },
  planner: { x: 462, y: 392 },
  documents: { x: 478, y: 104 },
  design: { x: 124, y: 400 },
  account: { x: 300, y: 474 },
  numbers: { x: 300, y: 28 },
};

const at = ({ x, y }: { x: number; y: number }) => ({
  left: `${(x / 600) * 100}%`,
  top: `${(y / 500) * 100}%`,
});

function curve(from: { x: number; y: number }, to: { x: number; y: number }) {
  const mx = (from.x + to.x) / 2;
  return `M${from.x} ${from.y} C${mx} ${from.y} ${mx} ${to.y} ${to.x} ${to.y}`;
}

const CARD =
  'absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/70 bg-white/85 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/85 dark:shadow-black/40';
const CHIP =
  'absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200';

// The apps on their way, by name, at the two free corners.
const SOON = UPCOMING_APPS.map((app, i) => ({
  app,
  node: i === 0 ? NODES.documents : NODES.design,
}));

export function HubArt() {
  return (
    <div aria-hidden className="relative mx-auto aspect-[6/5] w-full max-w-xl select-none">
      {/* Each app's light, behind its corner. */}
      <div className="absolute top-[4%] left-[2%] size-[46%] rounded-full bg-sky-400/25 blur-3xl dark:bg-sky-500/20" />
      <div className="absolute right-[2%] bottom-[4%] size-[46%] rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-500/20" />

      <svg
        viewBox="0 0 600 500"
        className="absolute inset-0 size-full overflow-visible"
        fill="none"
      >
        <defs>
          <linearGradient id="lw-hub-diagram" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="lw-hub-planner" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
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

        {/* The apps' lines: a solid rail, and the current along it. */}
        <path
          d={curve(NODES.diagram, HUB)}
          stroke="url(#lw-hub-diagram)"
          strokeWidth="3"
          opacity="0.35"
        />
        <path
          d={curve(NODES.diagram, HUB)}
          stroke="#0ea5e9"
          strokeWidth="3"
          strokeLinecap="round"
          className="lw-flow"
        />
        <path
          d={curve(HUB, NODES.planner)}
          stroke="url(#lw-hub-planner)"
          strokeWidth="3"
          opacity="0.35"
        />
        <path
          d={curve(HUB, NODES.planner)}
          stroke="#8b5cf6"
          strokeWidth="3"
          strokeLinecap="round"
          className="lw-flow"
        />
        {/* The apps on their way: dashed, in their accents. */}
        {SOON.map(({ app, node }) => (
          <path
            key={app.name}
            d={curve(node, HUB)}
            stroke={app.accent}
            strokeWidth="2"
            strokeDasharray="4 7"
            strokeLinecap="round"
            opacity="0.7"
          />
        ))}
        {/* What they share: quieter, dotted. */}
        <path
          d={curve(HUB, NODES.account)}
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="2"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
        <path
          d={curve(HUB, NODES.numbers)}
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="2"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
      </svg>

      {/* The hub. */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={at(HUB)}>
        <span className="lw-ping absolute inset-0 rounded-full border-2 border-slate-400/50 dark:border-slate-500/60" />
        <span className="relative flex size-32 items-center justify-center rounded-full border border-white/80 bg-gradient-to-b from-white to-slate-100 shadow-2xl shadow-slate-900/20 sm:size-36 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900 dark:shadow-black/50">
          <BrandMark
            variant="full"
            accentColor={PLATFORM_SITE.accent}
            className="size-20 sm:size-24"
          />
        </span>
      </div>

      {/* The apps, by their own logos. */}
      <div className={`${CARD} lw-float px-4 py-3`} style={at(NODES.diagram)}>
        <LivediagramBrand size="md" />
        <p className="mt-1.5 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
          Diagrams · whiteboards · pages
        </p>
      </div>
      <div className={`${CARD} lw-float px-4 py-3 [animation-delay:-3s]`} style={at(NODES.planner)}>
        <LiveplannerBrand size="md" />
        <p className="mt-1.5 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
          Boards · sheets · forms
        </p>
      </div>

      {SOON.map(({ app, node }) => (
        <div
          key={app.name}
          className={`${CARD} flex items-center gap-2 px-3 py-2 opacity-90`}
          style={at(node)}
        >
          <BrandMark accentColor={app.accent} className="size-5 shrink-0" />
          <span className="text-sm font-semibold whitespace-nowrap text-slate-900 dark:text-slate-100">
            {app.name}
          </span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Soon
          </span>
        </div>
      ))}

      <span className={CHIP} style={at(NODES.account)}>
        <LockIcon />
        One sign-in
      </span>
      <span className={CHIP} style={at(NODES.numbers)}>
        <ChartIcon />
        Open numbers
      </span>

      {/* People at work in each app. */}
      <Cursor name="Ada" colour="#0284c7" className="lw-drift-a absolute top-[34%] left-[16%]" />
      <Cursor name="Sam" colour="#7c3aed" className="lw-drift-b absolute top-[62%] left-[66%]" />
    </div>
  );
}
