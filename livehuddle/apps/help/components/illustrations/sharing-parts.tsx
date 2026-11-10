// The Share dialog's building blocks the Sharing scenes compose (sharing.tsx, sharing-pass-options.tsx):
// the pass with its role band, the active pass and its link field, the menu buttons, the Valid control
// and the dialog card. Mirrors the live Share dialog's parts.

import type { ReactNode } from 'react';
import { Label } from '@liveworkspace/help-site/art/primitives';

type Role = 'edit' | 'participate' | 'view';

// --- Shared pieces -----------------------------------------------------------

/** The uppercase caption the dialog's bands share ("ISSUE A PASS", "PASSES", "EXPIRED"). */
export function SectionLabel({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <Label x={x} y={y} size={10} weight={700} tone="muted">
      {children}
    </Label>
  );
}

/** A pass: a role-coloured header band across the top (EDITOR brand, PARTICIPANT teal, VIEWER
 *  violet, greyed when expired) and a body the caller fills. Mirrors SharePassTicket. */
const PASS_BAND = 18;
export function Pass({
  x,
  y,
  w,
  h,
  role,
  expired = false,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  role: Role;
  expired?: boolean;
  children?: ReactNode;
}) {
  const bandFill = expired
    ? 'fill-slate-200'
    : role === 'edit'
      ? 'fill-brand-700'
      : role === 'participate'
        ? 'fill-teal-700'
        : 'fill-violet-500 dark:fill-violet-700';
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className={expired ? 'fill-slate-50 stroke-slate-200' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
      />
      <path
        d={`M${x} ${y + PASS_BAND} V${y + 10} a10 10 0 0 1 10 -10 H${x + w - 10} a10 10 0 0 1 10 10 V${y + PASS_BAND} Z`}
        className={bandFill}
      />
      {/* The role's glyph, then its stamp. */}
      <circle
        cx={x + 15}
        cy={y + PASS_BAND / 2}
        r={3.5}
        className={expired ? 'fill-none stroke-slate-400' : 'fill-none stroke-white'}
        strokeWidth={1.3}
      />
      <Label
        x={x + 24}
        y={y + PASS_BAND / 2 + 1}
        size={9}
        weight={700}
        tone={expired ? 'muted' : 'onAccent'}
      >
        {role === 'edit' ? 'EDITOR' : role === 'participate' ? 'PARTICIPANT' : 'VIEWER'}
      </Label>
      {children}
    </g>
  );
}

/** Where a pass's Embed and Live image buttons sit: grouped at the right of its second row,
 *  before the bin, as ActiveSharePass lays them out from sm up. */
export function passMenus(x: number, w: number) {
  const bin = x + w - 22;
  const image = bin - 8 - menuButtonWidth('Live image');
  const embed = image - 6 - menuButtonWidth('Embed');
  return { embed, image, bin };
}

/** An active pass: the link with its copy button, then one row holding Valid (and the Password
 *  tag) at the left and Embed, Live image and the bin at the right. 84 tall. */
export function ActivePass({
  x,
  y,
  w,
  role,
  left,
  password = false,
  open,
}: {
  x: number;
  y: number;
  w: number;
  role: Role;
  /** A countdown chip in place of Forever. */
  left?: string;
  password?: boolean;
  open?: 'embed' | 'image';
}) {
  const m = passMenus(x, w);
  const rowY = y + 56;
  return (
    <Pass x={x} y={y} w={w} h={84} role={role}>
      <LinkField x={x + 12} y={y + 26} w={w - 24} />
      <Label x={x + 12} y={rowY + 10} size={9} weight={700} tone="muted">
        VALID
      </Label>
      {left ? (
        <g>
          <rect
            x={x + 46}
            y={rowY + 1}
            width={58}
            height={18}
            rx={9}
            className="fill-amber-50 stroke-amber-300"
            strokeWidth={1}
          />
          <circle
            cx={x + 56}
            cy={rowY + 10}
            r={3.5}
            className="fill-none stroke-amber-600"
            strokeWidth={1.1}
          />
          <path d={`M${x + 56} ${rowY + 8} v2 h1.6`} className="stroke-amber-600" strokeWidth={1} />
          <Label x={x + 64} y={rowY + 11} size={9.5} weight={600} className="fill-amber-700">
            {left}
          </Label>
        </g>
      ) : (
        <Label x={x + 46} y={rowY + 10} size={10} weight={600} tone="body">
          Forever
        </Label>
      )}
      {password ? (
        <g>
          <Lock x={x + (left ? 112 : 92)} y={rowY + 3} className="stroke-emerald-600" />
          <Label
            x={x + (left ? 125 : 105)}
            y={rowY + 10}
            size={10}
            weight={600}
            className="fill-emerald-700 dark:fill-emerald-300"
          >
            Password
          </Label>
        </g>
      ) : null}
      <MenuButton
        x={password ? m.image + menuButtonWidth('Live image') - menuButtonWidth('Embed') : m.embed}
        y={rowY}
        label="Embed"
        active={open === 'embed'}
      />
      {/* A password hides Live image (ActiveSharePass): it can't serve a protected document. */}
      {password ? null : (
        <MenuButton x={m.image} y={rowY} label="Live image" active={open === 'image'} />
      )}
      <Bin x={m.bin} y={rowY + 4} />
    </Pass>
  );
}

/** The pass's read-only link field with the copy glyph inside its right edge. */
export function LinkField({
  x,
  y,
  w,
  struck = false,
}: {
  x: number;
  y: number;
  w: number;
  struck?: boolean;
}) {
  return (
    <g>
      {struck ? null : (
        <rect
          x={x}
          y={y}
          width={w}
          height={22}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
      )}
      <Label x={x + 8} y={y + 12} size={10} tone="muted">
        livehuddle.app/document/shared?s=…
      </Label>
      {struck ? (
        <line
          x1={x + 6}
          y1={y + 12}
          x2={x + 186}
          y2={y + 12}
          className="stroke-slate-400"
          strokeWidth={1.2}
        />
      ) : (
        <g transform={`translate(${x + w - 18} ${y + 6})`}>
          <rect
            x={3}
            y={3}
            width={7}
            height={8}
            rx={1.5}
            fill="none"
            className="stroke-slate-400"
            strokeWidth={1.3}
          />
          <path
            d="M1 9 V2.5 a1.5 1.5 0 0 1 1.5 -1.5 h5"
            fill="none"
            className="stroke-slate-400"
            strokeWidth={1.3}
          />
        </g>
      )}
    </g>
  );
}

export function menuButtonWidth(label: string) {
  return label.length * 6.2 + 32;
}

/** A small "Embed ⋯" style menu button. */
function MenuButton({
  x,
  y,
  label,
  active = false,
}: {
  x: number;
  y: number;
  label: string;
  active?: boolean;
}) {
  const w = menuButtonWidth(label);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={5}
        className={active ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'}
        strokeWidth={1.2}
      />
      <Label x={x + 8} y={y + 11} size={10} weight={500} tone={active ? 'accent' : 'body'}>
        {label}
      </Label>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={x + w - 13 + i * 4} cy={y + 10} r={1.1} className="fill-slate-400" />
      ))}
    </g>
  );
}

/** The bin (Revoke link / Delete expired link). */
export function Bin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="fill-none stroke-slate-400" strokeWidth={1.3}>
      <path d="M1 3 H11 M4 3 V1.5 H8 V3 M2.5 3 L3.2 12 H8.8 L9.5 3" strokeLinejoin="round" />
    </g>
  );
}

/** A small lock glyph. */
export function Lock({
  x,
  y,
  className = 'stroke-slate-400',
}: {
  x: number;
  y: number;
  className?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`} className={`fill-none ${className}`} strokeWidth={1.3}>
      <rect x={0} y={4.5} width={9} height={6.5} rx={1.5} />
      <path d="M2 4.5 V3 a2.5 2.5 0 0 1 5 0 V4.5" />
    </g>
  );
}

/** The Valid segmented control: Forever / 1 week / 1 month / 6 months, with the pick filled in
 *  the chosen role's colour. */
export function LifetimeControl({
  x,
  y,
  w,
  active,
  role = 'edit',
}: {
  x: number;
  y: number;
  w: number;
  active: number;
  role?: Role;
}) {
  const opts = ['Forever', '1 week', '1 month', '6 months'];
  const segW = (w - 4) / opts.length;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={26}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {opts.map((opt, i) => {
        const sx = x + 2 + i * segW;
        const on = i === active;
        return (
          <g key={opt}>
            {on && (
              <rect
                x={sx}
                y={y + 2}
                width={segW}
                height={22}
                rx={5}
                className={
                  role === 'edit'
                    ? 'fill-brand-700'
                    : role === 'participate'
                      ? 'fill-teal-700'
                      : 'fill-violet-500 dark:fill-violet-700'
                }
              />
            )}
            <Label
              x={sx + segW / 2}
              y={y + 14}
              anchor="middle"
              size={10}
              weight={on ? 600 : 400}
              tone={on ? 'onAccent' : 'body'}
            >
              {opt}
            </Label>
          </g>
        );
      })}
    </g>
  );
}

/** The dialog card the Share scenes draw into, with its real title and an optional status line. */
export function ShareCard({
  x,
  y,
  w,
  h,
  status,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  status?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={x + 16} y={y + 20} size={13} weight={700} tone="strong">
        Share This Space
      </Label>
      {status ? (
        <g>
          <circle cx={x + 20} cy={y + 38} r={3.5} className="fill-emerald-500" />
          <Label x={x + 30} y={y + 39} size={10} tone="body">
            {status}
          </Label>
        </g>
      ) : null}
      {children}
    </g>
  );
}
