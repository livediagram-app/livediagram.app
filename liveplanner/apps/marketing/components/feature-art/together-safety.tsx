// Feature illustrations for working together across time and trouble: Walkthroughs (a narrated tour played back over
// the plan, packages/walkthrough/src/ui/Player.tsx), Snapshots of the whole plan (packages/snapshots/src/ui) and
// changes that wait out a dropped connection (docs/specs/007-editor/offline-changes.md, the editor's OfflineBanner).
// Each draws the real surface small: the player's bar, the Snapshots dialog's rows, the offline banner's own words.
// Motion reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished
// frame under reduced motion.
import { CLOCK_PATHS, Glyph, MUTED, Panel, RULE, Scene, TEXT, at, from } from './canvas-parts';
import { AK, JR, PlanCard, SM, TM, type Person, type TypeKey } from './plan-parts';

// The walkthrough player's presenter marks: a soft rose dot for their pointer, a rose ring round what they press.
const ROSE = '#f43f5e';
const DONE_GREEN = '#10b981';

type Card = { title: string; id: string; type?: TypeKey; who?: Person };

/** A small board of To Do, In Progress and Done, its cards as the board draws them. */
function MiniBoard({
  x,
  y,
  col = 62,
  gap = 6,
  columns,
}: {
  x: number;
  y: number;
  col?: number;
  gap?: number;
  columns: { name: string; count: string; cards: Card[] }[];
}) {
  return (
    <g>
      {columns.map((c, i) => {
        const cx = x + i * (col + gap);
        return (
          <g key={c.name}>
            <text className={TEXT} x={cx + 1} y={y + 5} fontSize="5.4" fontWeight="700">
              {c.name}
              <tspan className={MUTED} fontWeight="600" dx="3">
                {c.count}
              </tspan>
            </text>
            {c.cards.map((card, r) => (
              <PlanCard key={card.id} x={cx} y={y + 9 + r * 22} w={col} {...card} />
            ))}
          </g>
        );
      })}
    </g>
  );
}

/** Walkthroughs: a recorded tour plays over the plan itself, the presenter's camera in its round bubble, their
 *  pointer a soft dot and a ring round the card they open, under the player's bar. */
export function WalkthroughArt() {
  return (
    <Scene>
      <Panel x={10} y={6} w={280} h={84} />
      <MiniBoard
        x={18}
        y={11}
        columns={[
          {
            name: 'To Do',
            count: '2',
            cards: [
              { title: 'Press kit', id: 'TSK-31', who: SM },
              { title: 'Release notes', id: 'TSK-23', type: 'note' },
            ],
          },
          {
            name: 'In Progress',
            count: '2',
            cards: [
              { title: 'Checkout flow', id: 'TSK-27', who: JR },
              { title: 'Login bug', id: 'BUG-21', type: 'bug', who: AK },
            ],
          },
          {
            name: 'Done',
            count: '1',
            cards: [{ title: 'Pricing page', id: 'TSK-14', who: TM }],
          },
        ]}
      />
      {/* The ring the presenter's press leaves round the card they open. */}
      <rect
        className="fa-a-pop"
        style={at(1.6)}
        x={83}
        y={17}
        width={68}
        height={25}
        rx="4"
        fill="none"
        stroke={ROSE}
        strokeWidth="1.1"
      />
      {/* The presenter's pointer: a soft dot, gliding to the card. */}
      <g className="fa-a-move" style={from(-56, 26, 0.2)}>
        <circle cx={124} cy={36} r="4.2" fill={ROSE} fillOpacity="0.2" />
        <circle cx={124} cy={36} r="2.4" fill={ROSE} fillOpacity="0.85" />
      </g>
      {/* The camera bubble, round, in the corner the presenter chose. */}
      <circle cx={256} cy={31} r="19" className="fill-pink-100 dark:fill-pink-950" />
      <circle cx={256} cy={26.5} r="6.6" fill="#ec4899" fillOpacity="0.8" />
      <path
        d="M243.5 46 c2.5-9 22.5-9 25 0 a19 19 0 0 1 -25 0 z"
        fill="#ec4899"
        fillOpacity="0.8"
      />
      <circle
        cx={256}
        cy={31}
        r="19"
        fill="none"
        className="stroke-white dark:stroke-slate-800"
        strokeWidth="2"
      />
      {/* The player's bar: Pause, the title and the clock over the track with its tab marks, the speed, close. */}
      <Panel x={40} y={64} w={220} h={21} />
      <circle cx={51} cy={74.5} r="6" className="fill-brand-700" />
      <rect x={48.6} y={71.6} width="1.6" height="5.8" rx="0.5" fill="#fff" />
      <rect x={51.8} y={71.6} width="1.6" height="5.8" rx="0.5" fill="#fff" />
      <text className={TEXT} x={62} y={72.6} fontSize="5" fontWeight="600">
        Sprint 14 review
      </text>
      <text className={MUTED} x={226} y={72.6} fontSize="4.6" fontWeight="600" textAnchor="end">
        1:12 / 3:05
      </text>
      <rect
        x={62}
        y={77.4}
        width={164}
        height="1.6"
        rx="0.8"
        className="fill-slate-200 dark:fill-slate-700"
      />
      <rect x={62} y={77.4} width={64} height="1.6" rx="0.8" className="fill-brand-600" />
      {[96, 148, 190].map((x) => (
        <rect
          key={x}
          x={x - 0.4}
          y={76.2}
          width="0.8"
          height="4"
          rx="0.4"
          className="fill-slate-500 dark:fill-slate-300"
        />
      ))}
      <text className={MUTED} x={238} y={76.6} fontSize="4.8" fontWeight="700" textAnchor="middle">
        1x
      </text>
      <path
        d="M249 72.5l4 4m0-4l-4 4"
        className="stroke-slate-400"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </Scene>
  );
}

/** A small bin, as the Delete snapshot button draws it. */
function Bin({ x, y }: { x: number; y: number }) {
  return (
    <g
      className="stroke-slate-500 dark:stroke-slate-400"
      fill="none"
      strokeWidth="0.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={`M${x} ${y + 1.2}h5.4M${x + 1.8} ${y + 1.2}v-0.9h1.8v0.9`} />
      <path d={`M${x + 0.7} ${y + 1.2}l0.4 4.6h3.2l0.4-4.6`} />
    </g>
  );
}

/** Snapshots: the dialog's save points for the whole plan, one just taken before an import, each with Revert. */
export function SnapshotsArt() {
  const rows = [
    { name: 'Before the Trello import', meta: 'You · 2 mins ago · 84 KB' },
    { name: 'Sprint 14 planned', meta: 'Jordan · yesterday · 81 KB' },
    { name: 'Snapshot of 12 Nov, 09:30', meta: 'Sam · 6 days ago · 77 KB' },
  ];
  return (
    <Scene>
      <Panel x={10} y={4} w={280} h={88} />
      <text className={TEXT} x={20} y={15} fontSize="6.8" fontWeight="700">
        Snapshots
      </text>
      <text className={MUTED} x={20} y={22.6} fontSize="4.6">
        Save points for the whole plan. The latest 5 are kept.
      </text>
      {/* Take Snapshot with its optional name. */}
      <rect
        x={20}
        y={27}
        width={206}
        height={11}
        rx="2.5"
        className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
        strokeWidth="0.6"
      />
      <text className={MUTED} x={25} y={34.2} fontSize="4.8">
        Name this snapshot (optional)
      </text>
      <rect x={230} y={27} width={52} height={11} rx="2.5" className="fill-brand-700" />
      <text x={256} y={34.2} fontSize="5" fontWeight="700" textAnchor="middle" fill="#fff">
        Take Snapshot
      </text>
      <path className={RULE} d="M10 42.5h280" strokeWidth="0.6" />
      {rows.map((r, i) => {
        const y = 45 + i * 15;
        const row = (
          <g>
            <text className={TEXT} x={20} y={y + 6} fontSize="5.6" fontWeight="600">
              {r.name}
            </text>
            <text className={MUTED} x={20} y={y + 12} fontSize="4.5">
              {r.meta}
            </text>
            <rect
              x={244}
              y={y + 2}
              width={26}
              height={10}
              rx="2.5"
              className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
              strokeWidth="0.6"
            />
            <text
              x={257}
              y={y + 8.6}
              fontSize="4.8"
              fontWeight="600"
              textAnchor="middle"
              className="fill-slate-700 dark:fill-slate-200"
            >
              Revert
            </text>
            <Bin x={274.5} y={y + 4} />
          </g>
        );
        return i === 0 ? (
          <g key={r.name} className="fa-a-pop" style={at(0.4)}>
            <rect
              x={14}
              y={y - 1}
              width={272}
              height={15}
              rx="3"
              className="fill-brand-50 dark:fill-brand-500/10"
            />
            {row}
          </g>
        ) : (
          <g key={r.name}>{row}</g>
        );
      })}
    </Scene>
  );
}

/** The waiting mark on a card moved offline: a clock until the save lands, then a tick. */
function Waiting({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g>
      <g className="fa-a-out" style={at(delay)}>
        <circle cx={x} cy={y} r="3.6" className="fill-white dark:fill-slate-800" />
        <Glyph x={x - 3.6} y={y - 3.6} scale={0.72} className="stroke-amber-500">
          {CLOCK_PATHS}
        </Glyph>
      </g>
      <g className="fa-a-late" style={at(delay)}>
        <circle cx={x} cy={y} r="3.4" fill={DONE_GREEN} />
        <path
          d={`M${x - 1.6} ${y}l1.1 1.1 2.1-2.3`}
          fill="none"
          stroke="#fff"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/** Changes that wait: offline, two cards moved wait in this browser, then save the moment the connection is back. */
export function OfflineSaveArt() {
  const banner = (text: string) => (
    <g>
      <Panel x={46} y={8} w={208} h={12} />
      <text className={TEXT} x={150} y={15.8} fontSize="4.9" fontWeight="600" textAnchor="middle">
        {text}
      </text>
    </g>
  );
  return (
    <Scene>
      <MiniBoard
        x={24}
        y={25}
        col={80}
        gap={6}
        columns={[
          {
            name: 'To Do',
            count: '1',
            cards: [{ title: 'Press kit', id: 'TSK-31', who: SM }],
          },
          {
            name: 'In Progress',
            count: '2',
            cards: [
              { title: 'Checkout flow', id: 'TSK-27', who: JR },
              { title: 'Beta invites', id: 'TSK-16', who: TM },
            ],
          },
          {
            name: 'Done',
            count: '2',
            cards: [
              { title: 'Pricing page', id: 'TSK-14', who: AK },
              { title: 'Login bug', id: 'BUG-21', type: 'bug', who: JR },
            ],
          },
        ]}
      />
      <Waiting x={185} y={60} delay={0} />
      <Waiting x={271} y={60} delay={0.25} />
      <g className="fa-a-out">
        {banner('You’re offline. 2 changes wait in this browser and save when you reconnect.')}
      </g>
      <g className="fa-a-late">{banner('Saving 2 changes made without a connection.')}</g>
    </Scene>
  );
}
