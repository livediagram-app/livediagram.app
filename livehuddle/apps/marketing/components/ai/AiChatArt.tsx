import { lucideCircleCheck, lucideSparkles } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livehuddle/ui';

const CheckIcon = lucideGlyph(lucideCircleCheck, 14);
const SparklesIcon = lucideGlyph(lucideSparkles, 14);

// The Build with AI hero's picture (docs/specs/019-marketing/build-with-ai.md "The page" 1): an AI chat asking for
// a retro, the livehuddle tool call it makes, and the board it set up: three columns of stickies. Decorative:
// one accessible name on the frame, the parts hidden. Static, so there is no motion to reduce.
const RETRO = [
  { heading: 'Went well', tone: 'bg-emerald-200 dark:bg-emerald-300', notes: 2 },
  { heading: 'To improve', tone: 'bg-amber-200 dark:bg-amber-300', notes: 3 },
  { heading: 'Actions', tone: 'bg-sky-200 dark:bg-sky-300', notes: 1 },
];

export function AiChatArt() {
  return (
    <div
      role="img"
      aria-label="An AI chat asks livehuddle for a sprint retro, and the board is set up"
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
          Set up a retro for our sprint and share a participant link.
        </p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <CheckIcon className="text-emerald-600 dark:text-emerald-400" />
          livehuddle · create_document
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 [background-image:radial-gradient(rgb(148_163_184/0.35)_1px,transparent_1px)] [background-size:14px_14px] px-4 py-5 dark:border-slate-800 dark:bg-slate-950 dark:[background-image:radial-gradient(rgb(71_85_105/0.5)_1px,transparent_1px)]">
          <div className="grid grid-cols-3 gap-3">
            {RETRO.map((column) => (
              <div key={column.heading} className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {column.heading}
                </p>
                {Array.from({ length: column.notes }, (_, i) => (
                  <span key={i} className={`block h-8 rounded-sm shadow-sm ${column.tone}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
          <SparklesIcon className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-400" />
          <span>
            Done. <span className="font-semibold">Sprint retro</span> is in your livehuddle account,
            with a participant link for the team.
          </span>
        </p>
      </div>
    </div>
  );
}
