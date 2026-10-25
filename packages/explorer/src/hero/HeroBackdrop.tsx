// Home's hero backdrop: what tells the apps apart behind the same words, pills, search and tiles
// (liveworkspace/docs/one-explorer.md "Each app's backdrop, on Home's hero"). It follows the app the list is filtered
// to; All Apps keeps the dots. Static SVG and CSS in the host's brand ramp: no motion, nothing fetched.

import { useId } from 'react';
import type { App } from '@liveworkspace/index-client';
import type { AppFilter } from '../words';

export type HeroBackdropKind = 'dots' | 'lanes' | 'blueprint' | 'typesetter' | 'shapes';

const BY_APP: Record<App, HeroBackdropKind> = {
  liveplanner: 'lanes',
  livediagram: 'blueprint',
  livedocuments: 'typesetter',
  livedesign: 'shapes',
};

export function heroBackdropOf(app: App, filter: AppFilter): HeroBackdropKind {
  return filter === 'all' ? 'dots' : BY_APP[app];
}

/** The heading's face: the Typesetter sets it in the system's serif, the others in the page's own. */
export function heroHeadingFace(backdrop: HeroBackdropKind): string {
  return backdrop === 'typesetter'
    ? 'font-serif font-semibold tracking-[-0.02em]'
    : 'font-extrabold tracking-[-0.04em]';
}

const LAYER = 'pointer-events-none absolute inset-0';
// The gap pieces are drawn in the hero's own pixels at `xl`, where its max-w-7xl row is 1280 wide: the words end by
// 792 (24 + the heading's 48rem), the tiles start at 920.
const XL_ART = 'absolute left-0 top-0 hidden h-[420px] w-[1280px] overflow-visible xl:block';

export function HeroBackdrop({ kind }: { kind: HeroBackdropKind }) {
  const id = useId();
  if (kind === 'blueprint') return <Blueprint id={id} />;
  if (kind === 'typesetter') return <Typesetter />;
  if (kind === 'shapes') return <Shapes />;
  if (kind === 'lanes') return <Lanes />;
  return <Dots />;
}

function Dots() {
  return (
    <div
      aria-hidden
      data-hero-backdrop="dots"
      className={`${LAYER} bg-brand-50/70 bg-[radial-gradient(var(--color-brand-200)_1px,transparent_1px)] bg-[length:22px_22px] dark:bg-slate-900 dark:bg-[radial-gradient(color-mix(in_oklab,var(--color-brand-800)_45%,var(--color-slate-900))_1px,transparent_1px)]`}
    >
      <span className="absolute left-1/2 top-[-260px] hidden h-[520px] w-[900px] -translate-x-1/3 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-brand-600)_30%,transparent),transparent)] dark:block" />
    </div>
  );
}

const LANES = ['To do · 4', 'Doing · 2/3', 'Review · 1', 'Done · 12'];

function Lanes() {
  return (
    <div
      aria-hidden
      data-hero-backdrop="lanes"
      className={`${LAYER} bg-[color:color-mix(in_oklab,var(--color-brand-50)_60%,white)] dark:bg-slate-900`}
    >
      <div className="absolute inset-1.5 flex gap-3">
        {LANES.map((lane, i) => (
          <div
            key={lane}
            className={`relative min-w-0 flex-1 rounded-[14px] ${i % 2 ? 'bg-brand-100/60 dark:bg-brand-900/30' : 'bg-brand-100/35 dark:bg-brand-900/15'}`}
          >
            <span className="absolute bottom-3 left-3.5 hidden font-mono text-[11px] uppercase tracking-[0.13em] text-brand-600 md:block dark:text-brand-400">
              {lane}
            </span>
          </div>
        ))}
      </div>
      <div className="relative mx-auto h-full max-w-7xl">
        <svg className={XL_ART}>
          {/* The slot the card will drop into, then the card itself, tilted mid-drag. */}
          <rect
            x="812"
            y="186"
            width="96"
            height="62"
            rx="10"
            fill="none"
            strokeWidth="2"
            strokeDasharray="6 5"
            className="stroke-brand-300 dark:stroke-brand-700"
          />
          <g transform="rotate(5 858 116)">
            <rect
              x="808"
              y="86"
              width="100"
              height="64"
              rx="10"
              className="fill-white stroke-brand-100 dark:fill-slate-800 dark:stroke-slate-700"
            />
            <rect x="818" y="98" width="60" height="7" rx="3.5" className="fill-brand-400" />
            <rect
              x="818"
              y="112"
              width="76"
              height="5"
              rx="2.5"
              className="fill-brand-200 dark:fill-brand-800"
            />
            <circle cx="894" cy="136" r="7" className="fill-brand-600" />
          </g>
        </svg>
      </div>
    </div>
  );
}

const BLUEPRINT_BG =
  'bg-[color:color-mix(in_oklab,var(--color-brand-50)_60%,white)] dark:bg-[color:color-mix(in_oklab,var(--color-brand-900)_45%,var(--color-slate-950))]';
const CROP =
  'absolute size-[22px] fill-none stroke-brand-300 stroke-[1.5] dark:stroke-brand-700/70';

function Blueprint({ id }: { id: string }) {
  const minor = `${id}-minor`;
  const major = `${id}-major`;
  return (
    <div aria-hidden data-hero-backdrop="blueprint" className={`${LAYER} ${BLUEPRINT_BG}`}>
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id={minor} width="24" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M24 0H0V24"
              fill="none"
              strokeWidth="0.7"
              className="stroke-brand-200/60 dark:stroke-brand-800/50"
            />
          </pattern>
          <pattern id={major} width="120" height="120" patternUnits="userSpaceOnUse">
            <rect width="120" height="120" fill={`url(#${minor})`} />
            <path
              d="M120 0H0V120"
              fill="none"
              strokeWidth="1.6"
              className="stroke-brand-200 dark:stroke-brand-800/80"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${major})`} />
      </svg>
      <svg viewBox="0 0 22 22" className={`${CROP} left-2 top-2`}>
        <path d="M0 14V0H14" />
      </svg>
      <svg viewBox="0 0 22 22" className={`${CROP} right-2 top-2`}>
        <path d="M8 0H22V14" />
      </svg>
      <svg viewBox="0 0 22 22" className={`${CROP} bottom-2 left-2`}>
        <path d="M0 8V22H14" />
      </svg>
      <svg viewBox="0 0 22 22" className={`${CROP} bottom-2 right-2`}>
        <path d="M8 22H22V8" />
      </svg>
      <div className="relative mx-auto h-full max-w-7xl">
        <svg className={XL_ART}>
          <path
            d="M862 96V324M854 96h16M854 324h16M858 106l4-10 4 10M858 314l4 10 4-10"
            fill="none"
            strokeWidth="1.2"
            className="stroke-brand-600/80 dark:stroke-brand-400/80"
          />
        </svg>
        {/* A drawing's title block, in the band's own colour so the grid stops at its edge. */}
        <div
          className={`absolute bottom-3 right-6 hidden h-[22px] w-[300px] items-center border border-brand-300 font-mono text-[10px] tracking-[0.1em] text-brand-600 lg:flex dark:border-brand-700/70 dark:text-brand-400 ${BLUEPRINT_BG}`}
        >
          <span className="flex-1 px-2.5">HOME · SHEET 1 OF 1</span>
          <span className="flex h-full w-[104px] items-center justify-end border-l border-brand-300 px-2.5 dark:border-brand-700/70">
            1:1
          </span>
        </div>
      </div>
    </div>
  );
}

function Typesetter() {
  return (
    <div
      aria-hidden
      data-hero-backdrop="typesetter"
      className={`${LAYER} bg-[color:color-mix(in_oklab,var(--color-brand-50)_45%,white)] bg-[linear-gradient(color-mix(in_oklab,var(--color-brand-200)_55%,transparent)_1px,transparent_1px)] bg-[length:100%_8px] bg-[position:0_4px] dark:bg-slate-900 dark:bg-[linear-gradient(color-mix(in_oklab,var(--color-brand-800)_35%,transparent)_1px,transparent_1px)]`}
    >
      <div className="relative mx-auto h-full max-w-7xl">
        <svg className={XL_ART}>
          <text
            x="884"
            y="372"
            textAnchor="middle"
            fontSize="380"
            className="fill-brand-200 font-serif dark:fill-brand-800/50"
          >
            ¶
          </text>
        </svg>
      </div>
    </div>
  );
}

const HANDLE = 'fill-white stroke-brand-500 dark:fill-slate-800';

function Shapes() {
  return (
    <div
      aria-hidden
      data-hero-backdrop="shapes"
      className={`${LAYER} bg-[color:color-mix(in_oklab,var(--color-brand-50)_70%,white)] dark:bg-slate-900`}
    >
      <svg viewBox="0 0 102 102" className="absolute bottom-0 left-0 hidden size-[102px] sm:block">
        <path
          d="M0 102V0A102 102 0 0 1 102 102Z"
          className="fill-brand-100 dark:fill-brand-900/50"
        />
      </svg>
      <div className="relative mx-auto h-full max-w-7xl">
        <svg
          viewBox="0 0 72 40"
          className="absolute left-[32.75rem] top-[1.375rem] hidden h-10 w-[72px] lg:block"
        >
          <path d="M36 0L72 40H0Z" className="fill-brand-300 dark:fill-brand-700/60" />
        </svg>
        <svg
          viewBox="0 0 128 128"
          className="absolute -bottom-16 right-3 hidden size-32 overflow-visible lg:block"
        >
          <circle
            cx="64"
            cy="64"
            r="58"
            fill="none"
            strokeWidth="12"
            className="stroke-brand-300 dark:stroke-brand-700/60"
          />
        </svg>
        <svg className={XL_ART}>
          <circle cx="856" cy="100" r="52" className="fill-brand-200 dark:fill-brand-800/60" />
          <rect
            x="804"
            y="48"
            width="104"
            height="104"
            fill="none"
            strokeWidth="1.5"
            className="stroke-brand-500"
          />
          {[
            [804, 48],
            [908, 48],
            [804, 152],
            [908, 152],
          ].map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              x={x! - 4}
              y={y! - 4}
              width="8"
              height="8"
              strokeWidth="1.5"
              className={HANDLE}
            />
          ))}
          <rect
            x="816"
            y="262"
            width="72"
            height="72"
            transform="rotate(20 852 298)"
            fill="none"
            strokeWidth="4"
            className="stroke-brand-300 dark:stroke-brand-700/60"
          />
          <circle cx="874" cy="386" r="9" className="fill-brand-500" />
        </svg>
      </div>
    </div>
  );
}
