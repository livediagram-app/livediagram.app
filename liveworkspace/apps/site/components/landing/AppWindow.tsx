import type { ReactNode } from 'react';
import { Cursor } from './Cursor';

// A browser window around an app's work, for the apps section (liveworkspace/docs/site.md "The
// front door"): what someone sees when a link opens, with another person already in it. Decorative.
export function AppWindow({ address, children }: { address: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 select-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
    >
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-300 dark:bg-rose-400/60" />
          <span className="size-2.5 rounded-full bg-amber-300 dark:bg-amber-400/60" />
          <span className="size-2.5 rounded-full bg-emerald-300 dark:bg-emerald-400/60" />
        </span>
        <span className="flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {address}
        </span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

// livediagram's work: a flowchart on the dotted canvas, a sticky note, and Ada joining a line.
export function DiagramScene() {
  const node =
    'absolute flex items-center justify-center rounded-xl border-2 text-[11px] font-semibold sm:text-xs';
  return (
    <div className="relative aspect-[16/10] bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1px,transparent_1.2px)] [background-size:16px_16px] dark:bg-[radial-gradient(circle,rgb(71_85_105/0.6)_1px,transparent_1.2px)]">
      <svg viewBox="0 0 320 200" className="absolute inset-0 size-full" fill="none">
        <path
          d="M82 60h40M190 60h28"
          className="stroke-sky-500"
          strokeWidth="2"
          markerEnd="url(#lw-arrow)"
        />
        <path
          d="M253 90v22"
          className="stroke-sky-500"
          strokeWidth="2"
          markerEnd="url(#lw-arrow)"
        />
        <path
          d="M218 140h-46"
          className="stroke-sky-500"
          strokeWidth="2"
          markerEnd="url(#lw-arrow)"
        />
        <path
          d="M120 140H92"
          className="stroke-sky-400 lw-flow"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <defs>
          <marker
            id="lw-arrow"
            viewBox="0 0 8 8"
            refX="6"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 8 4 0 8z" className="fill-sky-500" />
          </marker>
        </defs>
      </svg>
      <span
        className={`${node} top-[20%] left-[6%] h-[20%] w-[20%] border-sky-500 bg-sky-500 text-white`}
      >
        Idea
      </span>
      <span
        className={`${node} top-[20%] left-[38%] h-[20%] w-[21%] border-sky-500 bg-white text-sky-800 dark:bg-slate-900 dark:text-sky-200`}
      >
        Research
      </span>
      <span
        className={`${node} top-[19%] left-[72.5%] aspect-square w-[13%] rotate-45 rounded-lg border-sky-400 bg-sky-50 dark:bg-sky-950`}
      >
        <span className="-rotate-45 text-sky-800 dark:text-sky-200">Ship?</span>
      </span>
      <span
        className={`${node} top-[60%] left-[68%] h-[20%] w-[22%] border-sky-500 bg-white text-sky-800 dark:bg-slate-900 dark:text-sky-200`}
      >
        Plan it
      </span>
      <span
        className={`${node} top-[60%] left-[38%] h-[20%] w-[16%] border-dashed border-sky-300 bg-white/60 text-sky-700 dark:bg-slate-900/60 dark:text-sky-300`}
      >
        Build
      </span>
      <span className="absolute top-[56%] left-[5%] w-[24%] -rotate-3 rounded-md bg-amber-200 p-2 text-[10px] leading-snug font-medium text-amber-950 shadow-md sm:text-[11px]">
        Ask the team before Friday
      </span>
      <Cursor name="Ada" colour="#0284c7" className="lw-drift-a absolute top-[66%] left-[28%]" />
    </div>
  );
}

const BOARD: { title: string; cards: { text: string; tag?: string; done?: boolean }[] }[] = [
  {
    title: 'To do',
    cards: [{ text: 'Write the launch post', tag: 'Copy' }, { text: 'Pick a date' }],
  },
  {
    title: 'Doing',
    cards: [{ text: 'Build the sign-up form', tag: 'Design' }],
  },
  {
    title: 'Done',
    cards: [
      { text: 'Sketch the flow', tag: 'livediagram', done: true },
      { text: 'Agree the scope', done: true },
    ],
  },
];

// liveplanner's work: a board of cards, one of them on its way across with Sam.
export function BoardScene() {
  return (
    <div className="relative grid aspect-[16/10] grid-cols-3 gap-2.5 bg-slate-50 p-3 sm:gap-3 sm:p-4 dark:bg-slate-950/40">
      {BOARD.map((column) => (
        <div
          key={column.title}
          className="flex flex-col gap-2 rounded-xl bg-slate-100 p-2 dark:bg-slate-800/60"
        >
          <span className="flex items-center justify-between px-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase sm:text-[11px] dark:text-slate-400">
            {column.title}
            <span className="text-slate-400 dark:text-slate-500">{column.cards.length}</span>
          </span>
          {column.cards.map((card) => (
            <span
              key={card.text}
              className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-[10px] leading-snug font-medium text-slate-800 shadow-sm sm:text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <span className={card.done ? 'text-slate-400 line-through dark:text-slate-500' : ''}>
                {card.text}
              </span>
              {card.tag ? (
                <span className="w-fit rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 sm:text-[10px] dark:bg-violet-500/20 dark:text-violet-200">
                  {card.tag}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      ))}
      <span className="absolute top-[46%] left-[40%] w-[27%] rotate-3 rounded-lg border border-violet-300 bg-white p-2 text-[10px] font-medium text-slate-800 shadow-xl shadow-violet-900/15 sm:text-[11px] dark:border-violet-500/60 dark:bg-slate-900 dark:text-slate-100">
        Invite the beta list
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-500/20">
          <span className="block h-full w-2/3 rounded-full bg-violet-500" />
        </span>
      </span>
      <Cursor name="Sam" colour="#7c3aed" className="absolute top-[58%] left-[62%]" />
    </div>
  );
}
