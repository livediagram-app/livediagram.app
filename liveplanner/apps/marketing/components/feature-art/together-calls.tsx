// Feature illustrations for the platform's shared tools as a plan wears them: Start a Call Here
// (docs/specs/013-workspace/start-a-call.md), Request Approval (docs/specs/013-workspace/approvals.md) and Ask AI in
// the footer's Tools (docs/specs/026-plan/ask-ai.md). Each draws the real surface small. Motion reuses the canvas card
// timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished frame under reduced motion.
import {
  ALEX,
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
} from './canvas-parts';
import { PlanCard, SM } from './plan-parts';

const CALL_GREEN = '#10b981';

/** Start a Call Here: the corner card's Call turns into the live pill, three in the call and Join. */
export function CallArt() {
  return (
    <Scene>
      <PlanCard x={14} y={40} w={70} title="Launch checklist" id="LP-18" who={SM} />
      <PlanCard x={14} y={64} w={70} title="Pricing page" id="LP-21" />
      <Panel x={130} y={8} w={156} h={22} />
      <g className="fa-a-out" style={at(0)}>
        <rect
          x={136}
          y={13}
          width={34}
          height={12}
          rx="6"
          className="fill-slate-100 dark:fill-slate-700"
        />
        <text className={TEXT} x={153} y={21.2} fontSize="6" fontWeight="700" textAnchor="middle">
          Call
        </text>
      </g>
      <g className="fa-a-late" style={at(0)}>
        <circle cx={142} cy={19} r="2.6" fill={CALL_GREEN} />
        <text className={TEXT} x={148} y={21.4} fontSize="6" fontWeight="700">
          3 in Call
        </text>
        <rect x={180} y={13} width={30} height={12} rx="6" fill={CALL_GREEN} />
        <text x={195} y={21.2} fontSize="6" fontWeight="700" fill="#fff" textAnchor="middle">
          Join
        </text>
      </g>
      <Pill x={216} y={13.5} w={30} label="Copy" />
      <Pill x={250} y={13.5} w={30} label="Share" tone="solid" />
      <g className="fa-a-late" style={at(0.3)}>
        <Panel x={130} y={40} w={156} h={48} />
        <text className={TEXT} x={140} y={54} fontSize="6.4" fontWeight="700">
          Launch plan · call
        </text>
        {[JORDAN, ALEX, SAM].map((c, i) => (
          <Avatar
            key={c}
            cx={146 + i * 16}
            cy={72}
            r={6}
            color={c}
            initials={['J', 'A', 'S'][i]!}
          />
        ))}
        <text className={MUTED} x={200} y={74} fontSize="5.4">
          in livehuddle
        </text>
      </g>
    </Scene>
  );
}

/** Request Approval: the Share dialog's Approval tab, one approver in, the badge moving to Approved. */
export function ApprovalArt() {
  const people = [
    { name: 'Jordan', colour: JORDAN, state: 'Approved' },
    { name: 'Alex', colour: ALEX, state: 'Approved' },
  ];
  return (
    <Scene>
      <Panel x={14} y={6} w={178} h={84} />
      <text className={TEXT} x={24} y={20} fontSize="6.8" fontWeight="700">
        Share
      </text>
      <text className={MUTED} x={60} y={20} fontSize="6">
        Links
      </text>
      <text className={MUTED} x={84} y={20} fontSize="6">
        Passes
      </text>
      <text
        className="fill-brand-700 dark:fill-brand-200"
        x={114}
        y={20}
        fontSize="6"
        fontWeight="700"
      >
        Approval
      </text>
      <path className="stroke-brand-500" d="M114 23h28" strokeWidth="1" />
      <path className={RULE} d="M22 26h162" strokeWidth="0.6" />
      <text className={MUTED} x={24} y={37} fontSize="5.4">
        Q3 plan sign-off · due Friday
      </text>
      {people.map((p, i) => (
        <g key={p.name}>
          <Avatar cx={30} cy={50 + i * 16} r={5} color={p.colour} initials={p.name[0]!} />
          <text className={TEXT} x={40} y={52 + i * 16} fontSize="6.2" fontWeight="600">
            {p.name}
          </text>
          {i === 1 ? (
            <g className="fa-a-out" style={at(0)}>
              <Pill x={132} y={45 + i * 16} w={46} label="Awaiting" tone="amber" />
            </g>
          ) : null}
          <g className={i === 1 ? 'fa-a-late' : undefined} style={i === 1 ? at(0) : undefined}>
            <Pill x={132} y={45 + i * 16} w={46} label={p.state} tone="green" />
          </g>
        </g>
      ))}
      <Panel x={204} y={30} w={82} h={36} />
      <text className={MUTED} x={212} y={42} fontSize="5.2" fontWeight="700">
        APPROVAL
      </text>
      <g className="fa-a-out" style={at(0)}>
        <Pill x={212} y={48} w={66} label="Awaiting 1 of 2" tone="amber" />
      </g>
      <g className="fa-a-late" style={at(0)}>
        <Pill x={212} y={48} w={66} label="Approved" tone="green" />
      </g>
    </Scene>
  );
}

/** Ask AI: a question about the plan, answered from its cards, each source a card you can open. */
export function AskAiArt() {
  return (
    <Scene>
      <Panel x={14} y={6} w={272} h={84} />
      <text className={TEXT} x={24} y={20} fontSize="6.8" fontWeight="700">
        Ask AI
      </text>
      <rect
        x={24}
        y={26}
        width={252}
        height={14}
        rx="4"
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
        strokeWidth="0.6"
      />
      <text className={TEXT} x={30} y={35.4} fontSize="6">
        What is in progress right now?
      </text>
      <g className="fa-a-pop" style={at(0.6)}>
        <text className={TEXT} x={24} y={53} fontSize="6">
          Three cards: the pricing page with Sam, the launch email
        </text>
        <text className={TEXT} x={24} y={62} fontSize="6">
          with Jordan, and the onboarding fix, blocked by LP-12.
        </text>
      </g>
      <g className="fa-a-pop" style={at(1.1)}>
        <text className={MUTED} x={24} y={78} fontSize="5.2" fontWeight="700">
          SOURCES
        </text>
        {['LP-21 Pricing page', 'LP-24 Launch email', 'LP-27 Onboarding'].map((s, i) => (
          <Pill key={s} x={60 + i * 72} y={71} w={68} label={s} tone="brand" />
        ))}
      </g>
    </Scene>
  );
}
