import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The Dashboards scene (docs/specs/019-marketing/marketing-site.md "Feature scenes"): a product launch's
// Dashboard tab (docs/specs/026-plan/plan-tabs.md) filling its tab, rows of live slots side by side. Its slots
// land row by row: three figures (Completion, Due this week, Budget left), then the launch board beside a chart
// of cards by status, then a checklist and the key date. A teammate carries a card from Doing to Done on the
// board slot and the chart's Done bar grows to match; you tick the last open item on the checklist, and
// Completion ticks over. Every piece plays at its own --d (hero-mode-animations.css); a phone draws the same
// dashboard smaller.

// The script, in seconds.
const T = {
  surface: 0.1,
  figures: 0.4, // the first figure; the rest follow 0.15s apart
  board: 1.0,
  cards: 1.3, // the first card; the rest follow 0.08s apart
  chart: 1.4,
  bars: 1.7,
  lower: 2.2,
  teammate: 3.2,
  carry: 4.0,
  done: 4.6,
  you: 5.4,
  tick: 6.2,
  completion: 6.4,
} as const;

// The dashboard's grid: three rows, 12 px between slots, filling the canvas from its left edge.
const X0 = -50;
const W = 690;
const GAP = 12;
const ROW = [
  { y: -48, h: 58 },
  { y: 20, h: 160 },
  { y: 192, h: 104 },
] as const;

const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
const SURFACE = 'fill-slate-50 dark:fill-slate-950';
const TITLE = 'fill-slate-500 dark:fill-slate-400';
const INK = 'fill-(--art-text) dark:fill-slate-100';

function Slot({
  x,
  y,
  w,
  h,
  title,
  d,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  d: number;
}) {
  return (
    <g className="hm-pop" style={at(d)}>
      <rect x={x} y={y} width={w} height={h} rx="8" className={PANEL} strokeWidth="0.8" />
      <text
        x={x + 12}
        y={y + 17}
        fontFamily={FONT}
        fontSize="8.5"
        fontWeight="600"
        className={TITLE}
      >
        {title}
      </text>
    </g>
  );
}

// Row 1: three figures, each a slot of its own.
const FIGURE_W = (W - 2 * GAP) / 3;
const figureX = (i: number) => X0 + i * (FIGURE_W + GAP);

function Figures() {
  const y = ROW[0].y;
  const h = ROW[0].h;
  return (
    <>
      <Slot x={figureX(0)} y={y} w={FIGURE_W} h={h} title="Completion" d={T.figures} />
      <g className="hm-out" style={at(T.completion - 0.05)}>
        <text
          x={figureX(0) + 12}
          y={y + 46}
          fontFamily={FONT}
          fontSize="20"
          fontWeight="700"
          className={`hm-pop ${INK}`}
          style={at(T.figures + 0.1)}
        >
          58%
        </text>
      </g>
      <text
        x={figureX(0) + 12}
        y={y + 46}
        fontFamily={FONT}
        fontSize="20"
        fontWeight="700"
        className={`hm-pop ${INK}`}
        style={at(T.completion)}
      >
        67%
      </text>
      {/* The ring beside the figure, filling to match. */}
      <circle
        cx={figureX(0) + FIGURE_W - 30}
        cy={y + 34}
        r="14"
        fill="none"
        strokeWidth="4"
        className="hm-pop stroke-slate-200 dark:stroke-slate-700"
        style={at(T.figures)}
      />
      <circle
        cx={figureX(0) + FIGURE_W - 30}
        cy={y + 34}
        r="14"
        fill="none"
        stroke="#10b981"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="59 88"
        transform={`rotate(-90 ${figureX(0) + FIGURE_W - 30} ${y + 34})`}
        className="hm-pop"
        style={at(T.figures + 0.1)}
      />

      <Slot x={figureX(1)} y={y} w={FIGURE_W} h={h} title="Due this week" d={T.figures + 0.15} />
      <text
        x={figureX(1) + 12}
        y={y + 46}
        fontFamily={FONT}
        fontSize="20"
        fontWeight="700"
        className={`hm-pop ${INK}`}
        style={at(T.figures + 0.25)}
      >
        4
      </text>
      <text
        x={figureX(1) + 30}
        y={y + 46}
        fontFamily={FONT}
        fontSize="9"
        className={`hm-pop ${TITLE}`}
        style={at(T.figures + 0.25)}
      >
        cards, 1 overdue
      </text>

      <Slot x={figureX(2)} y={y} w={FIGURE_W} h={h} title="Budget left" d={T.figures + 0.3} />
      <text
        x={figureX(2) + 12}
        y={y + 46}
        fontFamily={FONT}
        fontSize="20"
        fontWeight="700"
        className={`hm-pop ${INK}`}
        style={at(T.figures + 0.4)}
      >
        £12,400
      </text>
    </>
  );
}

// Row 2, left: the launch board, live in its slot, three columns of cards.
const BOARD = { x: X0, w: 400 };
const COLS = ['To do', 'Doing', 'Done'] as const;
const COL_W = (BOARD.w - 24 - 2 * 8) / 3;
const colX = (c: number) => BOARD.x + 12 + c * (COL_W + 8);
const CARD_H = 26;
const cardY = (s: number) => ROW[1].y + 48 + s * (CARD_H + 6);

const CARDS: { col: number; slot: number; title: string; tone: string }[] = [
  { col: 0, slot: 0, title: 'Press kit', tone: '#f59e0b' },
  { col: 0, slot: 1, title: 'Pricing page', tone: '#8b5cf6' },
  { col: 0, slot: 2, title: 'Launch email', tone: '#ec4899' },
  { col: 1, slot: 0, title: 'Demo video', tone: '#8b5cf6' },
  { col: 2, slot: 0, title: 'Beta invites', tone: '#10b981' },
  { col: 2, slot: 1, title: 'Help articles', tone: '#10b981' },
];
// The card the teammate carries: Doing's second, over to Done's third slot.
const CARRIED = { col: 1, slot: 1, title: 'Release notes', tone: '#f59e0b' };

function Card({ x, y, title, tone }: { x: number; y: number; title: string; tone: string }) {
  return (
    <>
      <rect x={x} y={y} width={COL_W} height={CARD_H} rx="5" className={PANEL} strokeWidth="0.8" />
      <rect x={x} y={y + 5} width="3" height={CARD_H - 10} rx="1.5" fill={tone} />
      <text
        x={x + 9}
        y={y + 16.5}
        fontFamily={FONT}
        fontSize="8.5"
        fontWeight="500"
        className={INK}
      >
        {title}
      </text>
    </>
  );
}

function BoardSlot() {
  const y = ROW[1].y;
  const dx = colX(2) - colX(1);
  const dy = cardY(2) - cardY(1);
  return (
    <>
      <Slot x={BOARD.x} y={y} w={BOARD.w} h={ROW[1].h} title="Launch board" d={T.board} />
      {COLS.map((name, c) => (
        <g key={name} className="hm-fade" style={at(T.board + 0.1)}>
          <rect
            x={colX(c)}
            y={y + 26}
            width={COL_W}
            height={ROW[1].h - 36}
            rx="6"
            className="fill-slate-100 dark:fill-slate-800"
          />
          <text
            x={colX(c) + 8}
            y={y + 40}
            fontFamily={FONT}
            fontSize="8"
            fontWeight="600"
            className={TITLE}
          >
            {name}
          </text>
        </g>
      ))}
      {CARDS.map((card, i) => (
        <g key={card.title} className="hm-pop" style={at(T.cards + i * 0.08)}>
          <Card x={colX(card.col) + 0} y={cardY(card.slot)} title={card.title} tone={card.tone} />
        </g>
      ))}
      {/* The teammate's card, ringed in their colour while they carry it across. */}
      <g className="hm-pop" style={at(T.cards + CARDS.length * 0.08)}>
        <g className="hm-move" style={at(T.carry, { '--dx': `${dx}px`, '--dy': `${dy}px` })}>
          <Card
            x={colX(CARRIED.col)}
            y={cardY(CARRIED.slot)}
            title={CARRIED.title}
            tone={CARRIED.tone}
          />
          <g className="hm-out" style={at(T.done)}>
            <rect
              className="hm-fade"
              style={at(T.teammate + 0.6)}
              x={colX(CARRIED.col) - 1.5}
              y={cardY(CARRIED.slot) - 1.5}
              width={COL_W + 3}
              height={CARD_H + 3}
              rx="6"
              fill="none"
              stroke={TEAMMATE}
              strokeWidth="1.5"
            />
          </g>
        </g>
      </g>
      <g
        className="hm-cursor"
        style={at(T.teammate, {
          '--sx': '360px',
          '--sy': '330px',
          '--cx': `${colX(CARRIED.col) + COL_W - 20}px`,
          '--cy': `${cardY(CARRIED.slot) + 16}px`,
        })}
        aria-hidden
      >
        <g className="hm-move" style={at(T.carry, { '--dx': `${dx}px`, '--dy': `${dy}px` })}>
          <CursorMark colour={TEAMMATE} label="Maya" badge="name" />
        </g>
      </g>
    </>
  );
}

// Row 2, right: cards by status, drawn from the same cards, so Done grows when the card lands.
const CHART = { x: X0 + BOARD.w + GAP, w: W - BOARD.w - GAP };
const BARS = [
  { name: 'To do', n: 3, colour: '#94a3b8' },
  { name: 'Doing', n: 2, colour: '#f59e0b' },
  { name: 'Done', n: 2, colour: '#10b981' },
] as const;
const UNIT = 30;

function ChartSlot() {
  const y = ROW[1].y;
  const base = y + ROW[1].h - 24;
  const bw = 40;
  const barX = (i: number) => CHART.x + (CHART.w - (2 * 64 + bw)) / 2 + i * 64;
  return (
    <>
      <Slot x={CHART.x} y={y} w={CHART.w} h={ROW[1].h} title="Cards by status" d={T.chart} />
      <path
        d={`M${CHART.x + 16} ${base}H${CHART.x + CHART.w - 16}`}
        className="stroke-slate-200 dark:stroke-slate-700"
        strokeWidth="0.8"
      />
      {BARS.map((bar, i) => {
        // Doing's top unit is the carried card: it leaves as the card lands in Done.
        const leaving = bar.name === 'Doing';
        const h = (leaving ? bar.n - 1 : bar.n) * UNIT;
        return (
          <g key={bar.name}>
            <rect
              className="hm-grow"
              style={at(T.bars + i * 0.1)}
              x={barX(i)}
              y={base - h}
              width={bw}
              height={h}
              rx="3"
              fill={bar.colour}
            />
            {leaving ? (
              <g className="hm-out" style={at(T.done)}>
                <rect
                  className="hm-grow"
                  style={at(T.bars + i * 0.1)}
                  x={barX(i)}
                  y={base - bar.n * UNIT}
                  width={bw}
                  height={UNIT + 3}
                  rx="3"
                  fill={bar.colour}
                />
              </g>
            ) : null}
            <text
              x={barX(i) + bw / 2}
              y={base + 13}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="8"
              className={`hm-fade ${TITLE}`}
              style={at(T.bars + i * 0.1)}
            >
              {bar.name}
            </text>
          </g>
        );
      })}
      {/* As the card lands in Done, Done gains a unit. */}
      <rect
        className="hm-grow"
        style={at(T.done)}
        x={barX(2)}
        y={base - 3 * UNIT}
        width={bw}
        height={UNIT + 3}
        rx="3"
        fill="#10b981"
      />
    </>
  );
}

// Row 3: the launch checklist and the key date.
const CHECK = { x: X0, w: 420 };
const ITEMS = ['Pricing signed off', 'Support rota set', 'Launch post scheduled'] as const;

function LowerRow() {
  const y = ROW[2].y;
  const dateX = X0 + CHECK.w + GAP;
  const dateW = W - CHECK.w - GAP;
  return (
    <>
      <Slot x={CHECK.x} y={y} w={CHECK.w} h={ROW[2].h} title="Launch checklist" d={T.lower} />
      {ITEMS.map((item, i) => {
        const iy = y + 38 + i * 24;
        const done = i < 2;
        return (
          <g key={item} className="hm-pop" style={at(T.lower + 0.1 + i * 0.08)}>
            <rect
              x={CHECK.x + 14}
              y={iy - 9}
              width="12"
              height="12"
              rx="3"
              fill={done ? '#10b981' : 'none'}
              className={done ? '' : 'stroke-slate-300 dark:stroke-slate-600'}
              strokeWidth="1.2"
            />
            {done ? (
              <path
                d={`M${CHECK.x + 17} ${iy - 3}l2.5 2.5 4.5 -5`}
                stroke="white"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
            ) : null}
            <text x={CHECK.x + 34} y={iy + 1} fontFamily={FONT} fontSize="9.5" className={INK}>
              {item}
            </text>
          </g>
        );
      })}
      {/* You tick the last item. */}
      <g className="hm-pop" style={at(T.tick)}>
        <rect x={CHECK.x + 14} y={y + 38 + 48 - 9} width="12" height="12" rx="3" fill="#10b981" />
        <path
          d={`M${CHECK.x + 17} ${y + 38 + 48 - 3}l2.5 2.5 4.5 -5`}
          stroke="white"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <g
        className="hm-cursor"
        style={at(T.you, {
          '--sx': '520px',
          '--sy': '120px',
          '--cx': `${CHECK.x + 22}px`,
          '--cy': `${y + 38 + 48}px`,
        })}
        aria-hidden
      >
        <CursorMark colour={YOU} label="You" badge="name" />
      </g>

      <Slot x={dateX} y={y} w={dateW} h={ROW[2].h} title="Key date" d={T.lower + 0.15} />
      <g className="hm-pop" style={at(T.lower + 0.3)}>
        <rect
          x={dateX + 14}
          y={y + 32}
          width="46"
          height="50"
          rx="6"
          fill={YOU}
          fillOpacity="0.12"
          stroke={YOU}
          strokeWidth="1"
        />
        <text
          x={dateX + 37}
          y={y + 48}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="8"
          fontWeight="700"
          fill={YOU}
        >
          NOV
        </text>
        <text
          x={dateX + 37}
          y={y + 72}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="18"
          fontWeight="700"
          className={INK}
        >
          14
        </text>
        <text
          x={dateX + 72}
          y={y + 52}
          fontFamily={FONT}
          fontSize="10"
          fontWeight="600"
          className={INK}
        >
          Launch day
        </text>
        <text x={dateX + 72} y={y + 68} fontFamily={FONT} fontSize="8.5" className={TITLE}>
          in 24 days
        </text>
      </g>
    </>
  );
}

function Dashboard() {
  return (
    <>
      <rect
        className={`hm-fade ${SURFACE}`}
        style={at(T.surface)}
        x="-600"
        y="-60"
        width="1800"
        height="900"
      />
      <Figures />
      <BoardSlot />
      <ChartSlot />
      <LowerRow />
    </>
  );
}

export function DashboardBoard({ portrait = false }: { portrait?: boolean }) {
  // A phone draws the same dashboard smaller, its right-hand slots running past the screen's edge.
  return portrait ? (
    <g transform="translate(10 30) scale(0.6)">
      <Dashboard />
    </g>
  ) : (
    <Dashboard />
  );
}
