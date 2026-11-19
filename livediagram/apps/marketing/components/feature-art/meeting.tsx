// Feature illustrations for the Present & workshop group's meeting elements: the Done check asking the room whether
// it is finished, and the Agenda and Decision record that keep the record of the meeting. Each card is drawn after its
// face in the editor (apps/editor/components/canvas/collab), on the 300 by 96 stage of ./canvas-parts, moving on the
// shared canvas timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished frame under reduced
// motion (the "out" half of a swap hidden).
import {
  ALEX,
  AWAY,
  CHECK_PATHS,
  Glyph,
  JORDAN,
  MUTED,
  Panel,
  Pointer,
  RULE,
  SAM,
  Scene,
  TEXT,
  YOU,
  at,
} from './canvas-parts';

const GREEN = '#10b981';
// A roster's or a section's label on a collaboration card: small, bold, spaced capitals, half-faded.
const LABEL = 'fill-slate-500 dark:fill-slate-400';

/** A sticky on the canvas with a two-line note. */
function Sticky({
  x,
  y,
  fill,
  ink,
  lines,
}: {
  x: number;
  y: number;
  fill: string;
  ink: string;
  lines: [string, string];
}) {
  return (
    <g>
      <rect x={x} y={y} width="40" height="30" rx="1.5" fill={fill} />
      {lines.map((line, i) => (
        <text key={line} x={x + 5} y={y + 11 + i * 7} fontSize="5.4" fontWeight="600" fill={ink}>
          {line}
        </text>
      ))}
    </g>
  );
}

/** The three dots of a card's own menu, in its header. */
function Ellipsis({ x, y }: { x: number; y: number }) {
  return (
    <path
      className="stroke-slate-400 dark:stroke-slate-500"
      d={`M${x} ${y} h0.1 M${x + 3.4} ${y} h0.1 M${x + 6.8} ${y} h0.1`}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  );
}

/** A person on a Done check's roster: their colour and initials, with a green check once they are done. */
function RosterFace({
  cx,
  cy,
  color,
  initials,
  done,
  delay,
}: {
  cx: number;
  cy: number;
  color: string;
  initials: string;
  done: boolean;
  delay?: number;
}) {
  return (
    <g opacity={done ? 1 : 0.4}>
      <circle cx={cx} cy={cy} r="5" fill={color} />
      <text x={cx} y={cy + 1.5} fontSize="4" fontWeight="700" textAnchor="middle" fill="#fff">
        {initials}
      </text>
      {done ? (
        <g className="fa-a-pop" style={at(delay ?? 0)}>
          <circle
            className="stroke-white dark:stroke-slate-800"
            cx={cx + 3.8}
            cy={cy + 3.6}
            r="2.4"
            fill={GREEN}
            strokeWidth="0.8"
          />
          <path
            d={`M${cx + 2.8} ${cy + 3.6} l0.8 0.8 l1.4 -1.5`}
            fill="none"
            stroke="#fff"
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : null}
    </g>
  );
}

/**
 * Ask the room if they are done (DoneCheckFace.tsx): the card's title and its count, a ring filling as people mark
 * themselves finished, who is Done and who it is still Waiting on, and the I'm done button at its foot.
 */
export function DoneCheckArt() {
  const r = 12;
  const length = 2 * Math.PI * r;
  return (
    <Scene>
      {/* The retro being worked through. */}
      <Sticky x={14} y={14} fill="#fde68a" ink="#78350f" lines={['Standups', 'ran long']} />
      <Sticky x={60} y={14} fill="#fbcfe8" ink="#831843" lines={['Release', 'notes late']} />
      <Sticky x={14} y={52} fill="#bbf7d0" ink="#14532d" lines={['Pairing', 'helped']} />
      <Sticky x={60} y={52} fill="#bfdbfe" ink="#1e3a8a" lines={['Try a', 'demo day']} />

      {/* The Done check. */}
      <Panel x={122} y={8} w={166} h={80} />
      <text className={TEXT} x="130" y="19.6" fontSize="6.6" fontWeight="700">
        Everyone done?
      </text>
      <text className={MUTED} x="268" y="19.6" fontSize="5.6" fontWeight="600" textAnchor="end">
        3/5
      </text>
      <Ellipsis x={274} y={17.6} />

      {/* The ring: three of five. */}
      <circle
        className="stroke-slate-100 dark:stroke-slate-700"
        cx="148"
        cy="47"
        r={r}
        fill="none"
        strokeWidth="3"
      />
      <circle
        cx="148"
        cy="47"
        r={r}
        fill="none"
        stroke={GREEN}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(length * 3) / 5} ${length}`}
        transform="rotate(-90 148 47)"
      />
      <text className={TEXT} x="146.4" y="49.6" fontSize="8" fontWeight="700" textAnchor="middle">
        3
      </text>
      <text className={MUTED} x="153" y="49.6" fontSize="5.4" fontWeight="600" textAnchor="middle">
        /5
      </text>

      {/* Who has, and who it waits on. */}
      <text className={LABEL} x="172" y="31" fontSize="4.4" fontWeight="700" letterSpacing="0.4">
        DONE
      </text>
      {/* DoneRoster.tsx: the title, then its count in a small tinted pill. */}
      <rect
        className="fill-slate-100 dark:fill-slate-700/60"
        x="188.5"
        y="26.3"
        width="7"
        height="6.4"
        rx="3.2"
      />
      <text className={LABEL} x="192" y="31.1" fontSize="4.4" fontWeight="700" textAnchor="middle">
        3
      </text>
      <RosterFace cx={177} cy={40} color={YOU} initials="TM" done delay={0.3} />
      <RosterFace cx={192} cy={40} color={JORDAN} initials="JR" done delay={0.6} />
      <RosterFace cx={207} cy={40} color={SAM} initials="SO" done delay={0.9} />
      <text className={LABEL} x="172" y="55" fontSize="4.4" fontWeight="700" letterSpacing="0.4">
        WAITING
      </text>
      {/* DoneRoster.tsx: the title, then its count in a small tinted pill. */}
      <rect
        className="fill-slate-100 dark:fill-slate-700/60"
        x="198"
        y="50.3"
        width="7"
        height="6.4"
        rx="3.2"
      />
      <text
        className={LABEL}
        x="201.5"
        y="55.1"
        fontSize="4.4"
        fontWeight="700"
        textAnchor="middle"
      >
        2
      </text>
      <RosterFace cx={177} cy={64} color={ALEX} initials="AK" done={false} />
      <RosterFace cx={192} cy={64} color={AWAY} initials="MB" done={false} />

      {/* The button everyone presses. */}
      <rect x="130" y="74" width="150" height="10" rx="4" fill={GREEN} />
      <Glyph x={185} y={74.6} scale={0.8} className="stroke-white">
        {CHECK_PATHS}
      </Glyph>
      <text x="198" y="80.8" fontSize="5.6" fontWeight="700" fill="#fff">
        I&apos;m done
      </text>
      <Pointer x={232} y={80} color={ALEX} />
    </Scene>
  );
}

/** One segment on the Agenda's stepper (agenda/AgendaStep.tsx): done (a check, struck through), or ahead (a hollow
 *  ring and its minutes). */
function Segment({
  y,
  name,
  minutes,
  done = false,
}: {
  y: number;
  name: string;
  minutes: string;
  done?: boolean;
}) {
  return (
    <g>
      {done ? (
        <>
          <circle cx="22" cy={y} r="3.2" fill={GREEN} />
          <path
            d={`M20.6 ${y} l1 1 l1.8 -1.9`}
            fill="none"
            stroke="#fff"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <circle
          className="stroke-slate-300 dark:stroke-slate-600"
          cx="22"
          cy={y}
          r="3"
          fill="none"
          strokeWidth="0.9"
        />
      )}
      <text
        className={done ? MUTED : TEXT}
        x="30"
        y={y + 2}
        fontSize="5.6"
        fontWeight="600"
        textDecoration={done ? 'line-through' : undefined}
      >
        {name}
      </text>
      <text className={MUTED} x="138" y={y + 2} fontSize="5.2" textAnchor="end">
        {minutes}
      </text>
    </g>
  );
}

/**
 * Keep the record of the meeting: the Agenda (AgendaFace.tsx) running its current segment with the time left and a
 * draining bar, and a Decision record (DecisionFace.tsx) with its status, the statement, what drove it and its date.
 */
export function MeetingRecordArt() {
  return (
    <Scene>
      {/* The Agenda. */}
      <Panel x={12} y={8} w={134} h={80} />
      <text className={TEXT} x="19" y="19.6" fontSize="6.6" fontWeight="700">
        Agenda
      </text>
      <text className={MUTED} x="138" y="19.6" fontSize="5.4" fontWeight="600" textAnchor="end">
        45m
      </text>
      <Segment y={30} name="Check-in" minutes="5m" done />
      {/* The current segment, lit and expanded. */}
      <rect
        className="fill-sky-50 dark:fill-sky-500/15"
        x="16"
        y="37"
        width="126"
        height="22"
        rx="4"
      />
      <circle className="fa-a-blink" cx="22" cy="43.4" r="2.4" fill="#0ea5e9" />
      <text
        className="fill-sky-800 dark:fill-sky-200"
        x="30"
        y="45.4"
        fontSize="5.8"
        fontWeight="700"
      >
        Roadmap review
      </text>
      <text
        className="fill-sky-800 dark:fill-sky-200"
        x="138"
        y="46"
        fontSize="7.4"
        fontWeight="700"
        textAnchor="end"
      >
        12:40
      </text>
      <rect
        className="fill-sky-100 dark:fill-sky-500/25"
        x="30"
        y="51"
        width="108"
        height="2.6"
        rx="1.3"
      />
      <rect className="fa-b-drain" x="30" y="51" width="108" height="2.6" rx="1.3" fill="#0ea5e9" />
      <Segment y={66} name="Decisions" minutes="15m" />
      <Segment y={78} name="Wrap-up" minutes="5m" />

      {/* The Decision record. */}
      <g className="fa-a-pop" style={at(0.4)}>
        <Panel x={154} y={8} w={134} h={80} />
        <rect
          className="fill-emerald-100 dark:fill-emerald-500/20"
          x="161"
          y="13"
          width="38"
          height="10"
          rx="5"
        />
        <Glyph x={163} y={13.6} scale={0.8} className="stroke-emerald-700 dark:stroke-emerald-300">
          {CHECK_PATHS}
        </Glyph>
        <text
          className="fill-emerald-700 dark:fill-emerald-300"
          x="171.6"
          y="20.2"
          fontSize="5.2"
          fontWeight="700"
        >
          Accepted
        </text>
        <text className={TEXT} x="161" y="33" fontSize="7.4" fontWeight="700">
          We will ship the beta
        </text>
        <text className={TEXT} x="161" y="42" fontSize="7.4" fontWeight="700">
          on 2 December
        </text>
        <path className={RULE} d="M161 47.5 H281" strokeWidth="0.7" />
        <text
          className="fill-emerald-700 dark:fill-emerald-300"
          x="161"
          y="55"
          fontSize="4.4"
          fontWeight="700"
          letterSpacing="0.5"
        >
          BECAUSE
        </text>
        {['Pilot teams are ready', 'The billing fix has landed'].map((driver, i) => (
          <g key={driver}>
            <circle
              className="fill-emerald-100 dark:fill-emerald-500/20"
              cx="164"
              cy={61.6 + i * 8}
              r="2.6"
            />
            <text
              className="fill-emerald-700 dark:fill-emerald-300"
              x="164"
              y={63.3 + i * 8}
              fontSize="4.6"
              fontWeight="700"
              textAnchor="middle"
            >
              →
            </text>
            <text className={TEXT} x="170" y={63.6 + i * 8} fontSize="5.4">
              {driver}
            </text>
          </g>
        ))}
        <rect
          className="fill-slate-100 dark:fill-slate-700"
          x="161"
          y="75"
          width="44"
          height="9"
          rx="4.5"
        />
        <Glyph x={163.4} y={75.6} scale={0.75}>
          <rect x="1.4" y="2" width="7.2" height="6.6" rx="1" />
          <path d="M1.4 4.2 h7.2 M3.4 1 v2 M6.6 1 v2" />
        </Glyph>
        <text className={TEXT} x="171.4" y="81.2" fontSize="4.8" fontWeight="600">
          2026-11-18
        </text>
      </g>
    </Scene>
  );
}
