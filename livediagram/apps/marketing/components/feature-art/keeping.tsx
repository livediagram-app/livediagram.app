// Feature illustrations for the Collaborate category's newer ways of keeping and handing on work:
// a narrated walkthrough being recorded, a canvas sent for approval, and History with its snapshots.
// All on the 300 by 96 stage of ./canvas-parts, moving on
// the shared canvas timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished
// frame under reduced motion (the "out" half of a swap hidden).
import type { ReactNode } from 'react';
import {
  Box,
  CLOCK_PATHS,
  Connector,
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
  from,
} from './canvas-parts';

const BRAND = '#0369a1';
// A section's label in a dialog (packages/explorer/src/dialogs/share/parts.tsx SECTION_LABEL): small, bold, spaced
// capitals in slate.
const SECTION = 'fill-slate-500 dark:fill-slate-400';

/** A camera on a 10-unit grid: the snapshot pin and Take Snapshot. */
const CAMERA_PATHS = (
  <>
    <rect x="1" y="3" width="8" height="5.6" rx="1" />
    <path d="M3.4 3 l0.8 -1.2 h1.6 l0.8 1.2" />
    <circle cx="5" cy="5.8" r="1.5" />
  </>
);

/** A pencil on a 10-unit grid: History's Updated entry. */
const PENCIL_PATHS = <path d="M2 8 l0.6 -2.2 l4.4 -4.4 l1.6 1.6 l-4.4 4.4 z M6 2.4 l1.6 1.6" />;

/** A speech bubble on a 10-unit grid: History's Comment Added entry. */
const BUBBLE_PATHS = <path d="M1.6 2.2 h6.8 v4.4 h-3.6 l-2 1.6 v-1.6 h-1.2 z" />;

/** A person's picture disc, as the dialogs draw one: brand wash, their initials in the brand's ink. */
function PictureDisc({ cx, cy, initials }: { cx: number; cy: number; initials: string }) {
  return (
    <g>
      <circle className="fill-sky-100 dark:fill-sky-500/20" cx={cx} cy={cy} r="5.5" />
      <text
        className="fill-sky-800 dark:fill-sky-200"
        x={cx}
        y={cy + 1.8}
        fontSize="4.6"
        fontWeight="700"
        textAnchor="middle"
      >
        {initials}
      </text>
    </g>
  );
}

/**
 * Recording a walkthrough (packages/walkthrough/src/ui/RecordDock.tsx RecordingBar): your pointer tours the flow, your
 * camera bubble sits in a corner, and the recording bar runs at the foot: the red dot, the clock against the ten-minute
 * limit, the level meter, Discard and Finish. The note hidden in the set-up shows to you alone, faded in a dashed
 * outline (Hide From Recording is chosen before the recording starts, so the bar itself has no Hide).
 */
export function WalkthroughArt() {
  return (
    <Scene>
      <Box x={20} y={12} w={50} h={22} label="Sign up" />
      <Connector d="M70 23 H92" head="M89 20.5 l3 2.5 l-3 2.5" />
      <Box x={94} y={12} w={50} h={22} label="Verify" />
      <Connector d="M144 23 H166" head="M163 20.5 l3 2.5 l-3 2.5" />
      <Box x={168} y={12} w={50} h={22} label="Welcome" />

      {/* Hidden from the recording: still on your screen, faded inside a dashed rose outline
          (packages/walkthrough/src/bridge.ts hiddenCss: opacity .35, 2px dashed rgb(225 29 72), 3px offset). */}
      <g opacity="0.4">
        <rect x="226" y="40" width="34" height="20" rx="1.5" fill="#fde68a" />
        <text x="243" y="48.6" fontSize="5" fontWeight="600" textAnchor="middle" fill="#78350f">
          Pricing
        </text>
        <text x="243" y="55.4" fontSize="5" fontWeight="600" textAnchor="middle" fill="#78350f">
          still TBD
        </text>
      </g>
      <rect
        className="fill-none stroke-rose-600 dark:stroke-rose-400"
        x="223"
        y="37"
        width="40"
        height="26"
        rx="3"
        strokeWidth="1"
        strokeDasharray="2.4 1.6"
      />

      {/* Your pointer, talking the flow through. */}
      <Pointer className="fa-a-move" style={from(-100, 4, 0.2)} x={196} y={28} color={YOU} />

      {/* Your camera bubble in the corner: a round picture of you. */}
      <g>
        <circle
          className="fill-sky-200 stroke-white dark:fill-sky-900 dark:stroke-slate-800"
          cx="276"
          cy="22"
          r="13"
          strokeWidth="2"
        />
        <clipPath id="fa-walkthrough-bubble">
          <circle cx="276" cy="22" r="12" />
        </clipPath>
        <g clipPath="url(#fa-walkthrough-bubble)">
          <circle cx="276" cy="19" r="4.6" fill="#c2855f" />
          <path
            d="M271.3 19 q-0.4 -5.6 4.7 -5.6 q5.1 0 4.7 5.6 q-1.6 -3 -4.7 -3 q-3.1 0 -4.7 3 z"
            fill="#3f2a1d"
          />
          <path d="M264 36 q12 -14 24 0 z" fill="#0369a1" />
        </g>
      </g>

      {/* The recording bar. */}
      <Panel x={62} y={66} w={176} h={20} />
      {/* The red dot stays lit; a halo pings around it, as the recording bar pulses. */}
      <circle className="fa-a-blink" cx="72" cy="76" r="3.8" fill="#f43f5e" opacity="0.35" />
      <circle cx="72" cy="76" r="2.4" fill="#e11d48" />
      <text className={TEXT} x="79" y="78.2" fontSize="6.2" fontWeight="600">
        01:24 / 10:00
      </text>
      {/* The microphone's level. */}
      {[2.4, 4.2, 3, 5.4, 2.2, 3.8].map((h, i) => (
        <rect
          key={i}
          className="fill-emerald-500 dark:fill-emerald-400"
          x={128 + i * 3}
          y={76 - h / 2}
          width="1.8"
          height={h}
          rx="0.9"
        />
      ))}
      <rect className="fill-slate-200 dark:fill-slate-700" x="150" y="70" width="0.8" height="12" />
      <text className={TEXT} x="171" y="78.2" fontSize="6" fontWeight="600" textAnchor="middle">
        Discard
      </text>
      <rect x="190" y="69.5" width="44" height="13" rx="4" fill={BRAND} />
      {/* StopIcon, then Finish, centred together with a small gap as the button lays them out. */}
      <rect x="199" y="73.6" width="4.8" height="4.8" rx="0.8" fill="#ffffff" />
      <text x="206.6" y="78.2" fontSize="6.2" fontWeight="700" fill="#ffffff">
        Finish
      </text>
    </Scene>
  );
}

/** A page with a check on a 10-unit grid: the Approved pill's mark (packages/explorer/src/approvals/glyphs.tsx
 *  DOCUMENT_CHECK, "a checked page"). */
const PAGE_CHECK_PATHS = <path d="M2.4 1 h3.4 l2.2 2.2 v5.8 h-5.6 z M3.8 6 l1 1 l1.8 -2" />;

/** The request's Snapshot saved chip (ApprovalPanel.tsx), beside the status pill. */
function SnapshotChip({ x }: { x: number }) {
  return (
    <g>
      <rect
        className="fill-slate-100 dark:fill-slate-800"
        x={x}
        y="11"
        width="34"
        height="9"
        rx="4.5"
      />
      <text
        className="fill-slate-600 dark:fill-slate-300"
        x={x + 17}
        y="17"
        fontSize="4.4"
        fontWeight="600"
        textAnchor="middle"
      >
        Snapshot saved
      </text>
    </g>
  );
}

/**
 * Request Approval (packages/explorer/src/approvals/ApprovalPanel.tsx): the Share dialog's Approval tab, its status
 * pill turning from Awaiting 1 of 2 to Approved, who asked and when, the note, and each approver's decision in its
 * tone. (livediagram's editor has no header bar, so the header badge the other apps carry is not drawn here.)
 */
export function ApprovalArt() {
  return (
    <Scene>
      {/* The canvas being signed off. */}
      <Box x={14} y={20} w={48} h={20} label="Goals" />
      <Connector d="M62 30 H84" head="M81 27.5 l3 2.5 l-3 2.5" />
      <Box x={86} y={20} w={52} h={20} label="Budget" />
      <Connector d="M112 40 V53" head="M109.5 50 l2.5 3 l2.5 -3" />
      <Box x={86} y={55} w={52} h={20} label="Hiring" />

      {/* The Approval tab: where it stands, who asked and by when, the note, and each approver's answer. */}
      <Panel x={160} y={6} w={128} h={84} />
      <g className="fa-a-out">
        <rect
          className="fill-amber-50 stroke-amber-200 dark:fill-amber-500/10 dark:stroke-amber-500/30"
          x="166"
          y="10.5"
          width="56"
          height="10"
          rx="5"
          strokeWidth="0.7"
        />
        <Glyph x={169} y={11.9} scale={0.72} className="stroke-amber-800 dark:stroke-amber-200">
          {CLOCK_PATHS}
        </Glyph>
        <text
          className="fill-amber-800 dark:fill-amber-200"
          x="177.4"
          y="17.3"
          fontSize="5"
          fontWeight="600"
        >
          Awaiting 1 of 2
        </text>
        <SnapshotChip x={226} />
      </g>
      <g className="fa-a-late">
        <rect
          className="fill-emerald-50 stroke-emerald-200 dark:fill-emerald-500/10 dark:stroke-emerald-500/30"
          x="166"
          y="10.5"
          width="40"
          height="10"
          rx="5"
          strokeWidth="0.7"
        />
        <Glyph x={169} y={11.9} scale={0.72} className="stroke-emerald-700 dark:stroke-emerald-300">
          {PAGE_CHECK_PATHS}
        </Glyph>
        <text
          className="fill-emerald-700 dark:fill-emerald-300"
          x="177.4"
          y="17.3"
          fontSize="5"
          fontWeight="600"
        >
          Approved
        </text>
        <SnapshotChip x={210} />
      </g>
      <text className={TEXT} x="167" y="29.6" fontSize="5">
        <tspan fontWeight="700">Maya Patel</tspan> asked 18 Nov, 09:30, due{' '}
        <tspan fontWeight="700">20 Nov</tspan>
      </text>
      {/* The note the request carries. */}
      <rect
        className="fill-slate-50 dark:fill-slate-900"
        x="166"
        y="33"
        width="116"
        height="11"
        rx="3"
      />
      <text className={TEXT} x="170" y="40" fontSize="5">
        Please sign off before the board meets.
      </text>
      <text
        className={SECTION}
        x="167"
        y="52.4"
        fontSize="4.6"
        fontWeight="700"
        letterSpacing="0.5"
      >
        APPROVERS
      </text>
      <PictureDisc cx={172.5} cy={62} initials="PS" />
      <text className={TEXT} x="182" y="64" fontSize="5.8">
        Priya Shah
      </text>
      <text
        className="fill-emerald-700 dark:fill-emerald-300"
        x="280"
        y="64"
        fontSize="5.4"
        fontWeight="600"
        textAnchor="end"
      >
        Approved
      </text>
      <PictureDisc cx={172.5} cy={79} initials="TR" />
      <text className={TEXT} x="182" y="81" fontSize="5.8">
        Tom Reid
      </text>
      <text
        className="fa-a-out fill-slate-500 dark:fill-slate-400"
        x="280"
        y="81"
        fontSize="5.4"
        fontWeight="600"
        textAnchor="end"
      >
        Waiting
      </text>
      <text
        className="fa-a-late fill-emerald-700 dark:fill-emerald-300"
        x="280"
        y="81"
        fontSize="5.4"
        fontWeight="600"
        textAnchor="end"
      >
        Approved
      </text>
    </Scene>
  );
}

/** One entry on History's rail (packages/explorer/src/library/HistoryEntry.tsx): its tone's disc and glyph, what
 *  happened, the time, and who did it beneath. */
function HistoryEntry({
  y,
  label,
  time,
  who,
  color,
  initials,
  glyph,
}: {
  y: number;
  label: string;
  time: string;
  who: string;
  color: string;
  initials: string;
  glyph: ReactNode;
}) {
  return (
    <g>
      <circle className="fill-emerald-50 dark:fill-emerald-500/15" cx="158" cy={y} r="5.5" />
      <Glyph
        x={154.4}
        y={y - 3.6}
        scale={0.72}
        className="stroke-emerald-700 dark:stroke-emerald-400"
      >
        {glyph}
      </Glyph>
      <text className={TEXT} x="168" y={y + 0.4} fontSize="5.8" fontWeight="600">
        {label}
      </text>
      <text className={MUTED} x="280" y={y + 0.4} fontSize="5" textAnchor="end">
        {time}
      </text>
      <circle cx="170" cy={y + 6.6} r="2.2" fill={color} />
      <text x="170" y={y + 7.6} fontSize="2.4" fontWeight="700" textAnchor="middle" fill="#fff">
        {initials}
      </text>
      <text className={MUTED} x="174.6" y={y + 8.2} fontSize="4.8">
        {who}
      </text>
    </g>
  );
}

/**
 * History with its snapshots (packages/snapshots/src/ui/history-snapshots.tsx): the rail of who changed what and when,
 * a snapshot pinned on it in the brand's tone with Revert beside it, and Take Snapshot at the foot.
 */
export function SnapshotsArt() {
  return (
    <Scene>
      {/* The canvas, as it is now. */}
      <Box x={14} y={16} w={46} h={20} label="Orders" />
      <Connector d="M60 26 H76" head="M73 23.5 l3 2.5 l-3 2.5" />
      <Box x={78} y={16} w={50} h={20} label="Payments" />
      <Box x={14} y={58} w={46} h={20} label="Stock" />
      <Connector d="M37 36 V55" head="M34.5 52 l2.5 3 l2.5 -3" />

      {/* Tools, then History. */}
      <Panel x={142} y={6} w={146} h={84} />
      <text className={TEXT} x="150" y="17" fontSize="6.8" fontWeight="700">
        History
      </text>
      <path className={RULE} d="M142 22 H288" strokeWidth="0.8" />
      <path className="stroke-slate-200 dark:stroke-slate-700" d="M158 32 V62" strokeWidth="0.8" />

      <g className="fa-a-in" style={at(0.2)}>
        <HistoryEntry
          y={28}
          label="Canvas Updated"
          time="14:20"
          who="Jordan Reyes"
          color={JORDAN}
          initials="JR"
          glyph={PENCIL_PATHS}
        />
      </g>

      {/* The snapshot, pinned on the rail: the camera on the brand's wash, then Revert. */}
      <g className="fa-a-in" style={at(0.45)}>
        <circle className="fill-sky-100 dark:fill-sky-500/20" cx="158" cy="46.5" r="5.5" />
        <Glyph x={154.4} y={42.7} scale={0.72} className="stroke-sky-700 dark:stroke-sky-200">
          {CAMERA_PATHS}
        </Glyph>
        <text
          className="fill-sky-700 dark:fill-sky-300"
          x="168"
          y="42.4"
          fontSize="4.2"
          fontWeight="700"
          letterSpacing="0.5"
        >
          SNAPSHOT
        </text>
        <text className={TEXT} x="168" y="49" fontSize="5.8" fontWeight="600">
          Before the workshop
        </text>
        {/* SnapshotRow's second line (snapshot-words.ts snapshotMeta): who, how long ago, how big. */}
        <text className={MUTED} x="168" y="55.2" fontSize="4.6">
          Sam Okafor · 3 hours ago · 24 KB
        </text>
        <g className="fa-a-pop" style={at(1)}>
          <rect
            className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
            x="250"
            y="42"
            width="30"
            height="11"
            rx="3"
            strokeWidth="0.8"
          />
          <text
            className={TEXT}
            x="265"
            y="49.2"
            fontSize="5.2"
            fontWeight="600"
            textAnchor="middle"
          >
            Revert
          </text>
        </g>
      </g>

      <g className="fa-a-in" style={at(0.7)}>
        <HistoryEntry
          y={63}
          label="Comment Added"
          time="10:42"
          who="Sam Okafor"
          color={SAM}
          initials="SO"
          glyph={BUBBLE_PATHS}
        />
      </g>

      {/* The tool's footer button (packages/ui/src/ToolFooter.tsx ToolFooterButton): full width, glyph and words centred. */}
      <path className={RULE} d="M142 75 H288" strokeWidth="0.8" />
      <rect x="146" y="78" width="138" height="9" rx="3" fill={BRAND} />
      <Glyph x={196} y={78.6} scale={0.7} className="stroke-white">
        {CAMERA_PATHS}
      </Glyph>
      <text x="222" y="84.4" fontSize="5.2" fontWeight="700" textAnchor="middle" fill="#ffffff">
        Take Snapshot
      </text>
    </Scene>
  );
}
