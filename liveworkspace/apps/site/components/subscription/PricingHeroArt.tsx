// The pricing hero's art (liveworkspace/docs/specs/019-subscription/subscription.md "The pricing page"): three tiers
// rising, each a step up from the last. Free holds every app's tile, so every app is free; Pro's meters climb; Pro
// for Teams holds a team, its meter pooled. A dashed line climbs over their tops. Static and decorative (PageHero hides
// it from assistive technology), drawn in the site's own slate with each app's hue, light and dark.

const CARD = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
const LINE = 'fill-slate-200 dark:fill-slate-700';
const SOFT = 'fill-slate-100 dark:fill-slate-800';
const LABEL = 'fill-slate-900 text-[13px] font-semibold dark:fill-slate-100';

// Every app's hue, in the order the site lists them.
const APPS = [
  'fill-sky-500',
  'fill-violet-500',
  'fill-amber-500',
  'fill-rose-500',
  'fill-emerald-500',
  'fill-lime-500',
] as const;

// A tier's card: its name, a rule under it, and what it holds.
function Card({
  x,
  y,
  height,
  name,
  strong = false,
  children,
}: {
  x: number;
  y: number;
  height: number;
  name: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <g>
      {/* The card's shadow, a step below it. */}
      <rect x={x + 4} y={y + 6} width="112" height={height} rx="14" className={SOFT} />
      <rect
        x={x}
        y={y}
        width="112"
        height={height}
        rx="14"
        strokeWidth={strong ? 2 : 1.5}
        className={
          strong ? 'fill-white stroke-slate-900 dark:fill-slate-900 dark:stroke-slate-100' : CARD
        }
      />
      <text x={x + 14} y={y + 26} className={LABEL}>
        {name}
      </text>
      <rect x={x + 14} y={y + 36} width="84" height="2" rx="1" className={LINE} />
      {children}
    </g>
  );
}

// A meter: its track, and how far it has come.
function Meter({ x, y, filled, fill }: { x: number; y: number; filled: number; fill: string }) {
  return (
    <g>
      <rect x={x} y={y} width="84" height="7" rx="3.5" className={SOFT} />
      <rect x={x} y={y} width={84 * filled} height="7" rx="3.5" className={fill} />
    </g>
  );
}

// A person on a disc, for the team.
function Person({ cx, cy, fill }: { cx: number; cy: number; fill: string }) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r="13"
        strokeWidth="2.5"
        className={`${fill} stroke-white dark:stroke-slate-900`}
      />
      <circle cx={cx} cy={cy - 3.5} r="4" className="fill-white/90" />
      <path d={`M${cx - 7} ${cy + 8.5}a7 6 0 0 1 14 0Z`} className="fill-white/90" />
    </g>
  );
}

export function PricingHeroArt() {
  return (
    <svg
      viewBox="0 0 420 320"
      className="h-auto w-full overflow-visible"
      focusable="false"
      data-pricing-hero-art=""
    >
      <defs>
        <pattern id="pricing-hero-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" className="fill-slate-300/70 dark:fill-slate-600/60" />
        </pattern>
        <radialGradient id="pricing-hero-fade" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="pricing-hero-mask">
          <rect width="420" height="320" fill="url(#pricing-hero-fade)" />
        </mask>
      </defs>
      {/* The dotted ground the tiers stand on, fading to the edges. */}
      <rect
        width="420"
        height="320"
        fill="url(#pricing-hero-dots)"
        mask="url(#pricing-hero-mask)"
      />
      <rect x="10" y="292" width="400" height="2" rx="1" className={LINE} />

      {/* The climb over the tiers' tops. */}
      <path
        d="M70 150C120 128 150 96 200 88S300 46 350 24"
        fill="none"
        strokeWidth="2"
        strokeDasharray="3 6"
        strokeLinecap="round"
        className="stroke-slate-400 dark:stroke-slate-500"
      />
      <path
        d="M340 20l12 3-7 10"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-slate-400 dark:stroke-slate-500"
      />

      {/* Free: every app's tile, every app free. */}
      <Card x={14} y={170} height={116} name="Free">
        {APPS.map((fill, i) => (
          <rect
            key={fill}
            x={28 + (i % 3) * 28}
            y={222 + Math.floor(i / 3) * 28}
            width="20"
            height="20"
            rx="6"
            className={fill}
          />
        ))}
      </Card>

      {/* Pro: the meters climb. */}
      <Card x={152} y={112} height={174} name="Pro" strong>
        <rect
          x={244}
          y={98}
          width="40"
          height="22"
          rx="11"
          className="fill-slate-900 dark:fill-slate-100"
        />
        <path
          d="M264 102.5l1.6 3.7 3.9.4-2.9 2.6.8 3.9-3.4-2-3.4 2 .8-3.9-2.9-2.6 3.9-.4Z"
          className="fill-white dark:fill-slate-900"
        />
        <Meter x={166} y={168} filled={0.45} fill="fill-sky-500" />
        <Meter x={166} y={190} filled={0.68} fill="fill-violet-500" />
        <Meter x={166} y={212} filled={0.9} fill="fill-amber-500" />
        <rect x={166} y={238} width="58" height="5" rx="2.5" className={LINE} />
        <rect x={166} y={252} width="40" height="5" rx="2.5" className={LINE} />
      </Card>

      {/* Pro for Teams: a team, its meter pooled. */}
      <Card x={290} y={54} height={232} name="Teams">
        <Person cx={318} cy={124} fill="fill-emerald-500" />
        <Person cx={340} cy={124} fill="fill-rose-500" />
        <Person cx={362} cy={124} fill="fill-sky-500" />
        <Meter x={304} y={164} filled={0.55} fill="fill-emerald-500" />
        <rect x={304} y={186} width="70" height="5" rx="2.5" className={LINE} />
        <rect x={304} y={200} width="52" height="5" rx="2.5" className={LINE} />
        <rect x={304} y={226} width="84" height="40" rx="9" className={SOFT} />
        {APPS.slice(0, 4).map((fill, i) => (
          <rect
            key={fill}
            x={314 + i * 17}
            y={239}
            width="13"
            height="13"
            rx="4"
            className={fill}
          />
        ))}
      </Card>
    </svg>
  );
}
