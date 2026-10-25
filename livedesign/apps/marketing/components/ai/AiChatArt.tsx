import { lucideCircleCheck, lucideSparkles } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { FONT, at } from '@/components/art-tokens';

const CheckIcon = lucideGlyph(lucideCircleCheck, 14);
const SparklesIcon = lucideGlyph(lucideSparkles, 14);

// The Build with AI hero's picture (docs/specs/019-marketing/build-with-ai.md "The page" 1): an AI chat asking for
// a sign-in screen, the livedesign tool call it makes, and the phone wireframe building itself (the hm-* marks
// in app/hero-scenes/pages.css, each playing once at its own --d). Decorative: one accessible name on the frame,
// the parts hidden. The animation is CSS keyframes only, and reduced motion shows the finished picture.
export function AiChatArt() {
  return (
    <div
      role="img"
      aria-label="An AI chat asks livedesign for a sign-in screen, and the phone wireframe builds itself"
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
          Wireframe a sign-in screen for our app.
        </p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <CheckIcon className="text-emerald-600 dark:text-emerald-400" />
          livedesign · change_pages
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 [background-image:radial-gradient(rgb(148_163_184/0.35)_1px,transparent_1px)] [background-size:14px_14px] px-4 py-5 dark:border-slate-800 dark:bg-slate-950 dark:[background-image:radial-gradient(rgb(71_85_105/0.5)_1px,transparent_1px)]">
          <ScreenBuild />
        </div>
        <p className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
          <SparklesIcon className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-400" />
          <span>
            Done. <span className="font-semibold">Sign in</span> is in your livedesign account,
            ready to edit together.
          </span>
        </p>
      </div>
    </div>
  );
}

const SKY = '#0ea5e9';
const INK = '#1e293b';
const WIRE = '#cbd5e1';

// A phone wireframe from a ready-made screen: the frame lands, the title is typed, then the fields and the button.
function ScreenBuild() {
  const phone = { x: 105, y: 4, w: 90, h: 161 };
  const field = (y: number, d: number) => (
    <g className="hm-fade" style={at(d)}>
      <rect x={phone.x + 10} y={y - 8} width="30" height="4" rx="2" fill={WIRE} />
      <rect
        x={phone.x + 10}
        y={y}
        width={phone.w - 20}
        height="14"
        rx="4"
        fill="#ffffff"
        stroke={WIRE}
      />
    </g>
  );
  return (
    <svg viewBox="0 0 300 169" className="mx-auto block w-full max-w-[300px]">
      <rect
        className="hm-pop"
        style={at(0.2)}
        x={phone.x}
        y={phone.y}
        width={phone.w}
        height={phone.h}
        rx="14"
        fill="#ffffff"
        stroke={INK}
        strokeWidth="2.5"
      />
      <rect
        className="hm-fade"
        style={at(0.5)}
        x={phone.x + phone.w / 2 - 12}
        y={phone.y + 7}
        width="24"
        height="6"
        rx="3"
        fill={INK}
      />
      <text
        className="hm-type"
        style={at(0.9, { '--steps': 7 })}
        x={phone.x + 10}
        y={phone.y + 40}
        fontFamily={FONT}
        fontSize="13"
        fontWeight="800"
        fill={INK}
      >
        Sign in
      </text>
      {field(phone.y + 64, 1.5)}
      {field(phone.y + 96, 1.8)}
      <rect
        className="hm-pop"
        style={at(2.3)}
        x={phone.x + 10}
        y={phone.y + 122}
        width={phone.w - 20}
        height="16"
        rx="8"
        fill={SKY}
      />
      <rect
        className="hm-fade"
        style={at(2.6)}
        x={phone.x + 28}
        y={phone.y + 145}
        width={phone.w - 56}
        height="4"
        rx="2"
        fill={WIRE}
      />
    </svg>
  );
}
