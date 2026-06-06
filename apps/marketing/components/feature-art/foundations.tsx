// Feature illustrations — foundations + 'simple by design' scenes.
// Split from FeatureArt.tsx; see ./shared for Frame + color constants.
import { BLUE_FILL, BLUE_STROKE, BLUE_TEXT, Frame, PINK, SKY } from './shared';

/* ─────────────────────── Section: foundations ────────────────────── */

export function MitArt() {
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        <div
          className="fa-pop flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm"
          style={{ animationDelay: '0.3s' }}
        >
          <GitHubIcon />
          <span className="text-[9px] font-semibold text-slate-700">livediagram</span>
          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[7px] font-semibold text-white">
            MIT
          </span>
        </div>
        <span className="text-[7px] text-slate-400">editor · api · marketing, all public</span>
      </div>
    </Frame>
  );
}

function GitHubIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="#334155">
      <path d="M8 0C3.6 0 0 3.6 0 8c0 3.5 2.3 6.5 5.5 7.6.4.1.5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3.7 0 1.4.1 2 .3 1.5-1 2.2-.8 2.2-.8.5 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.3.6.8.6 1.6v2.3c0 .2.1.5.6.4C13.7 14.5 16 11.5 16 8c0-4.4-3.6-8-8-8z" />
    </svg>
  );
}

export function NoServersArt() {
  const nodes = ['marketing', 'live', 'api', 'router'];
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-3">
        <div className="flex items-center gap-1 text-[8px] font-medium text-slate-400">
          <CloudIcon /> Cloudflare edge
        </div>
        <div className="flex items-center gap-1.5">
          {nodes.map((n, i) => (
            <span
              key={n}
              className="relative rounded border border-slate-200 bg-white px-1.5 py-1 text-[7px] font-medium text-slate-600"
            >
              <span
                className="fa-pulse absolute inset-0 rounded ring-2 ring-brand-400"
                style={{ animationDelay: `${i * 0.5}s` }}
              />
              <span className="relative">{n}</span>
            </span>
          ))}
        </div>
        <span className="text-[7px] text-slate-400">no VMs · no containers</span>
      </div>
    </Frame>
  );
}

function CloudIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="#f59e0b">
      <path d="M4 12 a3 3 0 0 1 0-6 a4 4 0 0 1 7.6-1 A3 3 0 0 1 12 12 Z" />
    </svg>
  );
}

export function NoTrackingArt() {
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        <svg width="56" height="34" viewBox="0 0 56 34">
          {/* eye */}
          <path
            d="M6 17 C 16 4, 40 4, 50 17 C 40 30, 16 30, 6 17 Z"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />
          <circle cx="28" cy="17" r="5" fill="none" stroke="#94a3b8" strokeWidth="2" />
          {/* slash drawing across it */}
          <line
            className="fa-draw"
            x1="8"
            y1="29"
            x2="48"
            y2="5"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <span
          className="fa-fade text-[8px] font-medium text-slate-500"
          style={{ animationDelay: '0.4s' }}
        >
          0 third-party trackers
        </span>
      </div>
    </Frame>
  );
}

/* ─────────────── Section: simple by design (lead-in) ─────────────────
 * These cards mock the real editor surface like the rest of the page, so
 * the lead-in section stays visually consistent with the sections below. */

// Cursor drawn inside an SVG (vs the HTML Cursor helper) so it can be
// placed precisely in a 220x96 illustration. Optional name label.
function SvgCursor({
  x,
  y,
  color,
  label,
  delay,
}: {
  x: number;
  y: number;
  color: string;
  label?: string;
  delay?: string;
}) {
  // Position with the transform attribute on the outer group; animate the
  // scale on an inner group. (A CSS transform animation on the same element
  // overrides the translate attribute and snaps the element to the origin.)
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="fa-pop" style={{ animationDelay: delay }}>
        <path
          d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z"
          fill={color}
          stroke="white"
          strokeWidth="1"
        />
        {label ? (
          <g>
            <rect x="12" y="-10" width="17" height="11" rx="2" fill={color} />
            <text x="20.5" y="-2" textAnchor="middle" fontSize="7" fontWeight="600" fill="white">
              {label}
            </text>
          </g>
        ) : null}
      </g>
    </g>
  );
}

export function EasyStartArt() {
  // A click creates a shape: the cursor taps (ripple) and a shape pops in.
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <g className="fa-pop" style={{ animationDelay: '0.5s' }}>
          <rect
            x="74"
            y="33"
            width="66"
            height="30"
            rx="15"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
          <text x="107" y="52" textAnchor="middle" fontSize="12" fontWeight="600" fill={BLUE_TEXT}>
            Start
          </text>
        </g>
        <circle
          className="fa-ripple"
          cx="122"
          cy="60"
          r="7"
          fill="none"
          stroke={SKY}
          strokeWidth="1.5"
        />
        <g transform="translate(118 54)" fill={SKY} stroke="white" strokeWidth="1">
          <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
        </g>
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        one click
      </span>
    </Frame>
  );
}

export function DepthArt() {
  // A plain-looking shape, selected, revealing a toolbar of deeper tools.
  const tools = [
    <GroupGlyph key="g" />,
    <LockGlyph key="l" />,
    <LinkGlyph key="k" />,
    <CommentGlyph key="c" />,
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="28"
          y="38"
          width="58"
          height="30"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <rect
          className="fa-pulse"
          x="24"
          y="34"
          width="66"
          height="38"
          rx="9"
          fill="none"
          stroke={SKY}
          strokeWidth="1.5"
        />
      </svg>
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-md">
        {tools.map((g, i) => (
          <span
            key={i}
            className="fa-pop flex h-5 w-5 items-center justify-center rounded text-slate-500"
            style={{ animationDelay: `${0.4 + i * 0.25}s` }}
          >
            {g}
          </span>
        ))}
      </div>
    </Frame>
  );
}

function GroupGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="2" y="2" width="8" height="8" rx="1.5" />
      <rect x="6" y="6" width="8" height="8" rx="1.5" fill="white" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="3.5" y="7" width="9" height="6" rx="1.5" />
      <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" strokeLinecap="round" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path
        d="M6.5 9.5 L9.5 6.5 M7 4.5 L9 2.5 a3 3 0 0 1 4 4 L11 8.5 M9 11.5 L7 13.5 a3 3 0 0 1 -4 -4 L5 7.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommentGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M2.5 3 h11 v7 h-6.5 l-3 2.5 v-2.5 h-1.5 z" strokeLinejoin="round" />
    </svg>
  );
}

export function MultiplayerArt() {
  // The shared canvas: a shape with a remote selection glow and several
  // named cursors arriving.
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="82"
          y="36"
          width="56"
          height="28"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <rect
          className="fa-pulse"
          x="78"
          y="32"
          width="64"
          height="36"
          rx="9"
          fill="none"
          stroke={PINK}
          strokeWidth="2"
        />
        <SvgCursor x={34} y={22} color={SKY} label="TM" delay="0.3s" />
        <SvgCursor x={150} y={58} color={PINK} label="JR" delay="0.8s" />
        <SvgCursor x={58} y={66} color="#8b5cf6" label="AL" delay="1.3s" />
      </svg>
    </Frame>
  );
}

export function AnyDeviceArt() {
  // The same diagram on a laptop, tablet, and phone. A highlight ring
  // cycles across the three (like the template tiles).
  return (
    <Frame>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* shared mini diagram, drawn inside each screen via <use>-like repetition */}
        {/* Laptop */}
        <rect
          x="8"
          y="12"
          width="70"
          height="42"
          rx="3"
          fill="#fff"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <path
          d="M2 58 L84 58 L80 62 L6 62 Z"
          fill="#e2e8f0"
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.2">
          <line x1="40" y1="27" x2="48" y2="41" stroke={BLUE_STROKE} />
          <rect x="22" y="22" width="18" height="10" rx="2" />
          <rect x="48" y="36" width="18" height="10" rx="2" />
        </g>
        <rect
          className="fa-hl"
          x="4"
          y="8"
          width="78"
          height="50"
          rx="5"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
          style={{ animationDelay: '0s' }}
        />
        <text x="43" y="74" textAnchor="middle" fontSize="7" fontWeight="500" fill="#64748b">
          Laptop
        </text>

        {/* Tablet */}
        <rect
          x="92"
          y="12"
          width="46"
          height="56"
          rx="5"
          fill="#fff"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.2">
          <line x1="110" y1="34" x2="121" y2="44" stroke={BLUE_STROKE} />
          <rect x="100" y="24" width="18" height="10" rx="2" />
          <rect x="113" y="44" width="18" height="10" rx="2" />
        </g>
        <rect
          className="fa-hl"
          x="88"
          y="8"
          width="54"
          height="64"
          rx="7"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
          style={{ animationDelay: '2s' }}
        />
        <text x="115" y="80" textAnchor="middle" fontSize="7" fontWeight="500" fill="#64748b">
          Tablet
        </text>

        {/* Phone */}
        <rect
          x="150"
          y="14"
          width="30"
          height="54"
          rx="5"
          fill="#fff"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <rect x="160" y="17" width="10" height="1.6" rx="0.8" fill="#cbd5e1" />
        <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.2">
          <line x1="163" y1="34" x2="167" y2="42" stroke={BLUE_STROKE} />
          <rect x="155" y="24" width="20" height="9" rx="2" />
          <rect x="156" y="42" width="20" height="9" rx="2" />
        </g>
        <rect
          className="fa-hl"
          x="146"
          y="10"
          width="38"
          height="62"
          rx="7"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
          style={{ animationDelay: '4s' }}
        />
        <text x="165" y="80" textAnchor="middle" fontSize="7" fontWeight="500" fill="#64748b">
          Phone
        </text>
      </svg>
    </Frame>
  );
}
