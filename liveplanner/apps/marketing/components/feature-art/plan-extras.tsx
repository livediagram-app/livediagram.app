// Feature illustrations for the plan features that reach past the board itself: card templates, a card's Activity,
// Describe a Plan (docs/specs/026-plan/describe-a-plan.md), pull requests on cards
// (docs/specs/026-plan/github-pull-requests.md), the calendar feed (docs/specs/026-plan/calendar-feed.md) and connected
// files. Motion reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished
// frame under reduced motion.
import {
  ALEX,
  Avatar,
  CLOCK_PATHS,
  Glyph,
  JORDAN,
  LINE,
  LINK_PATHS,
  MUTED,
  Panel,
  Pill,
  RULE,
  SAM,
  Scene,
  TEXT,
  YOU,
  at,
  from,
} from './canvas-parts';
import { THEN, WHEN } from './automations';

const SPARKLE = 'M0 -4.2 L1.1 -1.1 L4.2 0 L1.1 1.1 L0 4.2 L-1.1 1.1 L-4.2 0 L-1.1 -1.1 Z';

/** A short grey bar standing in for a line of text. */
function Bar({ x, y, w }: { x: number; y: number; w: number }) {
  return <rect className={LINE} x={x} y={y} width={w} height="3" rx="1.5" />;
}

/** A tick box, ticked or not. */
function Tick({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="6"
        height="6"
        rx="1.5"
        className={on ? 'fill-emerald-500' : 'fill-none stroke-slate-300 dark:stroke-slate-600'}
        strokeWidth="0.8"
      />
      {on ? (
        <path
          d={`M${x + 1.5} ${y + 3}l1.1 1.1 2-2.2`}
          stroke="#fff"
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
}

/** Start a card from a template: Add card offers the Bug Report template, and the new card arrives filled in. */
export function CardTemplateArt() {
  return (
    <Scene>
      <Panel x={14} y={10} w={104} h={76} />
      <text className={MUTED} x={22} y={22} fontSize="5" fontWeight="700" letterSpacing="0.5">
        NEW CARD FROM
      </text>
      {['Bug Report', 'Release', 'New Starter'].map((name, i) => (
        <g key={name}>
          <rect
            x={20}
            y={28 + i * 18}
            width={92}
            height={14}
            rx="4"
            className={
              i === 0
                ? 'fill-brand-50 stroke-brand-400 dark:fill-brand-500/15 dark:stroke-brand-400'
                : 'fill-none stroke-slate-200 dark:stroke-slate-700'
            }
            strokeWidth="0.8"
          />
          <text className={TEXT} x={27} y={37.2 + i * 18} fontSize="6.2" fontWeight="600">
            {name}
          </text>
        </g>
      ))}
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.4)}
        d="M122 35h24"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <g className="fa-a-pop" style={at(0.6)}>
        <Panel x={150} y={8} w={136} h={80} />
        <rect x={150} y={8} width="3" height="80" rx="1.5" fill="#ef4444" />
        <text className={TEXT} x={160} y={21} fontSize="6.8" fontWeight="700">
          Bug: Login times out
        </text>
        <Pill x={160} y={26} w={24} label="Bug" tone="red" />
        <Pill x={188} y={26} w={30} label="High" tone="amber" />
        <text className={MUTED} x={160} y={47} fontSize="5" fontWeight="700" letterSpacing="0.5">
          STEPS TO REPRODUCE
        </text>
        {['Open the sign-in page', 'Wait 30 seconds', 'Press Sign In'].map((step, i) => (
          <g key={step}>
            <Tick x={160} y={51 + i * 11} on={false} />
            <text className={TEXT} x={170} y={56 + i * 11} fontSize="5.8">
              {step}
            </text>
          </g>
        ))}
      </g>
    </Scene>
  );
}

/** Every card keeps its history: the card's Activity tab, who made it, moved it and changed it, an agent marked. */
export function CardActivityArt() {
  const rows = [
    { who: 'SM', name: 'Sam', colour: SAM, what: 'moved it to Review', when: 'now', ai: false },
    {
      who: 'AI',
      name: 'Claude',
      colour: ALEX,
      what: 'set Priority to High',
      when: '1 hr ago',
      ai: true,
    },
    { who: 'JR', name: 'Jordan', colour: JORDAN, what: 'assigned Sam', when: 'Tue', ai: false },
    { who: 'TM', name: 'You', colour: YOU, what: 'made the card', when: 'Mon', ai: false },
  ];
  return (
    <Scene>
      <Panel x={14} y={6} w={272} h={84} />
      <text className={MUTED} x={24} y={19} fontSize="6.2" fontWeight="600">
        Details
      </text>
      <text className={MUTED} x={58} y={19} fontSize="6.2" fontWeight="600">
        Comments
      </text>
      <text
        className="fill-brand-600 dark:fill-brand-300"
        x={102}
        y={19}
        fontSize="6.2"
        fontWeight="700"
      >
        Activity
      </text>
      <rect x={102} y={22} width="27" height="1.5" rx="0.75" className="fill-brand-500" />
      <path className={RULE} d="M22 24.5h256" strokeWidth="0.8" />
      {/* The thread of the history, down the avatars. */}
      <path className={RULE} d="M32 34v44" strokeWidth="0.8" />
      {rows.map((r, i) => {
        const y = 34 + i * 15;
        return (
          <g key={r.what} className="fa-a-pop" style={at(0.2 + i * 0.15)}>
            <Avatar cx={32} cy={y} r={5} color={r.colour} initials={r.who} />
            <text className={TEXT} x={44} y={y + 2.2} fontSize="6.2">
              <tspan fontWeight="700">{r.name}</tspan> {r.what}
            </text>
            {r.ai ? <Pill x={148} y={y - 5.5} w={24} label="AI" tone="brand" /> : null}
            <text className={MUTED} x={276} y={y + 2.2} fontSize="5.6" textAnchor="end">
              {r.when}
            </text>
          </g>
        );
      })}
    </Scene>
  );
}

/** Describe it, get the board: a sentence in, a drafted board with its card type and a starter rule out. */
export function DescribePlanArt() {
  return (
    <Scene>
      <Panel x={10} y={14} w={108} h={68} />
      <g transform="translate(20 25)">
        <path d={SPARKLE} className="fill-brand-500" />
      </g>
      <text className={TEXT} x={28} y={27} fontSize="6.4" fontWeight="700">
        Describe a Plan
      </text>
      <rect
        x={18}
        y={33}
        width={92}
        height={30}
        rx="4"
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
        strokeWidth="0.8"
      />
      {['A hiring pipeline: Applied,', 'Screen, Interview, Offer.', 'Candidates have a Role.'].map(
        (line, i) => (
          <text key={line} className={TEXT} x={22} y={42 + i * 8} fontSize="5.6">
            {line}
          </text>
        ),
      )}
      <rect x={70} y={68} width={40} height={10} rx="5" className="fill-brand-600" />
      <text x={90} y={74.8} fontSize="5.6" fontWeight="700" textAnchor="middle" fill="#fff">
        Make Plan
      </text>
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.3)}
        d="M122 48h18"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {['Applied', 'Screen', 'Interview', 'Offer'].map((col, i) => (
        <g key={col} className="fa-a-pop" style={at(0.5 + i * 0.15)}>
          <rect
            x={144 + i * 36}
            y={10}
            width={33}
            height={58}
            rx="4"
            className="fill-slate-100 dark:fill-slate-800/80"
          />
          <text className={MUTED} x={148 + i * 36} y={19} fontSize="5" fontWeight="700">
            {col}
          </text>
          {i < 3 ? (
            <g>
              <rect
                x={147 + i * 36}
                y={23}
                width={27}
                height={14}
                rx="2.5"
                className="fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
                strokeWidth="0.6"
              />
              <Bar x={150 + i * 36} y={27} w={18 - i * 3} />
              <rect x={150 + i * 36} y={32} width="10" height="2.5" rx="1.25" fill="#0ea5e9" />
            </g>
          ) : null}
        </g>
      ))}
      <g className="fa-a-pop" style={at(1.2)}>
        <rect
          x={144}
          y={73}
          width={141}
          height={14}
          rx="4"
          className="fill-emerald-50 stroke-emerald-300 dark:fill-emerald-500/10 dark:stroke-emerald-500/40"
          strokeWidth="0.6"
        />
        <circle cx={152} cy={80} r="3.5" fill={WHEN} fillOpacity="0.2" />
        <path d="M152.4 77.6l-1.6 2.5h1.4l-.3 1.8 1.6-2.5h-1.4z" fill={WHEN} />
        <text className={TEXT} x={159} y={82} fontSize="5.6">
          Rule: when a card reaches Offer, email the team
        </text>
      </g>
    </Scene>
  );
}

/** Cards that follow the code: a card's pull request goes from checks passing to merged, and the card moves to Done. */
export function GithubPrArt() {
  return (
    <Scene>
      {['Review', 'Done'].map((col, i) => (
        <g key={col}>
          <rect
            x={14 + i * 140}
            y={8}
            width={132}
            height={80}
            rx="5"
            className="fill-slate-100 dark:fill-slate-800/80"
          />
          <text className={MUTED} x={22 + i * 140} y={19} fontSize="5.6" fontWeight="700">
            {col}
          </text>
        </g>
      ))}
      {/* The card leaves Review as its pull request merges, and lands in Done. */}
      <g className="fa-a-move" style={from(-140, 0, 1)}>
        <Panel x={162} y={26} w={116} h={52} />
        <text className={TEXT} x={170} y={38} fontSize="6.4" fontWeight="700">
          Faster sign-in
        </text>
        <rect
          x={170}
          y={45}
          width={100}
          height={25}
          rx="4"
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
          strokeWidth="0.6"
        />
        {/* A merge glyph: two branches meeting. */}
        <g fill="none" strokeWidth="1" className="stroke-violet-500">
          <circle cx={177} cy={52} r="1.6" />
          <circle cx={177} cy={63} r="1.6" />
          <circle cx={184} cy={57.5} r="1.6" />
          <path d="M177 53.6v7.8M178.4 53.2c2 1 4.2 2 4.4 2.8" />
        </g>
        <text className={TEXT} x={190} y={55} fontSize="5.6" fontWeight="600">
          #214 Cache the session
        </text>
        <Pill x={190} y={58} w={30} label="Merged" tone="brand" />
        <g transform="translate(224 58)">
          <rect
            width="34"
            height="11"
            rx="5.5"
            className="fill-emerald-100 dark:fill-emerald-500/25"
          />
          <path
            d="M5 5.5l1.5 1.5 3-3.2"
            fill="none"
            stroke={THEN}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <text
            x={12}
            y={7.6}
            fontSize="5.8"
            fontWeight="600"
            className="fill-emerald-700 dark:fill-emerald-200"
          >
            Checks
          </text>
        </g>
      </g>
    </Scene>
  );
}

/** Dates in your calendar: the plan's due cards in a week of the calendar app, beside the meetings already there. */
export function CalendarFeedArt() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const cards = [
    { day: 1, y: 30, label: 'Copy due' },
    { day: 3, y: 44, label: 'Release' },
  ];
  const meetings = [
    { day: 0, y: 52, label: 'Stand-up' },
    { day: 2, y: 30, label: 'Review' },
    { day: 4, y: 58, label: '1:1' },
  ];
  return (
    <Scene>
      <Panel x={10} y={6} w={280} h={84} />
      <Glyph x={18} y={12} className="stroke-brand-500">
        {CLOCK_PATHS}
      </Glyph>
      <text className={TEXT} x={32} y={19} fontSize="6.6" fontWeight="700">
        Your calendar
      </text>
      <g transform="translate(206 11)">
        <rect width="76" height="11" rx="5.5" className="fill-brand-100 dark:fill-brand-500/25" />
        <circle cx="7" cy="5.5" r="2.4" className="fill-brand-500" />
        <text
          x="13"
          y="7.8"
          fontSize="5.8"
          fontWeight="600"
          className="fill-brand-700 dark:fill-brand-200"
        >
          Launch plan feed
        </text>
      </g>
      {days.map((d, i) => (
        <g key={d}>
          <text className={MUTED} x={20 + i * 54} y={30} fontSize="5.4" fontWeight="600">
            {d}
          </text>
          {i ? <path className={RULE} d={`M${16 + i * 54} 25v60`} strokeWidth="0.6" /> : null}
        </g>
      ))}
      {meetings.map((m) => (
        <g key={m.label}>
          <rect
            x={19 + m.day * 54}
            y={m.y + 5}
            width={48}
            height={13}
            rx="2.5"
            className="fill-slate-100 dark:fill-slate-700/70"
          />
          <text className={MUTED} x={23 + m.day * 54} y={m.y + 13.6} fontSize="5.4">
            {m.label}
          </text>
        </g>
      ))}
      {cards.map((c, i) => (
        <g key={c.label} className="fa-a-pop" style={at(0.4 + i * 0.3)}>
          <rect
            x={19 + c.day * 54}
            y={c.y + 5}
            width={48}
            height={13}
            rx="2.5"
            className="fill-brand-500/15 stroke-brand-500"
            strokeWidth="0.7"
          />
          <text
            className="fill-brand-700 dark:fill-brand-200"
            x={23 + c.day * 54}
            y={c.y + 13.6}
            fontSize="5.4"
            fontWeight="600"
          >
            {c.label}
          </text>
        </g>
      ))}
    </Scene>
  );
}

/** Files from your other apps: the plan's tab bar holds a connected file, its preview open with a way into it. */
export function ConnectedFilesArt() {
  const tabs = [
    { name: 'Roadmap', colour: '#8b5cf6', w: 50 },
    { name: 'Budget', colour: '#10b981', w: 44 },
    { name: 'Architecture', colour: '#0ea5e9', w: 66, connected: true },
  ];
  let x = 14;
  return (
    <Scene>
      {tabs.map((t) => {
        const at0 = x;
        x += t.w + 4;
        return (
          <g key={t.name}>
            <rect
              x={at0}
              y={8}
              width={t.w}
              height={14}
              rx="4"
              className={
                t.connected
                  ? 'fill-white stroke-sky-400 dark:fill-slate-800 dark:stroke-sky-400'
                  : 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700'
              }
              strokeWidth="0.8"
            />
            {t.connected ? (
              <Glyph x={at0 + 4} y={10.2} scale={0.95} className="stroke-sky-500">
                {LINK_PATHS}
              </Glyph>
            ) : (
              <rect x={at0 + 5} y={12.5} width="5" height="5" rx="1.2" fill={t.colour} />
            )}
            <text className={TEXT} x={at0 + 15} y={17.4} fontSize="5.8" fontWeight="600">
              {t.name}
            </text>
          </g>
        );
      })}
      <g className="fa-a-pop" style={at(0.4)}>
        <Panel x={14} y={28} w={272} h={60} />
        <rect
          x={22}
          y={35}
          width={120}
          height={46}
          rx="4"
          className="fill-(--art-paper) stroke-slate-200 dark:stroke-slate-700"
          strokeWidth="0.6"
        />
        {[
          [32, 44],
          [72, 44],
          [52, 62],
        ].map(([bx, by]) => (
          <rect
            key={`${bx}-${by}`}
            x={bx}
            y={by}
            width="30"
            height="11"
            rx="2"
            className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
            strokeWidth="0.7"
          />
        ))}
        <path
          d="M47 55v7M87 55c0 4-10 4-12 7"
          fill="none"
          className="stroke-(--art-arrow)"
          strokeWidth="0.7"
        />
        <text className={TEXT} x={152} y={46} fontSize="7" fontWeight="700">
          Architecture
        </text>
        <text className={MUTED} x={152} y={56} fontSize="5.8">
          Connected file, by Jordan
        </text>
        <rect x={152} y={64} width={62} height={13} rx="6.5" className="fill-sky-600" />
        <text x={183} y={72.6} fontSize="6" fontWeight="700" textAnchor="middle" fill="#fff">
          Open
        </text>
      </g>
    </Scene>
  );
}

/** Describe a Rule: a sentence in the dialog, and the rule it drafts, When, If and Then, open in the builder and off. */
export function DescribeRuleArt() {
  const steps = [
    { tint: WHEN, label: 'WHEN', text: 'A card moves to Done' },
    { tint: '#0ea5e9', label: 'IF', text: 'Card type is Bug' },
    { tint: THEN, label: 'THEN', text: 'Comment “Fixed”, flag it' },
  ];
  return (
    <Scene>
      <Panel x={10} y={18} w={112} h={60} />
      <g transform="translate(20 29)">
        <path d={SPARKLE} className="fill-brand-500" />
      </g>
      <text className={TEXT} x={28} y={31} fontSize="6.4" fontWeight="700">
        Describe a Rule
      </text>
      <rect
        x={18}
        y={37}
        width={96}
        height={32}
        rx="4"
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
        strokeWidth="0.8"
      />
      {['When a bug moves to Done,', 'comment Fixed and flag it.'].map((line, i) => (
        <text key={line} className={TEXT} x={22} y={47 + i * 9} fontSize="5.8">
          {line}
        </text>
      ))}
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.3)}
        d="M126 48h16"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {steps.map((st, i) => (
        <g key={st.label} className="fa-a-pop" style={at(0.5 + i * 0.25)}>
          <Panel x={146} y={8 + i * 27} w={140} h={22} />
          <circle cx={157} cy={19 + i * 27} r="5" fill={st.tint} fillOpacity="0.18" />
          <circle cx={157} cy={19 + i * 27} r="1.8" fill={st.tint} />
          <text
            className={MUTED}
            x={166}
            y={16.5 + i * 27}
            fontSize="4.6"
            fontWeight="700"
            letterSpacing="0.5"
          >
            {st.label}
          </text>
          <text className={TEXT} x={166} y={25 + i * 27} fontSize="6" fontWeight="600">
            {st.text}
          </text>
        </g>
      ))}
    </Scene>
  );
}

/** Embed a live board: a wiki page with the board inside it, still live, a teammate's card moving across. */
export function EmbedBoardArt() {
  return (
    <Scene>
      <Panel x={14} y={6} w={272} h={84} />
      <text className={TEXT} x={24} y={20} fontSize="7" fontWeight="700">
        Team wiki · Launch
      </text>
      <Bar x={24} y={27} w={110} />
      <Bar x={24} y={33} w={84} />
      <rect
        x={24}
        y={41}
        width={252}
        height={43}
        rx="4"
        className="fill-slate-50 stroke-brand-300 dark:fill-slate-900/60 dark:stroke-brand-500/50"
        strokeWidth="0.8"
      />
      {['To do', 'Doing', 'Done'].map((col, i) => (
        <g key={col}>
          <text className={MUTED} x={32 + i * 82} y={51} fontSize="5.2" fontWeight="700">
            {col}
          </text>
          <rect
            x={30 + i * 82}
            y={55}
            width={74}
            height={11}
            rx="2.5"
            className="fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
            strokeWidth="0.6"
          />
          <Bar x={34 + i * 82} y={59} w={34 + i * 6} />
        </g>
      ))}
      <g className="fa-a-move" style={from(-82, 0, 0.6)}>
        <rect
          x={194}
          y={69}
          width={74}
          height={11}
          rx="2.5"
          className="fill-white stroke-emerald-400 dark:fill-slate-700"
          strokeWidth="0.8"
        />
        <Bar x={198} y={73} w={40} />
        <Avatar cx={260} cy={74.5} r={3.6} color={SAM} initials="S" />
      </g>
      <Pill x={234} y={10} w={42} label="Live" tone="green" />
    </Scene>
  );
}

/** A password on the plan: someone arriving by a share link is asked for it before the plan opens. */
export function SharePasswordArt() {
  return (
    <Scene>
      <Panel x={14} y={8} w={124} h={80} />
      <text className={TEXT} x={24} y={22} fontSize="6.8" fontWeight="700">
        Share
      </text>
      <text className={MUTED} x={24} y={36} fontSize="5.2" fontWeight="700" letterSpacing="0.5">
        PASSWORD
      </text>
      <rect
        x={24}
        y={40}
        width={104}
        height={14}
        rx="4"
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
        strokeWidth="0.6"
      />
      <Glyph x={28} y={42} scale={0.95}>
        <rect x="1.8" y="4.4" width="6.4" height="4.6" rx="1" />
        <path d="M3.2 4.4 V3.2 a1.8 1.8 0 0 1 3.6 0 V4.4" />
      </Glyph>
      <text className={TEXT} x={40} y={49.6} fontSize="6" fontWeight="600">
        Password Set
      </text>
      <Pill x={24} y={62} w={40} label="Replace" />
      <Pill x={68} y={62} w={40} label="Remove" />
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.3)}
        d="M142 48h20"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <g className="fa-a-pop" style={at(0.5)}>
        <Panel x={166} y={14} w={120} h={68} />
        <circle cx={226} cy={30} r="8" className="fill-brand-100 dark:fill-brand-500/25" />
        <Glyph x={221} y={25} className="stroke-brand-600 dark:stroke-brand-300">
          <rect x="1.8" y="4.4" width="6.4" height="4.6" rx="1" />
          <path d="M3.2 4.4 V3.2 a1.8 1.8 0 0 1 3.6 0 V4.4" />
        </Glyph>
        <text className={TEXT} x={226} y={48} fontSize="6.2" fontWeight="700" textAnchor="middle">
          This plan has a password
        </text>
        <rect
          x={178}
          y={54}
          width={96}
          height={12}
          rx="3"
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
          strokeWidth="0.6"
        />
        <text className={MUTED} x={183} y={62.2} fontSize="6" letterSpacing="1.5">
          ••••••
        </text>
        <rect x={178} y={69} width={96} height={9} rx="4.5" className="fill-brand-600" />
        <text x={226} y={75.4} fontSize="5.4" fontWeight="700" textAnchor="middle" fill="#fff">
          Open Plan
        </text>
      </g>
    </Scene>
  );
}

/** A copy in your Google Drive: the plans kept as files in Drive's liveworkspace folder, each synced. */
export function DriveCopyArt() {
  const files = ['Launch plan.liveplanner', 'Hiring.liveplanner', 'Budget 2027.liveplanner'];
  return (
    <Scene>
      <Panel x={14} y={6} w={272} h={84} />
      <text className={MUTED} x={24} y={20} fontSize="6.2" fontWeight="600">
        My Drive ›{' '}
      </text>
      <text className={TEXT} x={58} y={20} fontSize="6.4" fontWeight="700">
        liveworkspace
      </text>
      <path className={RULE} d="M22 25.5h256" strokeWidth="0.8" />
      {files.map((f, i) => {
        const y = 30 + i * 18;
        return (
          <g key={f}>
            <rect x={24} y={y + 2} width="10" height="12" rx="1.5" className="fill-brand-500/80" />
            <text className={TEXT} x={40} y={y + 10.5} fontSize="6.2" fontWeight="600">
              {f}
            </text>
            <g className="fa-a-pop" style={at(0.4 + i * 0.25)}>
              <Pill x={238} y={y + 2.5} w={38} label="Synced" tone="green" />
            </g>
          </g>
        );
      })}
    </Scene>
  );
}
