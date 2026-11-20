import type { Person } from './AppWindow';

// liveplanner's work (liveworkspace/docs/specs/010-site/site.md "The front door"): a launch plan's Board tab, as
// the editor lays one out. The plan's views across the top, Board open; four status columns of cards, each card
// with its type, its title, its due date, its checklist and whose it is; and one card on its way to Review in
// Sam's hands, a gap opening where it will land. Drawn in the screen's `em` (AppWindow), so it scales as a
// picture. Decorative.

type Tag = { name: string; tone: string };

const COPY: Tag = {
  name: 'Copy',
  tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
};
const DESIGN: Tag = {
  name: 'Design',
  tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200',
};
const ENG: Tag = {
  name: 'Engineering',
  tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
};

const LENA: Person = { initials: 'LP', colour: '#b45309' };
const KAI: Person = { initials: 'KJ', colour: '#be123c' };
const SAM: Person = { initials: 'SK', colour: '#7c3aed' };
const ADA: Person = { initials: 'AL', colour: '#0369a1' };

type Card = {
  title: string;
  tag?: Tag;
  due?: string;
  soon?: boolean;
  checks?: string;
  progress?: number;
  comments?: number;
  who?: Person;
  done?: boolean;
};

const COLUMNS: { name: string; dot: string; count: number; cards: Card[]; gap?: boolean }[] = [
  {
    name: 'To do',
    dot: 'bg-slate-400',
    count: 5,
    cards: [
      { title: 'Write the launch post', tag: COPY, due: 'Fri 14', comments: 3, who: LENA },
      { title: 'Pricing page hero', tag: DESIGN, checks: '1/4', who: KAI },
      { title: 'Pick a launch date', due: 'Mon 10', who: ADA },
    ],
  },
  {
    name: 'In progress',
    dot: 'bg-sky-500',
    count: 3,
    cards: [
      {
        title: 'Sign-up form checks',
        tag: ENG,
        due: 'Thu 13',
        soon: true,
        progress: 0.6,
        who: SAM,
      },
      { title: 'Onboarding emails', tag: DESIGN, checks: '3/5', comments: 1, who: ADA },
    ],
  },
  {
    name: 'Review',
    dot: 'bg-amber-500',
    count: 2,
    gap: true,
    cards: [{ title: 'Beta invite email', tag: COPY, comments: 2, who: LENA }],
  },
  {
    name: 'Done',
    dot: 'bg-emerald-500',
    count: 8,
    cards: [
      { title: 'Sketch the sign-up flow', done: true, who: ADA },
      { title: 'Agree the scope', done: true, who: SAM },
      { title: 'Book the launch call', done: true, who: KAI },
    ],
  },
];

const VIEWS = ['Board', 'Sheet', 'Dashboard', 'Form'];

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-[1.1em]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const CALENDAR = 'M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3';
const CHECKS = 'M2.5 4.5 4 6l2.5-2.5M2.5 10.5 4 12l2.5-2.5M9 5h4.5M9 11h4.5';
const COMMENT = 'M2.5 3.5h11v7.5H7l-3 2.5V11H2.5z';

function CardBody({ card }: { card: Card }) {
  return (
    <>
      {card.tag ? (
        <span
          className={`w-fit rounded-[0.4em] px-[0.6em] py-[0.25em] text-[0.85em] font-semibold ${card.tag.tone}`}
        >
          {card.tag.name}
        </span>
      ) : null}
      <span
        className={`flex items-start gap-[0.5em] text-[1.1em] leading-snug font-medium ${card.done ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}
      >
        {card.done ? (
          <span className="mt-[0.1em] flex size-[1.2em] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg
              viewBox="0 0 16 16"
              className="size-[0.8em]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
            >
              <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
            </svg>
          </span>
        ) : null}
        {card.title}
      </span>
      {card.progress ? (
        <span className="block h-[0.4em] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <span
            className="block h-full rounded-full bg-sky-500"
            style={{ width: `${card.progress * 100}%` }}
          />
        </span>
      ) : null}
      <span className="flex items-center gap-[0.9em] text-[0.9em] text-slate-500 dark:text-slate-400">
        {card.due ? (
          <span
            className={`flex items-center gap-[0.3em] ${card.soon ? 'rounded-[0.4em] bg-amber-100 px-[0.4em] py-[0.15em] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' : ''}`}
          >
            <Glyph d={CALENDAR} />
            {card.due}
          </span>
        ) : null}
        {card.checks ? (
          <span className="flex items-center gap-[0.3em]">
            <Glyph d={CHECKS} />
            {card.checks}
          </span>
        ) : null}
        {card.comments ? (
          <span className="flex items-center gap-[0.3em]">
            <Glyph d={COMMENT} />
            {card.comments}
          </span>
        ) : null}
        {card.who ? (
          <span
            className="ml-auto flex size-[2em] items-center justify-center rounded-full text-[0.8em] font-semibold text-white"
            style={{ backgroundColor: card.who.colour }}
          >
            <span className="text-optical-centre">{card.who.initials}</span>
          </span>
        ) : null}
      </span>
    </>
  );
}

const CARD =
  'flex flex-col gap-[0.7em] rounded-[0.8em] border border-slate-200 bg-white p-[0.9em] shadow-[0_1px_2px_rgb(15_23_42/0.06)] dark:border-slate-700/80 dark:bg-slate-900';

export function BoardScene() {
  return (
    <div className="relative flex aspect-[16/10] flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* The plan's views, Board open, and the board's filter and grouping. */}
      <div className="flex h-[3.4em] shrink-0 items-center gap-[0.4em] border-b border-slate-200 bg-white px-[1.4em] text-[1.05em] dark:border-slate-800 dark:bg-slate-900">
        {VIEWS.map((v, i) => (
          <span
            key={v}
            className={`rounded-[0.6em] px-[0.8em] py-[0.35em] font-medium ${i === 0 ? 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {v}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-[0.4em] rounded-[0.6em] border border-slate-200 px-[0.7em] py-[0.3em] text-[0.9em] text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <Glyph d="M2.5 3.5h11L9 9v4l-2 1V9z" />
          Launch · 18 cards
        </span>
      </div>

      <div className="grid flex-1 grid-cols-4 gap-[1em] p-[1.2em]">
        {COLUMNS.map((col) => (
          <div
            key={col.name}
            className="flex min-w-0 flex-col gap-[0.7em] rounded-[1em] bg-slate-100/80 p-[0.7em] dark:bg-slate-900/60"
          >
            <span className="flex items-center gap-[0.5em] px-[0.3em] pt-[0.2em] text-[1em] font-semibold text-slate-700 dark:text-slate-200">
              <span className={`size-[0.65em] rounded-full ${col.dot}`} />
              {col.name}
              <span className="font-medium text-slate-400 dark:text-slate-500">{col.count}</span>
              <span className="ml-auto text-[1.2em] leading-none font-normal text-slate-400">
                +
              </span>
            </span>
            {col.gap ? (
              <span className="h-[6.4em] shrink-0 rounded-[0.8em] border-[0.15em] border-dashed border-violet-300 bg-violet-50/70 dark:border-violet-500/50 dark:bg-violet-500/10" />
            ) : null}
            {col.cards.map((card) => (
              <span key={card.title} className={CARD}>
                <CardBody card={card} />
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* The card in Sam's hands, lifted and tilted on its way to Review. */}
      <span
        className={`${CARD} lw-float absolute top-[22%] left-[47%] w-[22.5%] rotate-[3deg] border-violet-400 shadow-[0_18px_36px_-8px_rgb(76_29_149/0.35)] ring-[0.15em] ring-violet-500 dark:border-violet-400`}
      >
        <span className="absolute -top-[1.1em] right-[0.8em] rounded-[0.5em] bg-violet-600 px-[0.6em] py-[0.3em] text-[0.9em] leading-none font-semibold text-white shadow-sm">
          Sam
        </span>
        <CardBody
          card={{ title: 'Invite the beta list', tag: ENG, due: 'Wed 12', checks: '4/6', who: SAM }}
        />
      </span>
    </div>
  );
}
