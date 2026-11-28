// Feature illustrations for Session tabs (docs/specs/026-plan/session-tabs.md): the page with the queue beside the
// room's card and the Refined fill button playing, then one card per kind: Refinement moving a card on, a Stand-up
// person by person, Sprint Planning's tally filling, Bug Triage's close with a reason, and Sprint Review's demo strip
// gathering feedback. Each draws the real surface small. Motion reuses the canvas card timeline (fa-a-* in
// app/feature-art/canvas.css) and the fill button's own loop (fa-s-* in app/feature-art/features.css); every piece
// settles to its finished frame under reduced motion.
import {
  Avatar,
  JORDAN,
  MUTED,
  Panel,
  Pill,
  RULE,
  SAM,
  Scene,
  TEXT,
  at,
  from,
} from './canvas-parts';
import { ACCENT, BarButton, FillButton, Progress, Row, TINT } from './plan-session-parts';
import { TYPE } from './plan-parts';

/** Session tabs: the queue beside the room's card, the facilitator's action bar, and Refined filling as it confirms. */
export function SessionTabsArt() {
  return (
    <Scene>
      <Panel x={10} y={6} w={98} h={84} />
      <text className={TEXT} x={17} y={17} fontSize="6.4" fontWeight="700">
        Refinement
      </text>
      <text className={MUTED} x={60} y={17} fontSize="5.2" fontWeight="600">
        4 of 9
      </text>
      <Progress
        x={17}
        y={22}
        w={84}
        segments={['done', 'skip', 'flag', 'current', 'todo', 'todo', 'todo', 'todo', 'todo']}
      />
      <Row x={14} y={29} w={90} n={1} title="Export to CSV" mark="tick" />
      <Row x={14} y={43} w={90} n={2} title="Dark mode" mark="skip" />
      <Row x={14} y={57} w={90} n={3} title="SSO sign-in" mark="flag" edge={TYPE.bug} />
      <Row x={14} y={71} w={90} n={4} title="Retry payments" current />
      <Panel x={116} y={6} w={174} h={60} />
      <text className={MUTED} x={124} y={17} fontSize="5" fontWeight="600">
        WI-21 · Backlog
      </text>
      <text className={TEXT} x={124} y={27} fontSize="7" fontWeight="700">
        Retry failed payments
      </text>
      <rect
        className="fill-slate-200 dark:fill-slate-700"
        x={124}
        y={34}
        width={140}
        height="3"
        rx="1.5"
      />
      <rect
        className="fill-slate-200 dark:fill-slate-700"
        x={124}
        y={41}
        width={120}
        height="3"
        rx="1.5"
      />
      <rect
        className="fill-slate-100 dark:fill-slate-700/60"
        x={124}
        y={51}
        width={90}
        height="3"
        rx="1.5"
      />
      <BarButton x={116} y={74} w={30} label="Skip" mark="skip" />
      <BarButton x={149} y={74} w={30} label="Flag" mark="flag" />
      <text className={MUTED} x={184} y={83} fontSize="5" fontWeight="600">
        Moves to Ready
      </text>
      <FillButton x={240} y={74} w={50} label="Refined" />
    </Scene>
  );
}

/** Refinement: the room's card sharpened (its estimate filled in), then Refined carries it from Backlog to Ready. */
export function RefinementArt() {
  return (
    <Scene>
      {[
        { x: 14, name: 'Backlog', count: '12' },
        { x: 162, name: 'Ready', count: '5' },
      ].map((c) => (
        <g key={c.name}>
          <rect
            className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/70 dark:stroke-slate-700"
            x={c.x}
            y={8}
            width={124}
            height={80}
            rx="5"
            strokeWidth="0.6"
          />
          <text className={TEXT} x={c.x + 8} y={19} fontSize="6.2" fontWeight="700">
            {c.name}
          </text>
          <text
            className={MUTED}
            x={c.x + 116}
            y={19}
            fontSize="5.4"
            fontWeight="600"
            textAnchor="end"
          >
            {c.count}
          </text>
        </g>
      ))}
      <path
        className="stroke-slate-300 dark:stroke-slate-600"
        d="M142 48h16 m-3 -3 3 3 -3 3"
        fill="none"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g className="fa-a-move" style={from(-148, 0, 0.4)}>
        <rect
          className={`${TINT}`}
          x={170}
          y={26}
          width={108}
          height={28}
          rx="4"
          strokeWidth="0.8"
        />
        <rect x={170} y={29} width="1.6" height="22" rx="0.8" fill={TYPE.task} />
        <text className={MUTED} x={176} y={35} fontSize="5" fontWeight="600">
          WI-21
        </text>
        <text className={TEXT} x={176} y={45} fontSize="6.4" fontWeight="700">
          Retry failed payments
        </text>
        <Pill x={252} y={30} w={20} label="5" tone="brand" />
      </g>
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        x={22}
        y={62}
        width={108}
        height={18}
        rx="4"
        strokeWidth="0.6"
      />
      <text className={TEXT} x={30} y={73.4} fontSize="6" fontWeight="600">
        Onboarding emails
      </text>
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        x={170}
        y={62}
        width={108}
        height={18}
        rx="4"
        strokeWidth="0.6"
      />
      <text className={TEXT} x={178} y={73.4} fontSize="6" fontWeight="600">
        Saved filters
      </text>
      <g className="fa-a-late" style={at(0)}>
        <Pill x={224} y={10} w={46} label="Refined" tone="brand" />
      </g>
    </Scene>
  );
}

/** Stand-up: the team person by person, Priya's cards unfolded, one marked Blocked with its reason, then Done. */
export function StandupArt() {
  const people = [
    { name: 'Sam', colour: SAM, cards: '2', done: true },
    { name: 'Priya', colour: JORDAN, cards: '3', open: true },
    { name: 'Alex', colour: '#f59e0b', cards: '1' },
  ];
  return (
    <Scene>
      <Panel x={10} y={6} w={104} h={84} />
      <text className={TEXT} x={17} y={17} fontSize="6.4" fontWeight="700">
        Stand-up
      </text>
      <text className={MUTED} x={50} y={17} fontSize="5.2" fontWeight="600">
        2 of 4 people
      </text>
      <Progress x={17} y={22} w={90} segments={['done', 'current', 'todo', 'todo']} />
      {people.map((p, i) => {
        const y = 28 + i * 16 + (i > 1 ? 12 : 0);
        return (
          <g key={p.name} opacity={p.done ? 0.6 : 1}>
            <rect
              className={p.open ? TINT : 'fill-none stroke-none'}
              x={14}
              y={y}
              width={96}
              height={14}
              rx="3"
              strokeWidth="0.6"
            />
            <Avatar cx={22} cy={y + 7} r={4.2} color={p.colour} initials={p.name[0]!} />
            <text className={TEXT} x={30} y={y + 9} fontSize="5.8" fontWeight="600">
              {p.name}
            </text>
            <text className={MUTED} x={104} y={y + 9} fontSize="5.2" textAnchor="end">
              {p.done ? '✓' : p.cards}
            </text>
          </g>
        );
      })}
      <text className={TEXT} x={30} y={65} fontSize="5">
        WI-41 · In Progress
      </text>
      <Panel x={122} y={6} w={168} h={52} />
      <text className={MUTED} x={130} y={17} fontSize="5" fontWeight="600">
        WI-41 · In Progress
      </text>
      <text className={TEXT} x={130} y={27} fontSize="7" fontWeight="700">
        Retry failed payments
      </text>
      <g className="fa-a-late" style={at(0)}>
        <path
          className="stroke-rose-600 dark:stroke-rose-400"
          d="M131 43v-6 M131 37h4l-1 1.5 1 1.5h-4"
          fill="none"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          className="fill-rose-700 dark:fill-rose-300"
          x={139}
          y={42}
          fontSize="5.4"
          fontWeight="600"
        >
          Blocked: Waiting on Review
        </text>
      </g>
      <text className={TEXT} x={122} y={70} fontSize="5.4" fontWeight="600">
        Priya · card 1 of 3
      </text>
      <BarButton x={122} y={76} w={40} label="Blocked" mark="flag" />
      <BarButton x={165} y={76} w={52} label="In Progress ▾" />
      <FillButton x={240} y={76} w={50} label="Done" />
    </Scene>
  );
}

/** Sprint Planning: the Estimate strip on the room's card, Commit, and the tally filling from 13 to 18 of 30 points. */
export function SprintPlanningArt() {
  const meter = 120;
  return (
    <Scene>
      <Panel x={10} y={6} w={136} h={84} />
      <text className={TEXT} x={18} y={18} fontSize="6.4" fontWeight="700">
        Sprint Planning
      </text>
      <text className={MUTED} x={18} y={32} fontSize="5.4" fontWeight="600">
        Committed
      </text>
      <g className="fa-a-out" style={at(0)}>
        <text className={TEXT} x={138} y={32} fontSize="5.4" fontWeight="600" textAnchor="end">
          13 of 30 points
        </text>
      </g>
      <g className="fa-a-late" style={at(0)}>
        <text className={TEXT} x={138} y={32} fontSize="5.4" fontWeight="600" textAnchor="end">
          18 of 30 points
        </text>
      </g>
      <rect
        className="fill-slate-100 dark:fill-slate-700"
        x={18}
        y={37}
        width={meter}
        height="4"
        rx="2"
      />
      <rect
        className="fill-brand-600 dark:fill-brand-400"
        x={18}
        y={37}
        width={(meter * 13) / 30}
        height="4"
        rx="2"
      />
      <rect
        className="fa-a-out fill-brand-200 dark:fill-brand-500/40"
        style={at(0)}
        x={18 + (meter * 13) / 30}
        y={37}
        width={(meter * 5) / 30}
        height="4"
      />
      <rect
        className="fa-a-late fill-brand-600 dark:fill-brand-400"
        style={at(0)}
        x={18 + (meter * 13) / 30 - 2}
        y={37}
        width={(meter * 5) / 30 + 2}
        height="4"
        rx="2"
      />
      {[
        { y: 48, title: 'Saved filters', est: '5', mark: 'tick' as const },
        { y: 62, title: 'Usage export', est: '5', current: true },
        { y: 76, title: 'Team invites', est: '?' },
      ].map((r, i) => (
        <g key={r.title}>
          <Row x={14} y={r.y} w={128} n={i + 1} title={r.title} mark={r.mark} current={r.current} />
          <rect
            className={
              r.est === '?'
                ? 'fill-none stroke-slate-300 dark:stroke-slate-500'
                : 'fill-slate-100 dark:fill-slate-700'
            }
            x={126}
            y={r.y + 3}
            width={12}
            height={7}
            rx="3.5"
            strokeWidth="0.6"
            strokeDasharray={r.est === '?' ? '1.5 1' : undefined}
          />
          <text
            className={MUTED}
            x={132}
            y={r.y + 8.2}
            fontSize="4.8"
            fontWeight="700"
            textAnchor="middle"
          >
            {r.est}
          </text>
        </g>
      ))}
      <Panel x={154} y={6} w={136} h={52} />
      <text className={MUTED} x={162} y={17} fontSize="5" fontWeight="600">
        ESTIMATE
      </text>
      {['1', '2', '3', '5', '8', '13', '21'].map((n, i) => (
        <g key={n}>
          <rect
            className={
              n === '5'
                ? TINT
                : 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600'
            }
            x={162 + i * 17}
            y={23}
            width={14}
            height={11}
            rx="5.5"
            strokeWidth="0.6"
          />
          <text
            className={TEXT}
            x={169 + i * 17}
            y={30.4}
            fontSize="5.2"
            fontWeight="600"
            textAnchor="middle"
          >
            {n}
          </text>
        </g>
      ))}
      <text className={MUTED} x={162} y={47} fontSize="5.2">
        Commit makes it 18 of 30
      </text>
      <BarButton x={154} y={70} w={30} label="Skip" mark="skip" />
      <text className={MUTED} x={189} y={79} fontSize="5" fontWeight="600">
        Moves to Selected
      </text>
      <FillButton x={240} y={70} w={50} label="Commit" />
    </Scene>
  );
}

/** Bug Triage: the bugs in the queue with their priorities, and Close Bug asking its reason, Can't Reproduce picked. */
export function BugTriageArt() {
  const bugs = [
    { title: 'Login loops', pri: 'Urgent', tone: 'red' as const, mark: 'tick' as const },
    { title: 'Typo on pricing', pri: 'Low', tone: 'slate' as const, mark: 'skip' as const },
    { title: 'Basket empties', pri: 'High', tone: 'amber' as const, current: true },
    { title: 'Slow search', pri: 'Med', tone: 'slate' as const },
  ];
  return (
    <Scene>
      <Panel x={10} y={6} w={112} h={84} />
      <text className={TEXT} x={17} y={17} fontSize="6.4" fontWeight="700">
        Bug Triage
      </text>
      <Progress x={17} y={22} w={98} segments={['done', 'skip', 'current', 'todo']} />
      {bugs.map((b, i) => (
        <g key={b.title}>
          <Row
            x={14}
            y={28 + i * 15}
            w={104}
            n={i + 1}
            title={b.title}
            mark={b.mark}
            current={b.current}
            edge={TYPE.bug}
          />
          <Pill x={88} y={29 + i * 15} w={28} label={b.pri} tone={b.tone} />
        </g>
      ))}
      <g className="fa-a-pop" style={at(0.6)}>
        <Panel x={132} y={6} w={158} h={84} />
        <text className={TEXT} x={140} y={18} fontSize="6.8" fontWeight="700">
          Close Bug
        </text>
        <text className={MUTED} x={174} y={18} fontSize="5.2">
          BUG-12 · Basket empties
        </text>
        <path className={RULE} d="M132 24h158" strokeWidth="0.6" />
        <rect
          className="fill-white stroke-brand-300 dark:fill-slate-900 dark:stroke-brand-500/60"
          x={140}
          y={30}
          width={142}
          height={13}
          rx="3"
          strokeWidth="0.7"
        />
        <text className={TEXT} x={145} y={38.6} fontSize="5.6">
          Can&apos;t reproduce
        </text>
        <Pill x={140} y={48} w={34} label="Won't Fix" />
        <Pill x={177} y={48} w={52} label="Can't Reproduce" tone="brand" />
        <Pill x={232} y={48} w={38} label="Duplicate" />
        <text className={MUTED} x={140} y={70} fontSize="5.2">
          Moves to Won&apos;t Fix
        </text>
        <rect className={ACCENT} x={240} y={72} width={42} height={12} rx="3" />
        <text
          className="fill-white"
          x={261}
          y={80}
          fontSize="5.6"
          fontWeight="700"
          textAnchor="middle"
        >
          Close Bug
        </text>
      </g>
    </Scene>
  );
}

/** Sprint Review: the demo strip (presenter, a merged pull request, a design), the room's feedback landing on the card
 *  as Review Feedback, and the Reviewed fill button. */
export function SprintReviewArt() {
  return (
    <Scene>
      <Panel x={10} y={6} w={280} h={60} />
      <rect
        className="fill-slate-50 dark:fill-slate-900/60"
        x={11}
        y={7}
        width={278}
        height={20}
        rx="5"
      />
      <Avatar cx={21} cy={17} r={5} color={JORDAN} initials="M" />
      <text className={TEXT} x={29} y={19} fontSize="5.8" fontWeight="600">
        Maya
      </text>
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        x={56}
        y={11}
        width={92}
        height={12}
        rx="3"
        strokeWidth="0.6"
      />
      <text className={TEXT} x={60} y={19.2} fontSize="5.2" fontWeight="700">
        #482
      </text>
      <rect
        className="fill-violet-100 dark:fill-violet-500/25"
        x={76}
        y={13.5}
        width={26}
        height={7}
        rx="3.5"
      />
      <text
        className="fill-violet-700 dark:fill-violet-200"
        x={89}
        y={18.6}
        fontSize="4.6"
        fontWeight="700"
        textAnchor="middle"
      >
        Merged
      </text>
      <text className={MUTED} x={106} y={19.2} fontSize="5.2">
        Dark mode
      </text>
      <rect
        className="fill-brand-100 stroke-slate-200 dark:fill-brand-500/25 dark:stroke-slate-600"
        x={156}
        y={10}
        width={26}
        height={14}
        rx="2"
        strokeWidth="0.6"
      />
      <path
        className="stroke-brand-400"
        d="M159 21l5-5 4 3 3-2 7 4"
        fill="none"
        strokeWidth="0.8"
      />
      <text className={MUTED} x={20} y={38} fontSize="5" fontWeight="600">
        WI-47 · Done
      </text>
      <text className={TEXT} x={20} y={48} fontSize="7" fontWeight="700">
        Dark mode for the dashboard
      </text>
      <g className="fa-a-late" style={at(0)}>
        <rect
          className="fill-brand-50 stroke-brand-200 dark:fill-brand-500/15 dark:stroke-brand-500/40"
          x={170}
          y={33}
          width={112}
          height={26}
          rx="4"
          strokeWidth="0.6"
        />
        <text
          className="fill-brand-700 dark:fill-brand-200"
          x={176}
          y={42}
          fontSize="4.8"
          fontWeight="700"
        >
          REVIEW FEEDBACK
        </text>
        <text className={TEXT} x={176} y={52} fontSize="5.4">
          Love it. Contrast on charts?
        </text>
      </g>
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        x={10}
        y={72}
        width={126}
        height={14}
        rx="3.5"
        strokeWidth="0.6"
      />
      <g className="fa-a-out" style={at(0)}>
        <text className={MUTED} x={15} y={81} fontSize="5.2">
          What did the room think?
        </text>
      </g>
      <BarButton x={140} y={72} w={50} label="Follow-up" />
      <FillButton x={240} y={72} w={50} label="Reviewed" />
    </Scene>
  );
}
