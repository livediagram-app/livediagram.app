import { lucideCircleCheck, lucideSparkles } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livehuddle/ui';

const CheckIcon = lucideGlyph(lucideCircleCheck, 14);
const SparklesIcon = lucideGlyph(lucideSparkles, 14);

// The Build with AI hero's picture (docs/specs/019-marketing/build-with-ai.md "The page" 1): an AI chat asking for
// a Team Pod for the stand-up, the livehuddle tool calls it makes, and the Space it set up: a room with a sticky
// note per person on the wall and the team's characters round the meeting table. Decorative: one accessible name
// on the frame, the parts hidden. Static, so there is no motion to reduce.
const NOTES = [
  'bg-amber-200 dark:bg-amber-300',
  'bg-rose-200 dark:bg-rose-300',
  'bg-sky-200 dark:bg-sky-300',
  'bg-emerald-200 dark:bg-emerald-300',
];

// Each character round the table: where it stands (as a share of the room) and its shirt.
const PEOPLE = [
  { at: 'left-[22%] top-[52%]', shirt: 'bg-brand-600 dark:bg-brand-400' },
  { at: 'left-[38%] top-[34%]', shirt: 'bg-emerald-600 dark:bg-emerald-400' },
  { at: 'left-[58%] top-[34%]', shirt: 'bg-rose-500 dark:bg-rose-400' },
  { at: 'left-[74%] top-[52%]', shirt: 'bg-amber-500 dark:bg-amber-400' },
];

export function AiChatArt() {
  return (
    <div
      role="img"
      aria-label="An AI chat asks livehuddle for a Team Pod for the stand-up, and the Space is set up and shared"
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
          Set up a Team Pod for our stand-up and share a link.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['create_document', 'share_document'].map((tool) => (
            <p
              key={tool}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <CheckIcon className="text-emerald-600 dark:text-emerald-400" />
              livehuddle · {tool}
            </p>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 [background-image:radial-gradient(rgb(148_163_184/0.35)_1px,transparent_1px)] [background-size:14px_14px] p-3 dark:border-slate-800 dark:bg-slate-950 dark:[background-image:radial-gradient(rgb(71_85_105/0.5)_1px,transparent_1px)]">
          {/* The room: walls, the notes along the top wall, the table and the team round it. */}
          <div className="relative h-36 rounded-lg border-[3px] border-slate-300 bg-amber-50 dark:border-slate-600 dark:bg-slate-800">
            <div className="absolute inset-x-0 top-2 flex justify-center gap-2">
              {NOTES.map((tone) => (
                <span key={tone} className={`block h-6 w-7 rounded-sm shadow-sm ${tone}`} />
              ))}
            </div>
            <span className="absolute left-1/2 top-[56%] block h-9 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 bg-amber-200 dark:border-amber-700 dark:bg-amber-800" />
            {PEOPLE.map(({ at, shirt }) => (
              <span
                key={at}
                className={`absolute flex -translate-x-1/2 flex-col items-center ${at}`}
              >
                <span className="block size-2.5 rounded-full bg-orange-200 ring-1 ring-orange-300 dark:bg-orange-200 dark:ring-orange-400" />
                <span className={`-mt-px block h-3 w-3.5 rounded-t-md ${shirt}`} />
              </span>
            ))}
            <span className="absolute left-[12%] top-[30%] rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100">
              Morning!
            </span>
            <span className="absolute bottom-1.5 left-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              Team Pod
            </span>
          </div>
        </div>
        <p className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
          <SparklesIcon className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-400" />
          <span>
            Done. <span className="font-semibold">Daily stand-up</span> is in your livehuddle
            account, with a sticky note for each person and a participant link for the team.
          </span>
        </p>
      </div>
    </div>
  );
}
