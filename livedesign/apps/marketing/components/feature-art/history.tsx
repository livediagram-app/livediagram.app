// The Collaborate section's cards for keeping and handing over the work (docs/specs/012-collaboration/walkthroughs.md,
// liveworkspace's snapshots and approvals specs): History with its snapshots pinned on the timeline, a walkthrough
// playing over the design, and a request for approval answered. Built on page-kit so each reads in light and dark;
// motion is the fa-e-* loops in app/feature-art/pages.css, settled to the finished frame under reduced motion.

import type { CSSProperties } from 'react';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  AMBER,
  at,
  EMERALD,
  INK,
  INK_SOFT,
  LINE,
  Lines,
  Page,
  Panel,
  SKY,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';
import { Avatar, JORDAN, YOU } from './canvas-parts';

/** A camera, as the snapshot's pin on the timeline draws it. */
function Camera({ x, y }: { x: number; y: number }) {
  return (
    <g fill="none" stroke="#ffffff" strokeWidth="0.8" strokeLinejoin="round">
      <rect x={x - 2.6} y={y - 1.6} width="5.2" height="3.6" rx="0.8" />
      <circle cx={x} cy={y + 0.2} r="1" />
    </g>
  );
}

/** History: who changed what, Take Snapshot over the timeline, a snapshot pinned on it with Revert. */
export function SnapshotsArt() {
  const entries = [
    { who: 'TM', colour: YOU, what: 'Moved the logo', when: '2m', y: 34 },
    { who: 'JR', colour: JORDAN, what: 'Recoloured Checkout', when: '9m', y: 50 },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Panel x={50} y={4} w={200} h={88} title="History" />
        <rect
          className="fill-brand-700 dark:fill-brand-600"
          x="190"
          y="7.5"
          width="52"
          height="10"
          rx="3"
          fill="#be123c"
        />
        <text x="216" y="14.2" textAnchor="middle" fontSize="5" fontWeight="700" fill="#ffffff">
          Take Snapshot
        </text>
        {/* The timeline's rail. */}
        <rect className={LINE} x="66.6" y="24" width="0.8" height="62" fill="#e2e8f0" />
        {entries.map((e) => (
          <g key={e.who}>
            <Avatar cx={67} cy={e.y} r={5} color={e.colour} initials={e.who} />
            <text x="78" y={e.y + 1.8} fontSize="5.4" className={INK} fill="#1e293b">
              {e.what}
            </text>
            <text
              x="240"
              y={e.y + 1.8}
              textAnchor="end"
              fontSize="5"
              className={INK_SOFT}
              fill="#64748b"
            >
              {e.when}
            </text>
          </g>
        ))}
        {/* The snapshot, pinned on the timeline as it is taken. */}
        <g className="fa-e-pop" style={at(0.5)}>
          <rect
            x="74"
            y="62"
            width="170"
            height="20"
            rx="3"
            className="fill-brand-50 stroke-brand-300 dark:fill-brand-500/15 dark:stroke-brand-500/50"
            fill="#fff1f2"
            stroke="#fda4af"
            strokeWidth="0.8"
          />
          <circle className="fill-brand-600" cx="67" cy="72" r="5" fill="#e11d48" />
          <Camera x={67} y={72} />
          <text x="80" y="70.6" fontSize="5.4" fontWeight="700" className={INK} fill="#1e293b">
            Before the workshop
          </text>
          <text x="80" y="77.8" fontSize="4.6" className={INK_SOFT} fill="#64748b">
            Snapshot · just now
          </text>
          <rect
            className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-500"
            x="210"
            y="66.5"
            width="28"
            height="11"
            rx="3"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="0.8"
          />
          <text
            x="224"
            y="73.6"
            textAnchor="middle"
            fontSize="5"
            fontWeight="600"
            className={INK}
            fill="#1e293b"
          >
            Revert
          </text>
        </g>
      </svg>
    </Frame>
  );
}

/** Walkthroughs: the recording playing over the design, the presenter's pointer and camera bubble, the player bar. */
export function WalkthroughArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The design underneath: a logo page and a screen beside it. */}
        <Page x={40} y={8} w={64} h={64}>
          <circle cx="72" cy="34" r="12" fill={SKY} fillOpacity="0.85" />
          <rect className={LINE} x="56" y="52" width="32" height="4" rx="2" fill="#e2e8f0" />
        </Page>
        <Page x={116} y={8} w={40} h={64}>
          <rect className={LINE} x="121" y="14" width="30" height="16" rx="2" fill="#e2e8f0" />
          <Lines x={121} y={35} w={30} count={4} gap={5} />
        </Page>
        {/* The presenter's path across the design, and their pointer. */}
        <path
          className="fa-e-draw"
          style={{ ...at(0.3), '--e-len': 90 } as CSSProperties}
          d="M78 40 C 96 58 118 22 140 44"
          fill="none"
          stroke={AMBER}
          strokeWidth="0.9"
          strokeDasharray="90"
        />
        <g className="fa-e-in" style={at(1.4)}>
          <path
            d="M140 44 L140 52 L142.2 50 L143.7 53.2 L145 52.6 L143.6 49.5 L146.6 49.3 Z"
            fill={AMBER}
            stroke="#ffffff"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
        </g>
        {/* The camera bubble in its corner. */}
        <circle
          className="stroke-white dark:stroke-slate-900"
          cx="246"
          cy="34"
          r="16"
          fill={AMBER}
          fillOpacity="0.25"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        <circle cx="246" cy="29" r="5.5" fill={AMBER} />
        <path d="M235 46 a11 9 0 0 1 22 0 Z" fill={AMBER} />
        {/* The player: play, the scrubber, the time and the speed. */}
        <rect
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
          x="30"
          y="78"
          width="240"
          height="13"
          rx="6.5"
          fill="#ffffff"
          stroke="#e2e8f0"
          strokeWidth="0.8"
        />
        <path d="M39 81.5v6l5-3z" fill={AMBER} />
        <rect className={LINE} x="52" y="83.6" width="160" height="1.8" rx="0.9" fill="#e2e8f0" />
        <path
          className="fa-e-draw"
          style={{ ...at(0.3), '--e-len': 100 } as CSSProperties}
          d="M52 84.5h100"
          stroke={AMBER}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <text x="218" y="86.6" fontSize="5" className={INK_SOFT} fill="#64748b">
          1:24
        </text>
        <text
          x="262"
          y="86.6"
          textAnchor="end"
          fontSize="5"
          fontWeight="700"
          className={INK}
          fill="#1e293b"
        >
          1.5x
        </text>
      </svg>
    </Frame>
  );
}

/** Request Approval: the approver's banner, Approve pressed, and the badge turning to Approved. */
export function ApprovalArt() {
  const approvers = [
    { who: 'TM', colour: YOU },
    { who: 'JR', colour: JORDAN },
    { who: 'AK', colour: AMBER },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The banner an approver sees under the header (packages/explorer ApprovalBanner): amber, the ask
            and its due day, the requester's note, then Request Changes and Approve. */}
        <rect
          className="fill-amber-50 stroke-amber-200 dark:fill-amber-950 dark:stroke-amber-500/40"
          x="20"
          y="10"
          width="260"
          height="34"
          rx="5"
          fill="#fffbeb"
          stroke="#fde68a"
          strokeWidth="0.8"
        />
        <circle
          className="fill-amber-100 dark:fill-amber-500/25"
          cx="32"
          cy="27"
          r="6"
          fill="#fef3c7"
        />
        <path
          className="stroke-amber-700 dark:stroke-amber-200"
          d="M29.6 23.6h3.4l1.6 1.6v5.2h-5z M30.8 27.6l1 1 1.8-1.9"
          fill="none"
          stroke="#b45309"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x="42"
          y="24.5"
          fontSize="5.6"
          className="fill-amber-950 dark:fill-amber-100"
          fill="#451a03"
        >
          <tspan fontWeight="700">Ada</tspan> asked you to approve this design by{' '}
          <tspan fontWeight="700">21 Nov</tspan>.
        </text>
        <text
          x="42"
          y="33.5"
          fontSize="5"
          className="fill-amber-900/80 dark:fill-amber-100/80"
          fill="#78350f"
        >
          Check the checkout flow before launch.
        </text>
        <rect
          className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-500"
          x="184"
          y="21"
          width="50"
          height="12"
          rx="3"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="0.8"
        />
        <text
          x="209"
          y="28.8"
          textAnchor="middle"
          fontSize="4.8"
          fontWeight="600"
          className={INK}
          fill="#1e293b"
        >
          Request Changes
        </text>
        <rect
          className="fill-brand-700 dark:fill-brand-600"
          x="238"
          y="21"
          width="34"
          height="12"
          rx="3"
          fill="#be123c"
        />
        <text x="255" y="28.8" textAnchor="middle" fontSize="5.2" fontWeight="700" fill="#ffffff">
          Approve
        </text>
        <g className="fa-e-pop" style={at(0.6)}>
          <circle cx="255" cy="27" r="5" fill="#ffffff" fillOpacity="0.4" />
        </g>

        {/* The approvers answering, one tick at a time. */}
        {approvers.map((a, i) => (
          <g key={a.who}>
            <Avatar cx={44 + i * 18} cy={66} r={6} color={a.colour} initials={a.who} />
            <g className="fa-e-pop" style={at(0.9 + i * 0.4)}>
              <circle cx={49 + i * 18} cy="71" r="3" fill={EMERALD} />
              <path
                d={`M${47.6 + i * 18} 71l1 1 1.9-2`}
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
            </g>
          </g>
        ))}

        {/* The badge: waiting on answers, then Approved once the last one lands. */}
        <rect x="190" y="59" width="80" height="14" rx="7" fill={AMBER} fillOpacity="0.18" />
        <text
          className="fill-amber-700 dark:fill-amber-300"
          x="230"
          y="68.2"
          textAnchor="middle"
          fontSize="5.6"
          fontWeight="700"
          fill="#b45309"
        >
          Awaiting 1 of 3
        </text>
        <g className="fa-e-pop" style={at(2.1)}>
          <rect
            className="fill-emerald-50 dark:fill-emerald-950"
            x="190"
            y="59"
            width="80"
            height="14"
            rx="7"
            fill="#ecfdf5"
          />
          <rect x="190" y="59" width="80" height="14" rx="7" fill={EMERALD} fillOpacity="0.2" />
          <text
            className="fill-emerald-700 dark:fill-emerald-300"
            x="230"
            y="68.2"
            textAnchor="middle"
            fontSize="5.6"
            fontWeight="700"
            fill="#047857"
          >
            Approved
          </text>
        </g>
      </svg>
    </Frame>
  );
}
