import { lucideGlyph } from '@livediagram/ui';
import {
  lucideMic,
  lucideScreenShare,
  lucideTimer,
  lucideVideoOff,
} from '@liveworkspace/icons/lucide';
import type { CSSProperties } from 'react';
import { Character, type CharacterLook } from './Character';

// livehuddle's work (liveworkspace/docs/specs/010-site/site.md "The front door"): a Space's Team Pod as livehuddle
// draws it, from Maya's screen. The team stand round the meeting table on the rug; Maya is talking, so her hearing
// ring lies on the floor round her feet, cut to the room's walls, rippling out while she talks; the Timer runs on
// the back wall by the name plate; Jo walks up from the plants outside to the doorway; and the Call dock sits at
// the bottom centre with her microphone live. No cursor: in a Space people are their characters. Decorative.
//
// The floor, the walls and the furniture are one SVG on a 320 × 200 grid (the window's 16:10), and the people,
// labels and the dock are HTML placed on the same grid, so they all scale together.

const MicGlyph = lucideGlyph(lucideMic, 14);
const CameraOffGlyph = lucideGlyph(lucideVideoOff, 14);
const ShareGlyph = lucideGlyph(lucideScreenShare, 14);
const TimerGlyph = lucideGlyph(lucideTimer, 11);

// A point on the grid as a box's left and top.
const at = (x: number, y: number): CSSProperties => ({
  left: `${(x / 320) * 100}%`,
  top: `${(y / 200) * 100}%`,
});

// A character is 20 grid units wide and 30 tall: placed by the middle of its feet.
const feet = (x: number, y: number): CSSProperties => ({ ...at(x - 10, y - 30), width: '6.25%' });

const PEOPLE: { name: string; look: CharacterLook; x: number; y: number; talking?: boolean }[] = [
  {
    name: 'Maya',
    look: { shirt: '#059669', hair: '#78350f', skin: '#f5d0b0', long: true },
    x: 46,
    y: 100,
    talking: true,
  },
  {
    name: 'Priya',
    look: { shirt: '#db2777', hair: '#1c1917', skin: '#c68a5e', long: true },
    x: 128,
    y: 68,
  },
  {
    name: 'Sam',
    look: { shirt: '#0284c7', hair: '#a16207', skin: '#f1c7a5' },
    x: 156,
    y: 100,
  },
];

const JO: CharacterLook = { shirt: '#d97706', hair: '#3f2a1d', skin: '#e0b089', legs: '#1e3a8a' };

// The bookshelf's books, two shelves of them, as [x, shelf top, height, colour].
const BOOKS: [number, number, number, string][] = [
  [256, 21, 9, '#38bdf8'],
  [261, 21, 7, '#f59e0b'],
  [266, 21, 9, '#a78bfa'],
  [276, 21, 8, '#34d399'],
  [256, 35, 8, '#f43f5e'],
  [261, 35, 9, '#0ea5e9'],
  [271, 35, 7, '#f59e0b'],
  [276, 35, 9, '#8b5cf6'],
];

// Maya's feet: the centre of her hearing ring.
const HEARS = { x: 46, y: 100, r: 66 };

const DOCK_BUTTON =
  'flex size-5 items-center justify-center rounded-lg sm:size-7 [&_svg]:size-3 sm:[&_svg]:size-3.5';

export function HuddleScene() {
  return (
    <div className="relative aspect-[16/10] bg-emerald-50/60 bg-[radial-gradient(circle,rgb(16_185_129/0.22)_1px,transparent_1.2px)] [background-size:16px_16px] dark:bg-slate-950/40 dark:bg-[radial-gradient(circle,rgb(71_85_105/0.6)_1px,transparent_1.2px)]">
      <svg viewBox="0 0 320 200" className="absolute inset-0 size-full" fill="none">
        <defs>
          <clipPath id="lw-pod-floor">
            <rect x="18" y="30" width="176" height="118" />
          </clipPath>
        </defs>
        {/* The room: its floor, its back wall's face, and its walls with a doorway on the right. */}
        <rect
          x="16"
          y="14"
          width="180"
          height="136"
          className="fill-white dark:fill-slate-800/70"
        />
        <rect
          x="16"
          y="14"
          width="180"
          height="16"
          className="fill-slate-200 dark:fill-slate-700"
        />
        {/* The rug, the meeting table and its chairs. */}
        <ellipse
          cx="100"
          cy="88"
          rx="62"
          ry="38"
          className="fill-amber-50 stroke-amber-200 dark:fill-amber-900/25 dark:stroke-amber-700/40"
          strokeWidth="1.5"
        />
        {[78, 108].map((x) => (
          <g key={x} className="fill-slate-300 dark:fill-slate-600">
            <rect x={x} y="66" width="14" height="8" rx="2" />
            <rect x={x} y="104" width="14" height="8" rx="2" />
          </g>
        ))}
        <rect
          x="68"
          y="75"
          width="64"
          height="27"
          rx="6"
          className="fill-slate-200 stroke-slate-300 dark:fill-slate-700 dark:stroke-slate-600"
          strokeWidth="1.5"
        />
        {/* A coffee machine in the corner and a plant by the door. */}
        <rect
          x="24"
          y="124"
          width="14"
          height="18"
          rx="2"
          className="fill-slate-300 dark:fill-slate-600"
        />
        <rect x="27" y="128" width="8" height="5" rx="1" className="fill-slate-500" />
        <Plant x={182} y={146} />
        {/* Maya's hearing ring on the floor, under every character: cut to the room's floor, since walls stop
            sound, with the ripple running out from her feet while she talks. */}
        <g clipPath="url(#lw-pod-floor)">
          <circle
            cx={HEARS.x}
            cy={HEARS.y}
            r={HEARS.r}
            fill="#059669"
            fillOpacity="0.1"
            stroke="#059669"
            strokeOpacity="0.5"
            strokeWidth="1.25"
          />
          <circle
            cx={HEARS.x}
            cy={HEARS.y}
            r={HEARS.r}
            stroke="#059669"
            strokeWidth="1.5"
            className="lw-hear"
          />
        </g>
        <path
          d="M196 96V14H16v136h180v-24"
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Outside: a bookshelf, a water cooler and the plants Jo has walked past. */}
        <rect
          x="252"
          y="16"
          width="36"
          height="32"
          rx="2"
          className="fill-slate-200 stroke-slate-300 dark:fill-slate-700 dark:stroke-slate-600"
        />
        {BOOKS.map(([x, y, h, c]) => (
          <rect key={`${x}-${y}`} x={x} y={y + 9 - h} width="4" height={h} fill={c} />
        ))}
        <path d="M254 31h32M254 45h32" className="stroke-slate-300 dark:stroke-slate-600" />
        <rect
          x="222"
          y="22"
          width="12"
          height="9"
          rx="3"
          className="fill-sky-200 dark:fill-sky-800"
        />
        <rect
          x="221"
          y="31"
          width="14"
          height="18"
          rx="2"
          className="fill-slate-200 dark:fill-slate-600"
        />
        <Plant x={300} y={60} />
        <Plant x={268} y={152} />
      </svg>

      {/* The room's name plate and the Timer on its back wall. */}
      <span
        className="absolute flex h-[6%] items-center rounded-sm bg-white px-1.5 text-[8px] font-semibold text-slate-600 shadow-sm sm:text-[10px] dark:bg-slate-900 dark:text-slate-300"
        style={at(22, 16.5)}
      >
        Team Pod
      </span>
      <span
        className="absolute flex h-[6%] items-center gap-1 rounded-sm bg-emerald-700 px-1.5 text-[8px] font-semibold text-white tabular-nums sm:text-[10px]"
        style={at(140, 16.5)}
      >
        <TimerGlyph />
        04:12
      </span>

      {PEOPLE.map((p) => (
        <Character
          key={p.name}
          name={p.name}
          look={p.look}
          talking={p.talking}
          className="absolute"
          style={feet(p.x, p.y)}
        />
      ))}
      <Character name="Jo" look={JO} className="lw-drift-b absolute" style={feet(230, 132)} />

      {/* What Maya is saying, in her bubble. */}
      <span
        className="absolute rounded-lg rounded-bl-none bg-white px-1.5 py-0.5 text-[9px] leading-tight font-medium text-slate-800 shadow-md ring-1 ring-emerald-300 sm:px-2 sm:py-1 sm:text-[11px] dark:bg-slate-800 dark:text-slate-100 dark:ring-emerald-500/50"
        style={at(30, 42)}
      >
        Morning, all!
        <span className="block text-[8px] font-semibold text-emerald-700 sm:text-[9px] dark:text-emerald-300">
          Maya
        </span>
      </span>

      {/* The Call dock, bottom centre: Maya's microphone live, her camera off, Share. */}
      <span className="absolute bottom-[3%] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <span className={`${DOCK_BUTTON} bg-emerald-600 text-white`}>
          <MicGlyph />
        </span>
        <span
          className={`${DOCK_BUTTON} bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`}
        >
          <CameraOffGlyph />
        </span>
        <span
          className={`${DOCK_BUTTON} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}
        >
          <ShareGlyph />
        </span>
      </span>
    </div>
  );
}

// A potted plant, its pot's foot at (x, y).
function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path
        d={`M${x} ${y - 10}c-6-4-9-11-8-16 4 2 7 7 8 12 1-6 3-11 6-14 1 6-1 13-6 18z`}
        className="fill-emerald-500 dark:fill-emerald-400"
      />
      <path
        d={`M${x - 5} ${y - 10}h10l-2 10h-6z`}
        className="fill-orange-600 dark:fill-orange-500"
      />
    </g>
  );
}
