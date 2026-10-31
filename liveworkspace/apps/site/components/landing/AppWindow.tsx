import type { ReactNode } from 'react';
import { Cursor } from './Cursor';

// A browser window around an app's work, for the apps section (liveworkspace/docs/specs/010-site/site.md "The
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
      <Cursor name="Ada" colour="#0369a1" className="lw-drift-a absolute top-[66%] left-[28%]" />
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

// livedocuments' work: an article laid out on a page, its slides beside it, and Lena editing.
export function DocumentScene() {
  const line = 'block h-1.5 rounded-full bg-slate-200 dark:bg-slate-700';
  return (
    <div className="relative grid aspect-[16/10] grid-cols-[1fr_28%] gap-3 bg-slate-100 p-3 sm:gap-4 sm:p-4 dark:bg-slate-950/40">
      <div className="flex flex-col gap-2 rounded-md bg-white p-3 shadow-md sm:p-4 dark:bg-slate-900">
        <span className="text-[9px] font-semibold tracking-widest text-amber-700 uppercase sm:text-[10px] dark:text-amber-300">
          Quarterly review
        </span>
        <span className="text-sm leading-tight font-semibold text-slate-900 sm:text-base dark:text-white">
          What we shipped, and what comes next
        </span>
        <span className="mt-1 grid grid-cols-[1fr_40%] gap-3">
          <span className="flex flex-col gap-1.5">
            <span className={`${line} w-full`} />
            <span className={`${line} w-11/12`} />
            <span className={`${line} w-full`} />
            <span className={`${line} w-3/4`} />
            <span className="mt-1 border-l-2 border-amber-400 pl-2 text-[9px] leading-snug text-slate-600 italic sm:text-[10px] dark:text-slate-300">
              “Three launches, one link each.”
            </span>
            <span className={`${line} w-full`} />
            <span className={`${line} w-5/6`} />
          </span>
          <span className="rounded bg-gradient-to-br from-amber-200 via-amber-300 to-orange-300 dark:from-amber-500/40 dark:via-amber-600/40 dark:to-orange-600/40" />
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`flex aspect-video flex-col justify-end gap-1 rounded bg-white p-1.5 shadow-sm ring-1 dark:bg-slate-900 ${
              i === 1 ? 'ring-2 ring-amber-500' : 'ring-slate-200 dark:ring-slate-700'
            }`}
          >
            <span className="h-1 w-3/4 rounded-full bg-amber-400/80" />
            <span className="h-1 w-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
        ))}
      </div>
      <Cursor name="Lena" colour="#b45309" className="lw-drift-a absolute top-[52%] left-[56%]" />
    </div>
  );
}

// livedesign's work: a logo, a wireframe and a photo being cropped, on artboards, with Kai at the
// crop.
export function DesignScene() {
  const board =
    'relative flex flex-col overflow-hidden rounded-md bg-white shadow-md ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700';
  const label =
    'absolute -top-4 left-0 text-[9px] font-medium text-slate-500 sm:text-[10px] dark:text-slate-400';
  return (
    <div className="relative grid aspect-[16/10] grid-cols-3 items-center gap-3 bg-[radial-gradient(circle,rgb(148_163_184/0.3)_1px,transparent_1.2px)] [background-size:16px_16px] p-4 pt-7 sm:gap-4 sm:p-6 sm:pt-9 dark:bg-[radial-gradient(circle,rgb(71_85_105/0.55)_1px,transparent_1.2px)]">
      <div className="relative">
        <span className={label}>Logo</span>
        <div className={`${board} aspect-square items-center justify-center gap-1.5`}>
          <svg viewBox="0 0 40 40" className="w-2/5">
            <circle cx="20" cy="20" r="16" className="fill-rose-500" />
            <path
              d="M11 24c5-10 13-10 18 0"
              className="stroke-white"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[10px] font-bold tracking-tight text-slate-900 sm:text-xs dark:text-white">
            northwind
          </span>
        </div>
      </div>
      <div className="relative">
        <span className={label}>Home page</span>
        <div className={`${board} aspect-[3/4] gap-1.5 p-2`}>
          <span className="h-1.5 w-1/3 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="h-[34%] rounded border border-dashed border-slate-300 dark:border-slate-600" />
          <span className="h-1.5 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
          <span className="h-1.5 w-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
          <span className="mt-auto h-3 w-2/5 rounded bg-rose-500" />
        </div>
      </div>
      <div className="relative">
        <span className={label}>Photo</span>
        <div className={`${board} aspect-[4/5]`}>
          <svg viewBox="0 0 40 50" preserveAspectRatio="none" className="size-full">
            <rect width="40" height="50" className="fill-sky-200 dark:fill-sky-900" />
            <circle cx="29" cy="12" r="5" className="fill-amber-300 dark:fill-amber-400/80" />
            <path
              d="M0 38 12 22l9 11 6-6 13 13v10H0z"
              className="fill-emerald-600/80 dark:fill-emerald-700"
            />
          </svg>
          {/* The crop being drawn. */}
          <span className="absolute inset-[14%_10%_22%_12%] border-2 border-rose-500 shadow-[0_0_0_999px_rgb(15_23_42/0.35)]">
            {['-top-1 -left-1', '-top-1 -right-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map(
              (at) => (
                <span
                  key={at}
                  className={`absolute size-2 rounded-sm border border-rose-500 bg-white ${at}`}
                />
              ),
            )}
          </span>
        </div>
      </div>
      <Cursor name="Kai" colour="#be123c" className="lw-drift-b absolute right-[6%] bottom-[12%]" />
    </div>
  );
}
