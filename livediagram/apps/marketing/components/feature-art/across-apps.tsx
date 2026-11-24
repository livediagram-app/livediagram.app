// Feature illustrations for what a canvas does with the other liveworkspace apps and the footer's Tools: shapes made
// into plan cards (docs/specs/013-workspace/make-plan-cards.md), a livehuddle call started from the canvas
// (start-a-call.md) and Ask AI answering from the canvas's own words (ask-ai.md). On the 300 by 96 stage of
// ./canvas-parts.
import {
  ALEX,
  Avatar,
  Box,
  Connector,
  Glyph,
  JORDAN,
  LINE,
  MUTED,
  ON_CANVAS,
  PANEL,
  Panel,
  Pill,
  RULE,
  SAM,
  Scene,
  TEXT,
  TextBar,
  YOU,
  at,
  from,
} from './canvas-parts';

/** The plan glyph a sent shape wears: a small card with two lines, in a dot on its corner. */
function PlanChip({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle className={ON_CANVAS} cx={x} cy={y} r="5.5" fill={YOU} strokeWidth="1.5" />
      <g className="stroke-white" fill="none" strokeWidth="1" strokeLinecap="round">
        <rect x={x - 2.6} y={y - 2.6} width="5.2" height="5.2" rx="1" />
        <path d={`M${x - 1.2} ${y - 0.6} h2.4 M${x - 1.2} ${y + 1} h1.6`} />
      </g>
    </g>
  );
}

/** A card on the plan's board: its title and, optionally, a pill under it. */
function PlanCard({ y, title, pill }: { y: number; title: string; pill?: string }) {
  return (
    <g>
      <rect className={PANEL} x="196" y={y} width="84" height="18" rx="3" strokeWidth="0.8" />
      <text className={TEXT} x="201" y={y + 7.6} fontSize="5.8" fontWeight="600">
        {title}
      </text>
      {pill ? (
        <text className={MUTED} x="201" y={y + 14.4} fontSize="4.6" fontWeight="600">
          {pill}
        </text>
      ) : (
        <TextBar x={201} y={y + 11.5} w={34} />
      )}
    </g>
  );
}

/** Make Plan Cards: a roadmap's three shapes become cards in a plan, the arrows their Blocked By, each shape wearing
 *  its card's chip once made. */
export function PlanCardsArt() {
  return (
    <Scene>
      <Box x={14} y={14} w={50} h={22} label="Design" />
      <Connector d="M64 25 H84" head="M81 22.5 l3 2.5 l-3 2.5" />
      <Box x={86} y={14} w={50} h={22} label="Build" />
      <Connector d="M111 36 V52" head="M108.5 49 l2.5 3 l2.5 -3" />
      <Box x={86} y={54} w={50} h={22} label="Ship" />

      <g className="fa-a-late">
        <PlanChip x={64} y={14} />
        <PlanChip x={136} y={14} />
        <PlanChip x={136} y={54} />
      </g>

      <Panel x={186} y={6} w={104} h={84} />
      <text className={TEXT} x="196" y="17" fontSize="6.2" fontWeight="700">
        Roadmap
      </text>
      <text className={MUTED} x="280" y="17" fontSize="5" fontWeight="600" textAnchor="end">
        To Do
      </text>
      <path className={RULE} d="M186 22 H290" strokeWidth="0.8" />
      <g className="fa-a-move" style={from(-120, 0, 0.2)}>
        <PlanCard y={26} title="Design" />
      </g>
      <g className="fa-a-move" style={from(-110, 0, 0.45)}>
        <PlanCard y={47} title="Build" pill="Waits on Design" />
      </g>
      <g className="fa-a-move" style={from(-110, 0, 0.7)}>
        <PlanCard y={68} title="Ship" pill="Waits on Build" />
      </g>
    </Scene>
  );
}

/** The phone handset glyph the Call button wears, on a 10-unit grid. */
const HANDSET = (
  <path d="M2.2 1.4 l1.6 -0.2 l1 2.3 l-1.1 0.9 a5.6 5.6 0 0 0 2.4 2.4 l0.9 -1.1 l2.3 1 l-0.2 1.6 a1.2 1.2 0 0 1 -1.3 1 a7.6 7.6 0 0 1 -6.6 -6.6 a1.2 1.2 0 0 1 1 -1.3 z" />
);

/** Start a Call Here: the corner card's Call button, then the live call's pill, with the people already in it. */
export function CallArt() {
  return (
    <Scene>
      <Box x={22} y={44} w={56} h={26} label="Checkout" />
      <Connector d="M78 57 H104" head="M101 54.5 l3 2.5 l-3 2.5" />
      <Box x={106} y={44} w={56} h={26} label="Payments" />

      {/* The canvas's top-right corner card. */}
      <Panel x={176} y={10} w={112} h={22} />
      <g className="fa-a-out" style={at(0.2)}>
        <rect className="fill-sky-500" x="182" y="14.5" width="34" height="13" rx="4" />
        <Glyph x={185} y={16.5} className="stroke-white" scale={0.9}>
          {HANDSET}
        </Glyph>
        <text x="197" y="23.6" fontSize="6.2" fontWeight="700" fill="#fff">
          Call
        </text>
      </g>
      <g className="fa-a-late" style={at(0.2)}>
        <rect
          className="fill-emerald-100 dark:fill-emerald-500/25"
          x="182"
          y="14.5"
          width="64"
          height="13"
          rx="6.5"
        />
        <circle className="fa-a-blink fill-emerald-500" cx="189" cy="21" r="2" />
        <text
          className="fill-emerald-700 dark:fill-emerald-200"
          x="194"
          y="23.4"
          fontSize="6"
          fontWeight="700"
        >
          3 in Call
        </text>
        <text
          className="fill-sky-600 dark:fill-sky-300"
          x="226"
          y="23.4"
          fontSize="6"
          fontWeight="700"
        >
          Join
        </text>
      </g>
      <text className={MUTED} x="252" y="23.4" fontSize="5.6" fontWeight="600">
        Share
      </text>

      <g className="fa-a-late" style={at(0.5)}>
        <Avatar cx={192} cy={46} r={6} color={JORDAN} initials="J" ring={ON_CANVAS} />
        <Avatar cx={203} cy={46} r={6} color={ALEX} initials="A" ring={ON_CANVAS} />
        <Avatar cx={214} cy={46} r={6} color={SAM} initials="S" ring={ON_CANVAS} />
        <text className={MUTED} x="224" y="48.2" fontSize="5.6" fontWeight="600">
          in livehuddle
        </text>
      </g>
      <text className={MUTED} x="232" y="82" fontSize="5.6" textAnchor="middle">
        A call about this canvas
      </text>
    </Scene>
  );
}

/** A citation chip: its number in a small rounded square. */
function Cite({ x, y, n, lit = false }: { x: number; y: number; n: number; lit?: boolean }) {
  return (
    <g>
      <rect
        className={lit ? 'fill-sky-500' : 'fill-sky-100 dark:fill-sky-500/25'}
        x={x}
        y={y}
        width="7"
        height="7"
        rx="2"
      />
      <text
        className={lit ? 'fill-white' : 'fill-sky-700 dark:fill-sky-200'}
        x={x + 3.5}
        y={y + 5.2}
        fontSize="4.8"
        fontWeight="700"
        textAnchor="middle"
      >
        {n}
      </text>
    </g>
  );
}

/** Ask AI: a question about the canvas, the answer with its numbered sources, and the shape a source points at lit. */
export function AskAiArt() {
  return (
    <Scene>
      <Box x={14} y={14} w={48} h={20} label="Sign up" />
      <Connector d="M38 34 V44" head="M35.5 41 l2.5 3 l2.5 -3" />
      <Box x={14} y={46} w={48} h={20} label="Verify" />
      <Connector d="M62 56 H74" head="M71 53.5 l3 2.5 l-3 2.5" />
      <Box x={76} y={46} w={48} h={20} label="Pay" />
      {/* The source pressed: its shape selected on the canvas. */}
      <rect
        className="fa-a-late fill-none stroke-sky-500"
        x="73"
        y="43"
        width="54"
        height="26"
        rx="7"
        strokeWidth="1.4"
      />

      <Panel x={140} y={6} w={150} h={84} />
      <text className={TEXT} x="150" y="17" fontSize="6.2" fontWeight="700">
        Ask AI
      </text>
      <path className={RULE} d="M140 22 H290" strokeWidth="0.8" />
      <g className="fa-a-pop" style={at(0.2)}>
        <rect x="190" y="26" width="92" height="12" rx="6" fill={YOU} />
        <text x="236" y="33.8" fontSize="5.6" fontWeight="600" fill="#fff" textAnchor="middle">
          What are the main steps?
        </text>
      </g>
      <g className="fa-a-in" style={at(0.9)}>
        <text className={TEXT} x="150" y="48" fontSize="5.6">
          Sign up, verify the email,
        </text>
        <Cite x={220} y={42.6} n={1} />
        <text className={TEXT} x="150" y="57" fontSize="5.6">
          then pay to finish.
        </text>
        <Cite x={203} y={51.6} n={3} />
        <rect className={LINE} x="150" y="64" width="40" height="10" rx="5" />
        <text
          className={MUTED}
          x="170"
          y="70.6"
          fontSize="4.8"
          fontWeight="600"
          textAnchor="middle"
        >
          3 Sources
        </text>
        <text className={MUTED} x="282" y="70.6" fontSize="4.8" fontWeight="600" textAnchor="end">
          Built-In AI
        </text>
      </g>
      <g className="fa-a-late">
        <Cite x={203} y={51.6} n={3} lit />
      </g>
      <Pill x={150} y={77} w={56} label="Ask a question" tone="slate" />
    </Scene>
  );
}
