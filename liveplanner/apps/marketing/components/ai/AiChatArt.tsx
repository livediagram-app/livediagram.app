import { lucideCircleCheck, lucideSparkles } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';

const CheckIcon = lucideGlyph(lucideCircleCheck, 14);
const SparklesIcon = lucideGlyph(lucideSparkles, 14);

// The board the AI made: three columns of cards, one card carrying the AI's own outline as a new card does in the
// editor. Each card's dot is its card type's colour, so the categorical tones stay as they are.
const COLUMNS = [
  {
    name: 'To do',
    cards: [
      { title: 'Write launch copy', tone: 'bg-amber-400' },
      { title: 'Test checkout', tone: 'bg-rose-400', fresh: true },
    ],
  },
  {
    name: 'Doing',
    cards: [{ title: 'Build pricing page', tone: 'bg-emerald-400' }],
  },
  {
    name: 'Done',
    cards: [{ title: 'Pick a domain', tone: 'bg-violet-400' }],
  },
] as const;

// The Build with AI hero's picture (docs/specs/019-marketing/build-with-ai.md "The page" 1): an AI chat asking for
// a launch board, the liveplanner tool call it makes, and the board it made, with the newest card outlined as the
// AI's. Decorative: one accessible name on the frame, the parts hidden. Static, so reduced motion needs nothing.
export function AiChatArt() {
  return (
    <div
      role="img"
      aria-label="An AI chat asks liveplanner for a launch board, and the board appears with its cards"
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
          Set up a board for our website launch.
        </p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <CheckIcon className="text-emerald-600 dark:text-emerald-400" />
          liveplanner · change_items
        </p>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950">
          {COLUMNS.map((column) => (
            <div key={column.name} className="min-w-0 space-y-1.5">
              <p className="px-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {column.name}
              </p>
              {column.cards.map((card) => (
                <div
                  key={card.title}
                  className={`rounded-lg border bg-white px-2 py-1.5 text-[11px] leading-snug text-slate-700 shadow-xs dark:bg-slate-900 dark:text-slate-200 ${
                    'fresh' in card
                      ? 'border-brand-400 ring-2 ring-brand-200 dark:border-brand-400 dark:ring-brand-500/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className={`mb-1 block h-1 w-5 rounded-full ${card.tone}`} />
                  {card.title}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
          <SparklesIcon className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-400" />
          <span>
            Done. <span className="font-semibold">Website launch</span> is in your liveplanner
            account, ready to work on together.
          </span>
        </p>
      </div>
    </div>
  );
}
