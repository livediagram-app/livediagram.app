// Feature illustrations for a Space's History and its Automations, each the editor's own panel with its labels and its
// look: History with its Snapshots (packages/snapshots/src/ui/history-snapshots.tsx, SnapshotRow.tsx) and the
// Automations screen's Rules tab (packages/automations-ui/src/AutomationsDialog.tsx), drawn by the shared card art.
// The games are in ./space-games and the Mini View in ./space-mini-view.
// The motion is the shared card keyframes (app/feature-art/canvas.css), which settle under reduced motion.

import { AutomationsArt as SharedAutomationsArt } from '@liveworkspace/marketing-site/components/feature-art/automations-screen';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { PANEL, RULE, STRONG, BODY, SUBTLE, Close, Button } from './space-panel-parts';
import { at } from './space-shot';

// ── History and Snapshots ─────────────────────────────────────────────────────────────────────────────────────────

/** The snapshot camera (packages/snapshots/src/ui/glyphs.tsx's SnapshotGlyph, lucide's camera). */
function Camera({ x, y }: { x: number; y: number }) {
  return (
    <g
      fill="none"
      strokeWidth={0.8}
      strokeLinejoin="round"
      className="stroke-emerald-700 dark:stroke-emerald-200"
    >
      <path
        d={`M${x - 3} ${y - 1.4} H${x - 1.6} L${x - 0.9} ${y - 2.4} H${x + 0.9} L${x + 1.6} ${y - 1.4} H${x + 3} V${y + 2.2} H${x - 3} Z`}
      />
      <circle cx={x} cy={y + 0.4} r={1.1} />
    </g>
  );
}

/** One snapshot on History's rail: its pin, the Snapshot label, its name, who, when and how big, Revert and Delete. */
function SnapshotPin({
  y,
  title,
  meta,
  badge,
  delay,
}: {
  y: number;
  title: string;
  meta: string;
  badge?: string;
  delay: number;
}) {
  return (
    <g className="fa-a-in" style={at(delay)}>
      <circle
        cx={34}
        cy={y + 6}
        r={6}
        strokeWidth={2}
        className="fill-emerald-50 stroke-white dark:fill-emerald-500/15 dark:stroke-slate-900"
      />
      <Camera x={34} y={y + 6} />
      <text
        x={46}
        y={y + 3}
        fontSize={4.2}
        fontWeight={600}
        letterSpacing={0.5}
        className="fill-emerald-700 dark:fill-emerald-300"
      >
        SNAPSHOT
      </text>
      <text x={46} y={y + 9.6} fontSize={6} fontWeight={500} className={STRONG}>
        {title}
      </text>
      {badge ? (
        <g>
          <rect
            x={47 + title.length * 2.9}
            y={y + 5.2}
            width={28}
            height={6}
            rx={1.6}
            className="fill-slate-900/[0.06] dark:fill-white/10"
          />
          <text
            x={61 + title.length * 2.9}
            y={y + 9.4}
            fontSize={4.2}
            fontWeight={500}
            textAnchor="middle"
            className={BODY}
          >
            {badge}
          </text>
        </g>
      ) : null}
      <text x={46} y={y + 15.6} fontSize={4.8} className={BODY}>
        {meta}
      </text>
      <Button x={232} y={y + 2.6} w={26} h={9} text="Revert" />
      <path
        d={`M${264.6} ${y + 5} H${270.4} M${266} ${y + 5} V${y + 9.8} H${269} V${y + 5} M${266.6} ${y + 5} V${y + 4} H${268.4} V${y + 5}`}
        fill="none"
        strokeWidth={0.7}
        strokeLinejoin="round"
        className="stroke-slate-500 dark:stroke-slate-400"
      />
    </g>
  );
}

/**
 * Snapshots to go back to: History, its timeline with two snapshots pinned on the rail among the Space's events (one
 * the automatic Before revert), each with Revert, and Take Snapshot full width at its foot.
 */
export function SnapshotsArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <rect x={16} y={3} width={268} height={90} rx={6} strokeWidth={0.8} className={PANEL} />
        <text x={26} y={13.6} fontSize={7} fontWeight={700} className={STRONG}>
          History
        </text>
        <Close x={274} y={11} />
        <path d="M34 26 V68" strokeWidth={0.8} className="stroke-slate-200 dark:stroke-slate-700" />
        <SnapshotPin
          y={18}
          title="Before the big rearrange"
          meta="You · 2 mins ago · 18 KB"
          delay={0.2}
        />
        {/* An event on the rail between them: the Space renamed. */}
        <g className="fa-a-in" style={at(0.4)}>
          <circle
            cx={34}
            cy={45}
            r={6}
            strokeWidth={2}
            className="fill-sky-50 stroke-white dark:fill-sky-500/15 dark:stroke-slate-900"
          />
          <path
            d="M32 47 L32.4 45.4 L35.6 42.2 L36.8 43.4 L33.6 46.6 Z"
            fill="none"
            strokeWidth={0.7}
            strokeLinejoin="round"
            className="stroke-sky-700 dark:stroke-sky-200"
          />
          <text x={46} y={44} fontSize={6} fontWeight={500} className={STRONG}>
            Space Renamed
          </text>
          <text x={258} y={44} fontSize={4.8} textAnchor="end" className={SUBTLE}>
            10:42
          </text>
          <text x={46} y={50.4} fontSize={4.8} className={BODY}>
            <tspan fontWeight={600} className="fill-slate-700 dark:fill-slate-200">
              Sam
            </tspan>{' '}
            · Was “Stand-up Pod”
          </text>
        </g>
        <SnapshotPin
          y={55}
          title="Before reverting"
          meta="Priya · yesterday · 17 KB"
          badge="Before revert"
          delay={0.6}
        />
        {/* The tools' main footer button. */}
        <path d="M16 76 H284" strokeWidth={0.8} className={RULE} />
        <g className="fa-a-pop" style={at(0.9)}>
          <rect x={22} y={79} width={256} height={10} rx={2.5} className="fill-emerald-600" />
          <g fill="none" strokeWidth={0.8} strokeLinejoin="round" stroke="#fff">
            <path d="M126 83 H127.4 L128.1 82 H129.9 L130.6 83 H132 V86.6 H126 Z" />
            <circle cx={129} cy={84.8} r={1.1} />
          </g>
          <text x={135} y={86} fontSize={5.6} fontWeight={600} fill="#fff">
            Take Snapshot
          </text>
        </g>
      </svg>
    </Frame>
  );
}

// ── Automations ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Automations: the Space's Automations screen (the shared card art), its Rules tab open on three of livehuddle's own
 * templates (livehuddle/docs/specs/013-workspace/automations.md "Templates") that keep the office running.
 */
export function AutomationsArt() {
  return (
    <SharedAutomationsArt
      rules={[
        {
          name: 'Tidy Up When Everyone Leaves',
          sentence: 'When Everyone Left then Revert to Snapshot',
          last: '1h ago',
        },
        {
          name: 'The Office Is Open',
          sentence: 'When Someone Arrived then Post to Slack',
          last: 'Today',
        },
        {
          name: 'Stand-Up in Five',
          sentence: 'When Every Weekday at 9:25 then Post to Slack',
          last: 'Today',
        },
      ]}
    />
  );
}
