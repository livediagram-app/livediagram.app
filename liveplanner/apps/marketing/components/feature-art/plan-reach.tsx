// Feature illustrations for the ways a board reaches people and sets itself up: Publish as Roadmap
// (docs/specs/026-plan/public-roadmap.md, the public page in apps/editor/components/roadmap/public), Email to Board
// (docs/specs/026-plan/email-to-board.md) and Configure Board's presets (docs/specs/026-plan/plan-board.md
// "Configure", apps/editor/components/plan/configure). Each draws the real surface small, with its own words.
// Motion reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished
// frame under reduced motion.
import { MUTED, Panel, Pointer, RULE, Scene, TEXT, YOU, at, from } from './canvas-parts';
import { PlanCard, SM, TM } from './plan-parts';

/** A roadmap card's vote button: the up chevron over its count, filled in the accent once voted. */
function Vote({ x, y, count, on = false }: { x: number; y: number; count: number; on?: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="11"
        height="14"
        rx="2.5"
        className={
          on
            ? 'fill-brand-700 dark:fill-brand-500'
            : 'fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700'
        }
        strokeWidth="0.6"
      />
      <path
        d={`M${x + 3.6} ${y + 5.2}l1.9-1.9 1.9 1.9`}
        fill="none"
        className={on ? 'stroke-white' : 'stroke-slate-600 dark:stroke-slate-300'}
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={x + 5.5}
        y={y + 11.2}
        fontSize="4.3"
        fontWeight="700"
        textAnchor="middle"
        className={on ? 'fill-white' : 'fill-slate-700 dark:fill-slate-200'}
      >
        {count}
      </text>
    </g>
  );
}

type RoadmapCard = { num: string; title: string; chip: string; votes: number };

/** One card on the public page: its vote button, its number and title, its card type as a chip. */
function RoadmapItem({
  x,
  y,
  card,
  voting,
}: {
  x: number;
  y: number;
  card: RoadmapCard;
  voting?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={80}
        height={20}
        rx="3"
        className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        strokeWidth="0.6"
      />
      {voting ? (
        <g>
          <g className="fa-a-out" style={at(0.2)}>
            <Vote x={x + 3} y={y + 3} count={card.votes} />
          </g>
          <g className="fa-a-late" style={at(0.2)}>
            <Vote x={x + 3} y={y + 3} count={card.votes + 1} on />
          </g>
        </g>
      ) : (
        <Vote x={x + 3} y={y + 3} count={card.votes} />
      )}
      <text className={TEXT} x={x + 17} y={y + 8} fontSize="5" fontWeight="600">
        <tspan className={MUTED} fontWeight="500">
          {card.num}
        </tspan>{' '}
        {card.title}
      </text>
      <rect
        x={x + 17}
        y={y + 11}
        width={card.chip.length * 2.1 + 5}
        height="5.6"
        rx="2.8"
        className="fill-slate-900/[0.06] dark:fill-white/10"
      />
      <text
        x={x + 19.5}
        y={y + 15}
        fontSize="3.7"
        fontWeight="600"
        className="fill-slate-700 dark:fill-slate-200"
      >
        {card.chip}
      </text>
    </g>
  );
}

/** Publish a roadmap: the public page, its title and Suggest an Idea over Planned, In Progress and Shipped, each
 *  idea with its vote button, one vote landing. */
export function PublicRoadmapArt() {
  const columns: { name: string; count: number; cards: RoadmapCard[] }[] = [
    {
      name: 'Planned',
      count: 2,
      cards: [
        { num: '#12', title: 'Dark mode', chip: 'Feature', votes: 127 },
        { num: '#19', title: 'Offline mode', chip: 'Feature', votes: 64 },
      ],
    },
    {
      name: 'In Progress',
      count: 2,
      cards: [
        { num: '#8', title: 'Calendar sync', chip: 'Integration', votes: 97 },
        { num: '#15', title: 'Bulk edit', chip: 'Feature', votes: 41 },
      ],
    },
    {
      name: 'Shipped',
      count: 2,
      cards: [
        { num: '#5', title: 'Swimlanes', chip: 'Feature', votes: 210 },
        { num: '#3', title: 'CSV import', chip: 'Integration', votes: 152 },
      ],
    },
  ];
  return (
    <Scene>
      <Panel x={10} y={4} w={280} h={88} />
      <text className={TEXT} x={20} y={15.5} fontSize="7.6" fontWeight="700">
        Acme Roadmap
      </text>
      <text className={MUTED} x={20} y={23} fontSize="4.6">
        Vote for the ideas you want most.
      </text>
      {/* Suggest an Idea, with its lightbulb: one of the plan's forms, opened in a new tab. */}
      <rect x={224} y={10} width={58} height={13} rx="3" className="fill-brand-700" />
      <g fill="none" stroke="#fff" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M231.4 19.2v-0.9c-1.2-0.8-1.9-1.9-1.9-3.1a2.6 2.6 0 0 1 5.2 0c0 1.2-0.7 2.3-1.9 3.1v0.9z" />
        <path d="M231.6 20.6h1.8" />
      </g>
      <text x={237} y={18.6} fontSize="5" fontWeight="700" fill="#fff">
        Suggest an Idea
      </text>
      {columns.map((col, i) => {
        const x = 16 + i * 92;
        return (
          <g key={col.name}>
            <rect
              x={x}
              y={28}
              width={88}
              height={61}
              rx="5"
              className="fill-slate-100/80 dark:fill-slate-800/70"
            />
            <text
              x={x + 5}
              y={36}
              fontSize="4.4"
              fontWeight="700"
              letterSpacing="0.3"
              className="fill-slate-700 dark:fill-slate-200"
            >
              {col.name.toUpperCase()}
            </text>
            <rect
              x={x + 76}
              y={31.6}
              width={8}
              height={5.8}
              rx="2.9"
              className="fill-slate-900/[0.06] dark:fill-white/10"
            />
            <text
              x={x + 80}
              y={35.8}
              fontSize="4"
              fontWeight="600"
              textAnchor="middle"
              className="fill-slate-600 dark:fill-slate-300"
            >
              {col.count}
            </text>
            {col.cards.map((card, r) => (
              <RoadmapItem
                key={card.num}
                x={x + 4}
                y={40 + r * 24}
                card={card}
                voting={i === 0 && r === 0}
              />
            ))}
          </g>
        );
      })}
    </Scene>
  );
}

/** A paperclip and a count, as a card's Attachments pill draws it. */
function AttachmentsPill({ x, y, count }: { x: number; y: number; count: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="13"
        height="6.4"
        rx="1.6"
        className="fill-slate-100 dark:fill-slate-700"
      />
      <path
        d={`M${x + 4.4} ${y + 2.2}v2.4a0.9 0.9 0 0 1 -1.8 0v-2.8a1.5 1.5 0 0 1 3 0v2.6`}
        fill="none"
        className="stroke-slate-500 dark:stroke-slate-300"
        strokeWidth="0.55"
        strokeLinecap="round"
      />
      <text
        x={x + 7.4}
        y={y + 4.8}
        fontSize="4"
        fontWeight="600"
        className="fill-slate-600 dark:fill-slate-300"
      >
        {count}
      </text>
    </g>
  );
}

/** Email to Board: a bug report sent to the board's secret address lands as a card at the top of its first column,
 *  the subject as its title and the screenshot attached. */
export function EmailToBoardArt() {
  return (
    <Scene>
      {/* The message, as a mail app shows it. */}
      <Panel x={10} y={8} w={142} h={80} />
      <text className={MUTED} x={18} y={19} fontSize="4.6" fontWeight="600">
        To
      </text>
      <text className={TEXT} x={40} y={19} fontSize="4.8" fontWeight="600">
        board+k4x9q2…@in.liveplanner.app
      </text>
      <path className={RULE} d="M18 23h126" strokeWidth="0.6" />
      <text className={MUTED} x={18} y={31} fontSize="4.6" fontWeight="600">
        Subject
      </text>
      <text className={TEXT} x={40} y={31} fontSize="5.2" fontWeight="700">
        Checkout button broken
      </text>
      <path className={RULE} d="M18 35h126" strokeWidth="0.6" />
      <text className={TEXT} x={18} y={44} fontSize="4.6">
        Pay does nothing on Safari 18 after
      </text>
      <text className={TEXT} x={18} y={50.5} fontSize="4.6">
        the address step. Screenshot attached.
      </text>
      {/* The screenshot. */}
      <rect
        x={18}
        y={56}
        width={40}
        height={25}
        rx="2"
        className="fill-sky-50 stroke-sky-200 dark:fill-sky-500/15 dark:stroke-sky-500/40"
        strokeWidth="0.6"
      />
      <rect
        x={22}
        y={60}
        width={20}
        height={2.4}
        rx="1.2"
        className="fill-sky-300 dark:fill-sky-400/60"
      />
      <rect
        x={22}
        y={65}
        width={32}
        height={6}
        rx="1.5"
        className="fill-white dark:fill-sky-500/20"
      />
      <rect x={40} y={73} width={14} height={5} rx="1.5" className="fill-sky-500" />
      <text className={MUTED} x={62} y={71} fontSize="4.4">
        checkout.png
      </text>
      <text className={MUTED} x={62} y={77} fontSize="4">
        240 KB
      </text>
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.3)}
        d="M156 48h12"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <path className="fa-a-in fill-(--art-arrow)" style={at(0.3)} d="M171 48l-3.4-2.2v4.4z" />
      {/* The board's first column, the new card at its top. */}
      <rect
        x={176}
        y={8}
        width={114}
        height={80}
        rx="5"
        className="fill-slate-100 dark:fill-slate-800/80"
      />
      <text className={TEXT} x={182} y={18} fontSize="5.6" fontWeight="700">
        To Do
        <tspan className={MUTED} fontWeight="600" dx="3">
          3
        </tspan>
      </text>
      <g className="fa-a-move" style={from(-28, 0, 0.5)}>
        <g className="fa-a-in" style={at(0.5)}>
          <PlanCard
            x={181}
            y={23}
            w={104}
            title="Checkout button broken"
            id="TSK-42"
            ring="#a78bfa"
          />
          <AttachmentsPill x={208} y={34.6} count={1} />
        </g>
      </g>
      <PlanCard x={181} y={46} w={104} title="Press kit" id="TSK-31" who={SM} />
      <PlanCard x={181} y={67} w={104} title="Release notes" id="TSK-23" type="note" who={TM} />
    </Scene>
  );
}

/** A preset's small drawing of its layout: a row per person, or each column sorted strongest first. */
function PresetThumb({
  x,
  y,
  kind,
  on,
}: {
  x: number;
  y: number;
  kind: 'people' | 'sorted';
  on?: boolean;
}) {
  const ink = on ? 'fill-brand-600 dark:fill-brand-300' : 'fill-slate-400 dark:fill-slate-500';
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={22}
        height={17}
        rx="2"
        className={on ? 'fill-white dark:fill-slate-900' : 'fill-slate-100 dark:fill-slate-800'}
      />
      {[0, 1, 2].map((c) =>
        kind === 'people'
          ? [0, 1, 2].map((r) => (
              <g key={`${c}-${r}`}>
                {c === 0 ? (
                  <circle cx={x + 2.6} cy={y + 3.2 + r * 5.3} r="1" className={ink} />
                ) : null}
                <rect
                  x={x + 5 + c * 5.6}
                  y={y + 2.2 + r * 5.3}
                  width="4.4"
                  height="2.2"
                  rx="0.6"
                  className={ink}
                  opacity={(c + r) % 3 === 2 ? 0 : 0.7}
                />
              </g>
            ))
          : [0, 1, 2].map((r) => (
              <rect
                key={`${c}-${r}`}
                x={x + 2 + c * 6.6}
                y={y + 2.4 + r * 4.4}
                width="5.2"
                height="3.2"
                rx="0.7"
                className={ink}
                opacity={0.9 - r * 0.28}
              />
            )),
      )}
    </g>
  );
}

/** A board set up in one click: Configure Board's suggestions, each with why it suits this board's cards, one
 *  picked, and the Fine-Tune tiles under them, Sort Cards now saying what the preset set. */
export function ConfigureBoardArt() {
  const presets = [
    { title: 'By Person', reason: '5 of 8 cards have someone on them', kind: 'people' as const },
    { title: 'Most Urgent First', reason: '6 of 8 cards have a priority', kind: 'sorted' as const },
    { title: 'Quick Wins First', reason: '7 of 8 cards have an estimate', kind: 'sorted' as const },
  ];
  const card = (i: number, on: boolean) => {
    const p = presets[i]!;
    const x = 18 + i * 89;
    return (
      <g>
        <rect
          x={x}
          y={32}
          width={86}
          height={25}
          rx="3.5"
          className={
            on
              ? 'fill-brand-50 stroke-brand-400 dark:fill-brand-500/15 dark:stroke-brand-500'
              : 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700'
          }
          strokeWidth={on ? 0.9 : 0.6}
        />
        <PresetThumb x={x + 3} y={36} kind={p.kind} on={on} />
        <text className={TEXT} x={x + 28} y={41.8} fontSize="5.2" fontWeight="700">
          {p.title}
        </text>
        <text className={MUTED} x={x + 28} y={48.6} fontSize="4" fontWeight="500">
          {p.reason.split(' have ')[0]}
        </text>
        <text className={MUTED} x={x + 28} y={53.6} fontSize="4" fontWeight="500">
          {`have ${p.reason.split(' have ')[1]}`}
        </text>
      </g>
    );
  };
  const tiles = [
    { title: 'Columns', summary: '4 columns' },
    { title: 'Swimlanes', summary: 'No rows' },
  ];
  const tile = (x: number, title: string, summary: string) => (
    <g>
      <rect
        x={x}
        y={66}
        width={86}
        height={21}
        rx="3.5"
        className="fill-white stroke-slate-200 dark:fill-slate-800/40 dark:stroke-slate-700"
        strokeWidth="0.6"
      />
      <rect
        x={x + 4}
        y={70.5}
        width={12}
        height={12}
        rx="2.5"
        className="fill-slate-100 dark:fill-slate-800"
      />
      <g className="fill-slate-400 dark:fill-slate-400">
        <rect x={x + 6.6} y={73} width="2" height="7" rx="0.6" />
        <rect x={x + 9.2} y={73} width="2" height="5" rx="0.6" />
        <rect x={x + 11.8} y={73} width="2" height="6" rx="0.6" />
      </g>
      <text className={TEXT} x={x + 20} y={75} fontSize="5" fontWeight="600">
        {title}
      </text>
      <text className={MUTED} x={x + 20} y={81.6} fontSize="4">
        {summary}
      </text>
      <path
        d={`M${x + 78} 75.4l2 2 2-2`}
        fill="none"
        className="stroke-slate-400"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
  return (
    <Scene>
      <Panel x={10} y={4} w={280} h={88} />
      <text className={TEXT} x={18} y={14} fontSize="6.8" fontWeight="700">
        Configure Board
      </text>
      <text className={MUTED} x={18} y={21} fontSize="4.4">
        Start from a layout that suits your cards, then fine-tune any part of it.
      </text>
      <text className={MUTED} x={18} y={29} fontSize="3.8" fontWeight="700" letterSpacing="0.4">
        SUGGESTED FOR THIS BOARD
      </text>
      {card(0, false)}
      <g className="fa-a-out" style={at(0.2)}>
        {card(1, false)}
      </g>
      <g className="fa-a-late" style={at(0.2)}>
        {card(1, true)}
      </g>
      {card(2, false)}
      <text className={MUTED} x={18} y={63} fontSize="3.8" fontWeight="700" letterSpacing="0.4">
        FINE-TUNE
      </text>
      {tiles.map((t, i) => (
        <g key={t.title}>{tile(18 + i * 89, t.title, t.summary)}</g>
      ))}
      <g className="fa-a-out" style={at(0.2)}>
        {tile(196, 'Sort Cards', 'In the order you put them')}
      </g>
      <g className="fa-a-late" style={at(0.2)}>
        {tile(196, 'Sort Cards', 'Priority, then Due Date')}
      </g>
      <Pointer x={184} y={46} color={YOU} className="fa-a-move" style={from(60, 30, 0)} />
    </Scene>
  );
}
