'use client';

// The five kinds of page as cards (docs/specs/007-editor/pages-mode.md "Page kinds"): a
// miniature of the page above its name and a line on what it is for: the first page's own choice.
// The Add a Page list shows the same kinds as rows (AddPagePopover).
import type { PageKind } from '@livedesign/document';
import type { KeyboardEvent, Ref } from 'react';

// `hint`: the short line the Add a Page list shows beside the name.
type PageKindChoice = { kind: PageKind; name: string; line: string; hint: string };

// The cards sit two by two, the last across both columns.
const KIND_COLUMNS = 2;

/** Arrow keys between the cards (the popover and the first page's choice alike): Left / Right
 *  step one card, Up / Down a row of the two-by-two grid, wrapping. */
export function moveBetweenKindCards(
  e: KeyboardEvent<HTMLElement>,
  cards: readonly (HTMLButtonElement | null)[],
) {
  const step = (
    { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -KIND_COLUMNS, ArrowDown: KIND_COLUMNS } as Record<
      string,
      number
    >
  )[e.key];
  if (step === undefined) return;
  e.preventDefault();
  const at = cards.findIndex((c) => c === document.activeElement);
  const n = PAGE_KINDS.length;
  let next = at + step;
  // Down from a card above a short last row lands on that row's last card (the wide one), not round to the top.
  if (
    step === KIND_COLUMNS &&
    next >= n &&
    Math.floor(at / KIND_COLUMNS) < Math.floor((n - 1) / KIND_COLUMNS)
  )
    next = n - 1;
  cards[(next + n) % n]?.focus();
}

export const PAGE_KINDS: readonly PageKindChoice[] = [
  {
    kind: 'infographic',
    name: 'Infographic',
    line: 'A page to lay out: layouts, icons, charts and media.',
    hint: 'Lay out icons, charts and media.',
  },
  {
    kind: 'logo',
    name: 'Logo',
    line: 'A square artboard for a logo, with guides and drawing tools.',
    hint: 'A square artboard for a mark.',
  },
  {
    kind: 'wireframe',
    name: 'Wireframe',
    line: 'A screen to wireframe, framed as a phone, tablet, laptop or browser.',
    hint: 'A phone, tablet or web screen.',
  },
];

export function PageKindCard({
  choice,
  onChoose,
  wide = false,
  ref,
}: {
  choice: PageKindChoice;
  onChoose: () => void;
  // Across both columns, its miniature beside its words (the last card of an odd number).
  wide?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onChoose}
      className={`group relative flex items-stretch gap-2 rounded-lg border p-2 text-left transition ${
        wide ? 'col-span-2 flex-row items-center' : 'flex-col'
      } hover:border-brand-400 hover:bg-brand-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:border-brand-400 dark:hover:bg-brand-500/10 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900`}
    >
      <span
        className={`flex h-24 shrink-0 items-center justify-center rounded-md bg-slate-50 dark:bg-slate-800/70 ${
          wide ? 'w-[calc(50%-0.25rem)]' : ''
        }`}
      >
        {choice.kind === 'wireframe' ? (
          <WireframeMiniature />
        ) : choice.kind === 'logo' ? (
          <LogoMiniature />
        ) : (
          <InfographicMiniature />
        )}
      </span>
      <span className="px-0.5">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          {choice.name}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
          {choice.line}
        </span>
      </span>
    </button>
  );
}

function InfographicMiniature() {
  return (
    <svg width="58" height="78" viewBox="0 0 58 78" aria-hidden className="drop-shadow-sm">
      <rect width="58" height="78" rx="3" className="fill-white dark:fill-slate-700" />
      <rect
        x="8"
        y="8"
        width="30"
        height="5"
        rx="2"
        className="fill-slate-700 dark:fill-slate-200"
      />
      <rect
        x="8"
        y="16"
        width="20"
        height="3"
        rx="1.5"
        className="fill-slate-300 dark:fill-slate-500"
      />
      <rect
        x="8"
        y="26"
        width="42"
        height="22"
        rx="3"
        className="fill-brand-100 dark:fill-brand-500/25"
      />
      <rect x="13" y="38" width="5" height="7" rx="1" className="fill-brand-500" />
      <rect x="21" y="33" width="5" height="12" rx="1" className="fill-brand-500" />
      <rect x="29" y="30" width="5" height="15" rx="1" className="fill-brand-500" />
      <rect x="37" y="35" width="5" height="10" rx="1" className="fill-brand-500" />
      <circle cx="14" cy="60" r="5" className="fill-amber-400" />
      <circle cx="29" cy="60" r="5" className="fill-emerald-400" />
      <circle cx="44" cy="60" r="5" className="fill-rose-400" />
      <rect
        x="8"
        y="69"
        width="42"
        height="2.5"
        rx="1.25"
        className="fill-slate-200 dark:fill-slate-500"
      />
    </svg>
  );
}

// A square artboard: faint construction guides (centre lines, a keyline circle) behind a mark.
function LogoMiniature() {
  const guide = 'stroke-sky-400/60 dark:stroke-sky-300/50';
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="drop-shadow-sm">
      <rect width="64" height="64" rx="3" className="fill-white dark:fill-slate-700" />
      <g fill="none" strokeWidth="0.6" className={guide}>
        <line x1="32" y1="2" x2="32" y2="62" />
        <line x1="2" y1="32" x2="62" y2="32" />
        <circle cx="32" cy="32" r="25.6" />
        <rect x="6.4" y="6.4" width="51.2" height="51.2" strokeDasharray="2 1.5" />
      </g>
      <circle cx="32" cy="27" r="11" className="fill-brand-500" />
      <circle cx="32" cy="27" r="5" className="fill-white dark:fill-slate-700" />
      <rect
        x="18"
        y="43"
        width="28"
        height="4"
        rx="2"
        className="fill-slate-700 dark:fill-slate-200"
      />
    </svg>
  );
}

// A phone and a laptop, each with a screen being wireframed: a header bar, a picture, a button.
function WireframeMiniature() {
  const bar = 'fill-slate-300 dark:fill-slate-500';
  const pic = 'fill-brand-100 dark:fill-brand-500/25';
  return (
    <svg width="104" height="70" viewBox="0 0 104 70" aria-hidden className="drop-shadow-sm">
      <rect
        x="22"
        y="6"
        width="74"
        height="48"
        rx="4"
        className="fill-slate-800 dark:fill-slate-950"
      />
      <rect
        x="25"
        y="9"
        width="68"
        height="42"
        rx="1.5"
        className="fill-white dark:fill-slate-700"
      />
      <rect
        x="12"
        y="54"
        width="94"
        height="5"
        rx="2"
        className="fill-slate-400 dark:fill-slate-600"
      />
      <rect
        x="29"
        y="13"
        width="18"
        height="3"
        rx="1.5"
        className="fill-slate-700 dark:fill-slate-200"
      />
      <rect x="29" y="20" width="26" height="2.5" rx="1.25" className={bar} />
      <rect x="29" y="25" width="22" height="2.5" rx="1.25" className={bar} />
      <rect x="29" y="31" width="14" height="5" rx="1.5" className="fill-brand-500" />
      <rect x="60" y="13" width="29" height="34" rx="2" className={pic} />
      <rect
        x="2"
        y="16"
        width="26"
        height="50"
        rx="5"
        className="fill-slate-800 dark:fill-slate-950"
      />
      <rect
        x="4"
        y="18"
        width="22"
        height="46"
        rx="3.5"
        className="fill-white dark:fill-slate-700"
      />
      <rect
        x="11"
        y="19.5"
        width="8"
        height="2.5"
        rx="1.25"
        className="fill-slate-800 dark:fill-slate-950"
      />
      <rect x="7" y="25" width="16" height="12" rx="1.5" className={pic} />
      <rect x="7" y="40" width="12" height="2.5" rx="1.25" className={bar} />
      <rect x="7" y="45" width="15" height="2.5" rx="1.25" className={bar} />
      <rect x="7" y="55" width="16" height="5" rx="1.5" className="fill-brand-500" />
    </svg>
  );
}
