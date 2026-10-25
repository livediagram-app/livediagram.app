import { lucideCircleCheck, lucideSparkles } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import { FONT, at } from '@/components/art-tokens';

const CheckIcon = lucideGlyph(lucideCircleCheck, 14);
const SparklesIcon = lucideGlyph(lucideSparkles, 14);

// The Build with AI hero's picture (docs/specs/019-marketing/build-with-ai.md "The page" 1): an AI chat asking for
// a deck, the livedocuments tool call it makes, and the first slide building itself from a layout (the hm-* marks
// in app/hero-scenes/pages.css, each playing once at its own --d). Decorative: one accessible name on the frame,
// the parts hidden. The animation is CSS keyframes only, and reduced motion shows the finished picture.
export function AiChatArt() {
  return (
    <div
      role="img"
      aria-label="An AI chat asks livedocuments for a deck, and the first slide builds itself"
      className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 shadow-xl shadow-brand-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/30"
    >
      <div
        aria-hidden
        className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3 dark:border-slate-800"
      >
        <span className="size-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />
        <span className="size-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />
        <span className="size-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />
        <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          Your AI tool
        </span>
      </div>
      <div aria-hidden className="space-y-3 p-4 text-sm">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-3.5 py-2 text-white dark:bg-brand-500 dark:text-slate-950">
          Make a short deck on our Q3 launch.
        </p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <CheckIcon className="text-emerald-600 dark:text-emerald-400" />
          livedocuments · change_pages
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 [background-image:radial-gradient(rgb(148_163_184/0.35)_1px,transparent_1px)] [background-size:14px_14px] px-4 py-5 dark:border-slate-800 dark:bg-slate-950 dark:[background-image:radial-gradient(rgb(71_85_105/0.5)_1px,transparent_1px)]">
          <SlideBuild />
        </div>
        <p className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
          <SparklesIcon className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-400" />
          <span>
            Done. <span className="font-semibold">Q3 launch</span> is in your livedocuments account,
            ready to edit together.
          </span>
        </p>
      </div>
    </div>
  );
}

const SKY = '#0ea5e9';
const VIOLET = '#8b5cf6';

// A 16:9 title slide from a layout: the page lands, its band and headline arrive, then three figures grow.
function SlideBuild() {
  const bars = [22, 34, 46];
  return (
    <svg viewBox="0 0 300 169" className="mx-auto block w-full max-w-[300px]">
      <rect
        className="hm-pop"
        style={at(0.2)}
        x="1"
        y="1"
        width="298"
        height="167"
        rx="6"
        fill="#ffffff"
        stroke="#e2e8f0"
      />
      <rect
        className="hm-fade"
        style={at(0.6)}
        x="1"
        y="1"
        width="10"
        height="167"
        rx="3"
        fill={SKY}
      />
      <text
        className="hm-type"
        style={at(0.9, { '--steps': 9 })}
        x="30"
        y="52"
        fontFamily={FONT}
        fontSize="22"
        fontWeight="800"
        fill="#1e293b"
      >
        Q3 launch
      </text>
      <rect
        className="hm-fade"
        style={at(1.6)}
        x="30"
        y="66"
        width="120"
        height="6"
        rx="3"
        fill="#e2e8f0"
      />
      <rect
        className="hm-fade"
        style={at(1.8)}
        x="30"
        y="80"
        width="90"
        height="6"
        rx="3"
        fill="#e2e8f0"
      />
      {bars.map((h, i) => (
        <rect
          key={h}
          className="hm-grow"
          style={at(2.2 + i * 0.2)}
          x={196 + i * 28}
          y={140 - h * 2}
          width="18"
          height={h * 2}
          rx="3"
          fill={i === 2 ? VIOLET : SKY}
        />
      ))}
      <rect
        className="hm-fade"
        style={at(2.4)}
        x="30"
        y="132"
        width="60"
        height="8"
        rx="4"
        fill={SKY}
      />
    </svg>
  );
}
