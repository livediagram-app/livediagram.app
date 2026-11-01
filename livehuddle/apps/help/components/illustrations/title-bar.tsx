// The editor's title bar for the User Interface › The Title Bar article (docs/specs/018-help/help-app.md).
// Drawn from the live header (apps/editor/components/chrome/EditorHeader.tsx): the logo and section menu,
// the document name, the visibility pill (SharedBadge), the role pill (RoleIndicator), Share and the
// account button; and the visibility pill's legend (VisibilityLegend). Labels are the real UI strings,
// in capitals where the editor prints them in capitals.

import type { ReactNode } from 'react';
import { Avatar, Label, Scene } from '@liveworkspace/help-site/art/primitives';

// --- Glyphs ------------------------------------------------------------------

const STROKE = {
  fill: 'none',
  strokeWidth: 1.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Glyph({
  x,
  y,
  cls,
  children,
}: {
  x: number;
  y: number;
  cls: string;
  children: ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`} className={cls} {...STROKE}>
      {children}
    </g>
  );
}

function LockGlyph({ x, y, cls }: { x: number; y: number; cls: string }) {
  return (
    <Glyph x={x} y={y} cls={cls}>
      <rect x={-4} y={-1} width={8} height={6} rx={1.2} />
      <path d="M-2.5 -1 v-2 a2.5 2.5 0 0 1 5 0 v2" />
    </Glyph>
  );
}

function LinkGlyph({ x, y, cls }: { x: number; y: number; cls: string }) {
  return (
    <Glyph x={x} y={y} cls={cls}>
      <path d="M-1 2.5 l-1.5 1.5 a2.2 2.2 0 0 1 -3 -3 l1.5 -1.5" />
      <path d="M1 -2.5 l1.5 -1.5 a2.2 2.2 0 0 1 3 3 l-1.5 1.5" />
      <path d="M-2 2 l4 -4" />
    </Glyph>
  );
}

function TeamGlyph({ x, y, cls }: { x: number; y: number; cls: string }) {
  return (
    <Glyph x={x} y={y} cls={cls}>
      <circle cx={-1.5} cy={-2} r={2} />
      <path d="M-5 4.5 a3.5 3.5 0 0 1 7 0" />
      <path d="M2.5 -3.8 a2 2 0 0 1 0 3.6 M3.5 1.5 a3.5 3.5 0 0 1 1.5 3" />
    </Glyph>
  );
}

function GlobeGlyph({ x, y, cls }: { x: number; y: number; cls: string }) {
  return (
    <Glyph x={x} y={y} cls={cls}>
      <circle r={4.8} />
      <ellipse rx={2} ry={4.8} />
      <path d="M-4.8 0 h9.6" />
    </Glyph>
  );
}

function BrowserGlyph({ x, y, cls }: { x: number; y: number; cls: string }) {
  return (
    <Glyph x={x} y={y} cls={cls}>
      <rect x={-4.5} y={-3.8} width={9} height={7.6} rx={1.3} />
      <path d="M-4.5 -1.2 h9" />
    </Glyph>
  );
}

function ShareGlyph({ x, y }: { x: number; y: number }) {
  return (
    <Glyph x={x} y={y} cls="stroke-white help-art-as-drawn">
      <circle cx={-3.5} cy={0} r={1.5} />
      <circle cx={3.5} cy={-4} r={1.5} />
      <circle cx={3.5} cy={4} r={1.5} />
      <path d="M-2.2 -0.7 l4.4 -2.6 M-2.2 0.7 l4.4 2.6" />
    </Glyph>
  );
}

// --- The title bar -------------------------------------------------------------

/** A callout under the bar: a thin leader from the bar's edge down to its words. */
function Callout({
  x,
  row,
  text,
  anchor = 'middle',
  labelX,
}: {
  x: number;
  row: 1 | 2;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  labelX?: number;
}) {
  const labelY = row === 1 ? 80 : 102;
  return (
    <g>
      <line
        x1={x}
        y1={56}
        x2={x}
        y2={labelY - 9}
        className="stroke-slate-300"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <circle cx={x} cy={56} r={1.8} className="fill-slate-400" />
      <Label x={labelX ?? x} y={labelY} size={10} weight={600} tone="body" anchor={anchor}>
        {text}
      </Label>
    </g>
  );
}

/** The title bar as the owner of a shared document sees it: logo and section menu, the
 *  document name, the SHARED visibility pill, the EDITING role pill, a solid Share button and
 *  the account button. */
export function TitleBarParts() {
  const y = 14;
  return (
    <Scene w={420} h={114}>
      <rect x={0} y={y} width={420} height={40} className="fill-white" />
      <line x1={0} y1={y} x2={420} y2={y} className="stroke-slate-200" strokeWidth={1.2} />
      <line
        x1={0}
        y1={y + 40}
        x2={420}
        y2={y + 40}
        className="stroke-slate-200"
        strokeWidth={1.2}
      />
      {/* The logo, with the chevron of its site switcher (liveworkspace/docs/specs/010-site/site-switcher.md). */}
      <rect x={10} y={y + 10} width={20} height={20} rx={5} className="fill-brand-500" />
      <path
        d={`M15 ${y + 23} l4 -6 l3 4 l3 -3`}
        className="stroke-white help-art-as-drawn"
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={40} y={y + 21} size={10} weight={600} tone="body">
        livediagram
      </Label>
      <path
        d={`M102 ${y + 19} l3 3 l3 -3`}
        className="stroke-slate-400"
        fill="none"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      {/* The document name: click to rename. */}
      <Label x={118} y={y + 21} size={11} tone="body">
        Checkout Flow
      </Label>
      {/* The visibility pill (SharedBadge), Shared state. */}
      <rect
        x={202}
        y={y + 11}
        width={56}
        height={18}
        rx={9}
        className="fill-emerald-50 stroke-emerald-200"
        strokeWidth={1}
      />
      <circle cx={211} cy={y + 20} r={3} className="fill-emerald-500" />
      <Label
        x={218}
        y={y + 21}
        size={8.5}
        weight={700}
        className="fill-emerald-700 dark:fill-emerald-300"
      >
        SHARED
      </Label>
      {/* The role pill (RolePill), Editing. */}
      <rect x={264} y={y + 11} width={54} height={18} rx={9} className="fill-emerald-100" />
      <Label
        x={291}
        y={y + 21}
        size={8.5}
        weight={700}
        anchor="middle"
        className="fill-emerald-800 dark:fill-emerald-200"
      >
        EDITING
      </Label>
      {/* Share: full height, solid once the document has a live link. */}
      <rect x={336} y={y} width={58} height={40} className="fill-brand-700" />
      <ShareGlyph x={348} y={y + 20} />
      <Label x={358} y={y + 21} size={11} weight={600} tone="onAccent">
        Share
      </Label>
      {/* The account button: your initial. */}
      <Avatar cx={407} cy={y + 20} r={9} initial="S" />

      <Callout x={40} row={2} text="Logo and menu" />
      <Callout x={157} row={1} text="Canvas name" />
      <Callout x={230} row={2} text="Visibility pill" />
      <Callout x={291} row={1} text="Role pill" />
      <Callout x={365} row={2} text="Share" />
      <Callout x={407} row={1} text="Account" anchor="end" labelX={416} />
    </Scene>
  );
}

// --- The visibility legend -------------------------------------------------------

const STOPS = [
  { word: 'Just you', Icon: LockGlyph },
  { word: 'Link', Icon: LinkGlyph },
  { word: 'Team', Icon: TeamGlyph },
  { word: 'Everyone', Icon: GlobeGlyph },
] as const;

/** The legend that opens under the visibility pill, for a Shared document: the hero with its
 *  reach rings, the four audiences from Just you to Everyone with Link filled to, This Browser
 *  apart beneath them, and Change Who Can See This for the owner. */
export function VisibilityLegendFigure() {
  const cardX = 70;
  const cardW = 280;
  const top = 40;
  const bottom = 290;
  const ringsX = 112;
  const ringsY = top + 40;
  const stopY = 166;
  const stopXs = [117, 179, 241, 303];
  return (
    <Scene w={420} h={300}>
      {/* The pill the legend hangs from, beside the document name. */}
      <Label x={176} y={21} size={11} tone="body" anchor="end">
        Checkout Flow
      </Label>
      <rect
        x={184}
        y={12}
        width={56}
        height={18}
        rx={9}
        className="fill-emerald-50 stroke-emerald-200"
        strokeWidth={1}
      />
      <circle cx={193} cy={21} r={3} className="fill-emerald-500" />
      <Label
        x={200}
        y={22}
        size={8.5}
        weight={700}
        className="fill-emerald-700 dark:fill-emerald-300"
      >
        SHARED
      </Label>

      {/* The card. */}
      <rect
        x={cardX}
        y={top}
        width={cardW}
        height={bottom - top}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Hero: the current state's wash, its reach rings and its words. */}
      <path
        d={`M${cardX} ${top + 12} a12 12 0 0 1 12 -12 H${cardX + cardW - 12} a12 12 0 0 1 12 12 V${top + 82} H${cardX} Z`}
        className="fill-emerald-50"
      />
      <circle
        cx={ringsX}
        cy={ringsY}
        r={13}
        className="fill-emerald-500/15 stroke-emerald-500"
        strokeWidth={1.4}
      />
      {[20, 27].map((r) => (
        <circle
          key={r}
          cx={ringsX}
          cy={ringsY}
          r={r}
          fill="none"
          className="stroke-emerald-300"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      ))}
      {[-60, 12].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <circle
            key={deg}
            cx={ringsX + 13 * Math.cos(a)}
            cy={ringsY + 13 * Math.sin(a)}
            r={2.4}
            className="fill-emerald-600"
          />
        );
      })}
      <circle cx={ringsX} cy={ringsY} r={7} className="fill-emerald-600" />
      <circle cx={ringsX} cy={ringsY - 2} r={2.1} className="fill-white help-art-as-drawn" />
      <path
        d={`M${ringsX - 3.8} ${ringsY + 4} a3.8 3.8 0 0 1 7.6 0`}
        className="fill-white help-art-as-drawn"
      />
      <Label
        x={152}
        y={top + 22}
        size={8.5}
        weight={700}
        className="fill-emerald-700 dark:fill-emerald-300"
      >
        WHO CAN SEE THIS
      </Label>
      <LinkGlyph x={158} y={top + 40} cls="stroke-emerald-600" />
      <Label x={168} y={top + 41} size={14} weight={700} tone="strong">
        Shared
      </Label>
      <Label x={152} y={top + 60} size={9.5} tone="body">
        Anyone with a link can open it.
      </Label>

      {/* The audiences on one scale, filled to the current stop. */}
      <Label x={86} y={top + 100} size={8.5} weight={700} tone="muted">
        FROM JUST YOU TO EVERYONE
      </Label>
      <rect x={117} y={stopY - 2} width={186} height={4} rx={2} className="fill-slate-100" />
      <rect x={117} y={stopY - 2} width={62} height={4} rx={2} className="fill-emerald-400" />
      {STOPS.map(({ word, Icon }, i) => {
        const cx = stopXs[i]!;
        const current = i === 1;
        const reached = i < 1;
        return (
          <g key={word}>
            {current ? (
              <>
                <circle cx={cx} cy={stopY} r={17} className="fill-emerald-100" />
                <circle cx={cx} cy={stopY} r={14} className="fill-emerald-600" />
              </>
            ) : (
              <circle
                cx={cx}
                cy={stopY}
                r={12}
                className={reached ? 'fill-white stroke-slate-300' : 'fill-white stroke-slate-200'}
                strokeWidth={reached ? 2 : 1.2}
              />
            )}
            <Icon
              x={cx}
              y={stopY}
              cls={
                current
                  ? 'stroke-white help-art-as-drawn'
                  : reached
                    ? 'stroke-slate-600'
                    : 'stroke-slate-400'
              }
            />
            <Label
              x={cx}
              y={stopY + 27}
              size={9.5}
              weight={current ? 700 : 400}
              tone={current ? 'strong' : 'muted'}
              anchor="middle"
            >
              {word}
            </Label>
          </g>
        );
      })}

      {/* This Browser, apart from the scale. */}
      <rect x={82} y={212} width={256} height={28} rx={8} className="fill-slate-50" />
      <circle cx={97} cy={226} r={9} className="fill-white stroke-teal-200" strokeWidth={1} />
      <BrowserGlyph x={97} y={226} cls="stroke-teal-700" />
      <Label x={112} y={227} size={9} tone="body">
        <tspan fontWeight={700} className="fill-slate-800">
          Or This Browser
        </tspan>
        : never leaves this browser.
      </Label>

      {/* For the owner: Change Who Can See This opens Share. */}
      <rect x={82} y={250} width={256} height={28} rx={8} className="fill-brand-700" />
      <Label x={198} y={265} size={10.5} weight={700} tone="onAccent" anchor="middle">
        Change Who Can See This
      </Label>
      <path
        d="M279 261 l4 4 l-4 4"
        className="stroke-white help-art-as-drawn"
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Scene>
  );
}
