import { useId } from 'react';
import { SceneCursor } from './AppWindow';

// livedesign's work (liveworkspace/docs/specs/010-site/site.md "The front door"): a brand for Northwind on
// artboards. The layers down the left with the logo's mark selected; on the canvas the logo with that mark's
// selection and size, the home page designed in the brand, the palette, and a photo Kai is cropping; and the
// inspector on the right with the mark's position, size, fill and export. Drawn in the screen's `em` (AppWindow),
// so it scales as a picture. Decorative.

const ARTBOARD =
  'absolute bg-white shadow-[0_1px_2px_rgb(15_23_42/0.08),0_6px_16px_-6px_rgb(15_23_42/0.18)] dark:bg-slate-900';
const BOARD_LABEL =
  'absolute -top-[1.6em] left-0 text-[0.9em] font-medium text-slate-500 dark:text-slate-400';

// Northwind's mark: a rose tile with two wind strokes, as the logo artboard draws it.
function Mark({ className }: { className: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#be123c" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      <path
        d="M11 20c6-6 13-6 17-1s9 4 10 0M11 30c6-5 12-5 16-1s9 4 10 0"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The photo: a lake under mountains at dusk.
function Photo() {
  const id = useId();
  return (
    <svg viewBox="0 0 130 170" preserveAspectRatio="xMidYMid slice" className="size-full">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="0.45" stopColor="#c026d3" />
          <stop offset="0.75" stopColor="#fb923c" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f97316" stopOpacity="0.7" />
          <stop offset="1" stopColor="#1e1b4b" />
        </linearGradient>
      </defs>
      <rect width="130" height="110" fill={`url(#${id}s)`} />
      <circle cx="84" cy="84" r="13" fill="#fef3c7" opacity="0.95" />
      <path d="M0 88 26 58l18 18 22-30 26 32 16-12 22 22v22H0z" fill="#4c1d95" opacity="0.75" />
      <path d="M0 100 20 84l22 12 26-20 30 22 14-8 18 10v10H0z" fill="#1e1b4b" />
      <rect y="110" width="130" height="60" fill={`url(#${id}l)`} />
      <path
        d="M70 118h28M62 126h40M74 134h20"
        stroke="#fde68a"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

const LAYERS: {
  name: string;
  depth: number;
  kind: 'frame' | 'text' | 'shape' | 'image';
  on?: boolean;
}[] = [
  { name: 'Logo', depth: 0, kind: 'frame' },
  { name: 'northwind', depth: 1, kind: 'text' },
  { name: 'Mark', depth: 1, kind: 'shape', on: true },
  { name: 'Home · Desktop', depth: 0, kind: 'frame' },
  { name: 'Hero', depth: 1, kind: 'image' },
  { name: 'Get started', depth: 1, kind: 'shape' },
  { name: 'Palette', depth: 0, kind: 'frame' },
  { name: 'Photo', depth: 0, kind: 'frame' },
];

const LAYER_GLYPH = {
  frame: 'M4.5 2v12M11.5 2v12M2 4.5h12M2 11.5h12',
  text: 'M3 3.5h10M8 3.5v9',
  shape: 'M3 3h10v10H3z',
  image: 'M2.5 3h11v10h-11zM2.5 11l3.5-3.5 3 3 2-2 2.5 2.5',
};

const PALETTE = [
  ['#be123c', 'Rose 700'],
  ['#fb7185', 'Rose 400'],
  ['#1e1b4b', 'Night'],
  ['#fde68a', 'Dawn'],
  ['#f8fafc', 'Cloud'],
];

// A field in the inspector: its label and value in a quiet box.
function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex h-[2.3em] items-center gap-[0.5em] rounded-[0.5em] bg-slate-100 px-[0.6em] dark:bg-slate-800">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-800 dark:text-slate-100">{value}</span>
    </span>
  );
}

export function DesignScene() {
  return (
    <div className="relative grid aspect-[16/10] grid-cols-[11.5em_1fr_12.5em] overflow-hidden text-[1em]">
      {/* Layers. */}
      <div className="flex flex-col gap-[0.15em] border-r border-slate-200 bg-white px-[0.8em] py-[1.1em] dark:border-slate-800 dark:bg-slate-900">
        <span className="mb-[0.5em] px-[0.5em] text-[0.85em] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          Layers
        </span>
        {LAYERS.map((l) => (
          <span
            key={l.name}
            className={`flex h-[2.2em] items-center gap-[0.5em] rounded-[0.5em] px-[0.5em] text-[0.95em] ${l.on ? 'bg-rose-100 font-medium text-rose-900 dark:bg-rose-500/20 dark:text-rose-100' : 'text-slate-700 dark:text-slate-300'}`}
            style={{ paddingLeft: `${0.5 + l.depth * 1.2}em` }}
          >
            <svg
              viewBox="0 0 16 16"
              className="size-[1.1em] shrink-0 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d={LAYER_GLYPH[l.kind]} />
            </svg>
            <span className="truncate">{l.name}</span>
          </span>
        ))}
      </div>

      {/* The canvas and its artboards. */}
      <div className="relative bg-slate-100 bg-[radial-gradient(circle,rgb(148_163_184/0.4)_1px,transparent_1.3px)] [background-size:2em_2em] dark:bg-slate-950 dark:bg-[radial-gradient(circle,rgb(71_85_105/0.6)_1px,transparent_1.3px)]">
        {/* Logo, its mark selected. */}
        <div
          className={`${ARTBOARD} top-[3em] left-[1.8em] flex size-[12.5em] flex-col items-center justify-center gap-[0.8em]`}
        >
          <span className={BOARD_LABEL}>Logo</span>
          <span className="relative">
            <Mark className="size-[5em]" />
            <span className="absolute -inset-[0.3em] border-[0.12em] border-rose-500">
              {[
                '-top-[0.35em] -left-[0.35em]',
                '-top-[0.35em] -right-[0.35em]',
                '-bottom-[0.35em] -left-[0.35em]',
                '-bottom-[0.35em] -right-[0.35em]',
              ].map((at) => (
                <span
                  key={at}
                  className={`absolute size-[0.6em] border-[0.12em] border-rose-500 bg-white ${at}`}
                />
              ))}
            </span>
            <span className="absolute -bottom-[2.1em] left-1/2 -translate-x-1/2 rounded-[0.3em] bg-rose-500 px-[0.4em] py-[0.1em] text-[0.8em] whitespace-nowrap text-white">
              64 × 64
            </span>
          </span>
          <span className="mt-[1.2em] text-[1.6em] font-bold tracking-tight text-slate-900 dark:text-white">
            northwind
          </span>
        </div>

        {/* Home page, designed in the brand. */}
        <div
          className={`${ARTBOARD} top-[3em] left-[16.3em] flex h-[15.5em] w-[20.5em] flex-col overflow-hidden`}
        >
          <span className={BOARD_LABEL}>Home · Desktop</span>
          <span className="flex items-center gap-[0.5em] px-[1em] py-[0.8em] text-[0.7em] text-slate-500 dark:text-slate-400">
            <Mark className="size-[1.6em]" />
            <span className="font-bold text-slate-900 dark:text-white">northwind</span>
            <span className="ml-auto">Routes</span>
            <span>Fares</span>
            <span className="rounded-full bg-slate-900 px-[0.8em] py-[0.3em] text-white dark:bg-white dark:text-slate-900">
              Sign in
            </span>
          </span>
          <span className="grid flex-1 grid-cols-[1.1fr_1fr] gap-[0.8em] px-[1em] pb-[1em]">
            <span className="flex flex-col justify-center gap-[0.5em]">
              <span className="text-[1.25em] leading-[1.1] font-bold tracking-tight text-slate-900 dark:text-white">
                Fly further, for less.
              </span>
              <span className="text-[0.7em] leading-snug text-slate-500 dark:text-slate-400">
                Direct routes to 40 cities, with fares that never change at the gate.
              </span>
              <span className="mt-[0.3em] w-fit rounded-full bg-rose-700 px-[0.9em] py-[0.4em] text-[0.7em] font-semibold text-white">
                Get started
              </span>
            </span>
            <span className="overflow-hidden rounded-[0.6em]">
              <Photo />
            </span>
          </span>
        </div>

        {/* The palette. */}
        <div
          className={`${ARTBOARD} top-[22.3em] left-[16.3em] grid h-[7em] w-[20.5em] grid-cols-5 gap-[0.5em] p-[0.8em]`}
        >
          <span className={BOARD_LABEL}>Palette</span>
          {PALETTE.map(([hex, name]) => (
            <span key={hex} className="flex flex-col gap-[0.3em]">
              <span
                className="flex-1 rounded-[0.4em] ring-1 ring-slate-900/10"
                style={{ backgroundColor: hex }}
              />
              <span className="text-[0.65em] leading-none text-slate-500 dark:text-slate-400">
                {name}
              </span>
            </span>
          ))}
        </div>

        {/* The photo, Kai's crop being drawn on it. */}
        <div className={`${ARTBOARD} top-[19em] left-[1.8em] h-[14em] w-[12.5em] overflow-hidden`}>
          <Photo />
          <span className="absolute inset-[12%_10%_18%_14%] border-[0.15em] border-white shadow-[0_0_0_999px_rgb(15_23_42/0.45)]">
            <span className="absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="border-[0.05em] border-white/40" />
              ))}
            </span>
          </span>
        </div>
        <span className={`${BOARD_LABEL} top-[17.4em] left-[1.8em]`}>Photo</span>
        <SceneCursor
          name="Kai"
          colour="#be123c"
          className="lw-drift-b"
          style={{ left: '30%', top: '72%' }}
        />
      </div>

      {/* The inspector, for the selected mark. */}
      <div className="flex flex-col gap-[1em] border-l border-slate-200 bg-white px-[1em] py-[1.1em] text-[0.9em] dark:border-slate-800 dark:bg-slate-900">
        <span className="flex gap-[1em] border-b border-slate-100 pb-[0.6em] font-semibold dark:border-slate-800">
          <span className="text-slate-900 dark:text-white">Design</span>
          <span className="text-slate-400">Prototype</span>
        </span>
        <span className="flex flex-col gap-[0.5em]">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Mark</span>
          <span className="grid grid-cols-2 gap-[0.4em]">
            <Field label="X" value="48" />
            <Field label="Y" value="36" />
            <Field label="W" value="64" />
            <Field label="H" value="64" />
          </span>
        </span>
        <span className="flex flex-col gap-[0.5em]">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Fill</span>
          <span className="flex h-[2.3em] items-center gap-[0.5em] rounded-[0.5em] bg-slate-100 px-[0.6em] dark:bg-slate-800">
            <span className="size-[1.2em] rounded-[0.3em] bg-gradient-to-br from-rose-400 to-rose-700" />
            <span className="text-slate-800 dark:text-slate-100">Linear</span>
            <span className="ml-auto text-slate-400">100%</span>
          </span>
          <Field label="Radius" value="13" />
        </span>
        <span className="flex flex-col gap-[0.5em]">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Export</span>
          <span className="flex gap-[0.4em]">
            <Field label="" value="2×" />
            <Field label="" value="SVG" />
          </span>
          <span className="flex h-[2.3em] items-center justify-center rounded-[0.5em] bg-rose-700 font-semibold text-white">
            Export Mark
          </span>
        </span>
      </div>
    </div>
  );
}
