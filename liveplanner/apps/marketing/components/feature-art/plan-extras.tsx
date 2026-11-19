// Feature illustrations for the plan features that reach past the board itself: card templates, a card's Activity,
// Describe a Plan (docs/specs/026-plan/describe-a-plan.md), pull requests on cards
// (docs/specs/026-plan/github-pull-requests.md) and Describe a Rule.
// Motion reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished
// frame under reduced motion.
import {
  ALEX,
  Avatar,
  Bar,
  JORDAN,
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

/** Start a card from a template: Add Card offers the Bug Report template, and the new card arrives filled in. */
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
