// Share dialog, share-gate and Community scenes for the Collaboration › Sharing articles
// (docs/specs/018-help/help-app.md). Drawn from the live Share dialog
// (apps/editor/components/dialogs/Share*.tsx): every link is a pass with a role-coloured band across its top, the
// composer's fine print holds Opens / Valid / Create Pass, and the password is one switch beneath the
// passes. Labels are the real UI strings.

import type { ReactNode } from 'react';
import { Button, Label, Scene, Shape, TextBar } from './primitives';

type Role = 'edit' | 'participate' | 'view';

// --- Shared pieces -----------------------------------------------------------

/** The uppercase caption the dialog's bands share ("ISSUE A PASS", "PASSES", "EXPIRED"). */
function SectionLabel({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <Label x={x} y={y} size={10} weight={700} tone="muted">
      {children}
    </Label>
  );
}

/** A pass: a role-coloured header band across the top (EDITOR brand, PARTICIPANT teal, VIEWER
 *  violet, greyed when expired) and a body the caller fills. Mirrors SharePassTicket. */
const PASS_BAND = 18;
function Pass({
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
function passMenus(x: number, w: number) {
  const bin = x + w - 22;
  const image = bin - 8 - menuButtonWidth('Live image');
  const embed = image - 6 - menuButtonWidth('Embed');
  return { embed, image, bin };
}

/** An active pass: the link with its copy button, then one row holding Valid (and the Password
 *  tag) at the left and Embed, Live image and the bin at the right. 84 tall. */
function ActivePass({
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
function LinkField({
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
        livediagram.app/document/shared?s=…
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

function menuButtonWidth(label: string) {
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
function Bin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="fill-none stroke-slate-400" strokeWidth={1.3}>
      <path d="M1 3 H11 M4 3 V1.5 H8 V3 M2.5 3 L3.2 12 H8.8 L9.5 3" strokeLinejoin="round" />
    </g>
  );
}

/** A small lock glyph. */
function Lock({
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
function LifetimeControl({
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
function ShareCard({
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
        Share This Canvas
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

// --- Scenes ------------------------------------------------------------------

/** The Share dialog: Issue a pass (the role picker unfolded to its three roles, Valid, Create Pass)
 *  above the live passes. Mirrors ShareRolePicker: one card naming the chosen role, unfolding the
 *  roles beneath it. */
export function SharePassesDialog() {
  const x = 14;
  const w = 392;
  const roles: { title: string; blurb: string; tile: string; text: string; on: boolean }[] = [
    {
      title: 'Editor',
      blurb: 'Draws with you in real time.',
      tile: 'fill-brand-700',
      text: 'fill-brand-700 dark:fill-brand-300',
      on: true,
    },
    {
      title: 'Participant',
      blurb: "Adds stickies, writes and votes. Can't reshape the board.",
      tile: 'fill-teal-600',
      text: 'fill-teal-800 dark:fill-teal-300',
      on: false,
    },
    {
      title: 'Viewer',
      blurb: "Watches, pans and zooms. Can't comment, vote or change a thing.",
      tile: 'fill-violet-500 dark:fill-violet-700',
      text: 'fill-violet-700 dark:fill-violet-300',
      on: false,
    },
  ];
  const panelX = x + 16;
  const panelW = w - 32;
  return (
    <Scene w={420} h={426} bg="plain">
      <ShareCard x={x} y={8} w={w} h={410} status="Shared: anyone holding the pass can get in.">
        {/* The dialog's two tabs, Passes chosen. */}
        <Label x={x + 20} y={70} size={11} weight={700} tone="accent">
          Passes
        </Label>
        <line
          x1={x + 16}
          y1={78}
          x2={x + 62}
          y2={78}
          className="stroke-brand-500"
          strokeWidth={2}
        />
        <Label x={x + 76} y={70} size={11} weight={500} tone="muted">
          Community
        </Label>
        <line
          x1={x + 1}
          y1={79}
          x2={x + w - 1}
          y2={79}
          className="stroke-slate-200"
          strokeWidth={1}
        />
        <g transform="translate(0 22)">
          <SectionLabel x={panelX} y={68}>
            ISSUE A PASS
          </SectionLabel>
          {/* One tinted panel holds the role picker and the fine print. */}
          <rect x={panelX} y={76} width={panelW} height={198} rx={10} className="fill-slate-50" />
          <rect
            x={panelX + 8}
            y={84}
            width={panelW - 16}
            height={146}
            rx={9}
            className="fill-brand-50 stroke-brand-500"
            strokeWidth={1.8}
          />
          {/* The picker's header names the chosen role; the chevron points up while it is open. */}
          <rect x={panelX + 18} y={92} width={22} height={22} rx={5} className="fill-brand-700" />
          <Label x={panelX + 50} y={100} size={11} weight={700} tone="strong">
            Editor
          </Label>
          <Label x={panelX + 50} y={112} size={9} tone="muted">
            Draws with you in real time.
          </Label>
          <path
            d={`M${panelX + panelW - 30} ${106} l5 -5 l5 5`}
            className="fill-none stroke-slate-400"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={panelX + 8}
            y1={122}
            x2={panelX + panelW - 8}
            y2={122}
            className="stroke-slate-200"
            strokeWidth={1}
          />
          {roles.map((r, i) => {
            const ry = 127 + i * 33;
            return (
              <g key={r.title}>
                <rect
                  x={panelX + 13}
                  y={ry}
                  width={panelW - 26}
                  height={30}
                  rx={7}
                  className={r.on ? 'fill-white stroke-brand-300' : 'fill-white/70'}
                  strokeWidth={1}
                />
                <rect x={panelX + 19} y={ry + 6} width={18} height={18} rx={4} className={r.tile} />
                <Label x={panelX + 45} y={ry + 12} size={10} weight={700} className={r.text}>
                  {r.title}
                </Label>
                <Label x={panelX + 45} y={ry + 23} size={8.5} tone="muted">
                  {r.blurb}
                </Label>
                {r.on ? (
                  <g>
                    <circle cx={panelX + panelW - 30} cy={ry + 15} r={6} className={r.tile} />
                    <path
                      d={`M${panelX + panelW - 33} ${ry + 15} l2 2 l4 -4`}
                      className="fill-none stroke-white"
                      strokeWidth={1.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                ) : null}
              </g>
            );
          })}
          {/* The fine print: Valid, then Create Pass ending the row. */}
          <Label x={panelX + 10} y={253} size={10} weight={600} tone="body">
            Valid
          </Label>
          <LifetimeControl x={panelX + 44} y={240} w={214} active={0} />
          <Button x={panelX + 266} y={240} w={86} h={26} label="Create Pass" variant="primary" />
          <SectionLabel x={panelX} y={294}>
            PASSES
          </SectionLabel>
          <ActivePass x={panelX} y={302} w={panelW} role="edit" />
        </g>
      </ShareCard>
    </Scene>
  );
}

/** The Password Protection switch with a password saved: Password Set, Replace and Remove, and
 *  the Password tag it puts on every pass. */
export function SharePasswordSwitch() {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={234} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={218}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <SectionLabel x={x + 16} y={26}>
        PASSES
      </SectionLabel>
      <ActivePass x={x + 16} y={36} w={w - 32} role="view" password />
      <g transform="translate(0 28)">
        <line x1={x} y1={108} x2={x + w} y2={108} className="stroke-slate-200" strokeWidth={1.5} />
        {/* The settings-style switch row. */}
        <Label x={x + 16} y={126} size={12} weight={600} tone="strong">
          Password Protection
        </Label>
        <Label x={x + 16} y={143} size={10} tone="muted">
          Everyone opening a pass must enter it first, embeds included.
        </Label>
        <rect x={x + w - 54} y={117} width={36} height={20} rx={10} className="fill-brand-500" />
        <circle cx={x + w - 28} cy={127} r={7.5} className="fill-white help-art-as-drawn" />
        {/* The detail row, hung off a guide rule. */}
        <line
          x1={x + 20}
          y1={158}
          x2={x + 20}
          y2={186}
          className="stroke-slate-200"
          strokeWidth={2}
        />
        <Lock x={x + 32} y={166} />
        <Label x={x + 47} y={173} size={11} weight={600} tone="strong">
          Password Set
        </Label>
        <Button x={x + w - 156} y={161} w={66} h={24} label="Replace" />
        <Button x={x + w - 84} y={161} w={66} h={24} label="Remove" />
      </g>
    </Scene>
  );
}

/** What a visitor on a protected share link sees: the full-screen password card. */
export function SharePasswordGate() {
  return (
    <Scene w={420} h={226} bg="plain">
      <rect
        x={70}
        y={10}
        width={280}
        height={206}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <circle cx={210} cy={42} r={18} className="fill-brand-100" />
      <Lock x={203} y={33} className="stroke-brand-600" />
      <Label x={210} y={78} anchor="middle" size={13} weight={700} tone="strong">
        This canvas is password-protected
      </Label>
      <Label x={210} y={98} anchor="middle" size={10} tone="body">
        Enter the password Aria set to open this canvas.
      </Label>
      <rect
        x={94}
        y={114}
        width={232}
        height={30}
        rx={7}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={106} y={130} size={12} tone="strong">
        ••••••••
      </Label>
      <Label x={210} y={158} anchor="middle" size={10} weight={500} className="fill-rose-500">
        That password didn&apos;t match. Try again.
      </Label>
      <Button x={94} y={174} w={232} h={30} label="Open canvas" variant="primary" />
    </Scene>
  );
}

/** Choosing a lifetime, the countdown chip on an expiring pass, and an expired pass with Extend. */
export function ShareLifetimes() {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={292} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={276}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <rect x={x + 16} y={20} width={w - 32} height={36} rx={9} className="fill-slate-50" />
      <Label x={x + 26} y={39} size={10} weight={600} tone="body">
        Valid
      </Label>
      <LifetimeControl x={x + 60} y={25} w={210} active={1} role="view" />
      {/* Create Pass takes the chosen role's colour: violet for a Viewer pass. */}
      <rect
        x={x + 278}
        y={25}
        width={82}
        height={26}
        rx={7}
        className="fill-violet-600 dark:fill-violet-500"
      />
      <Label x={x + 319} y={39} anchor="middle" size={11} weight={600} tone="onAccent">
        Create Pass
      </Label>
      <SectionLabel x={x + 16} y={74}>
        PASSES
      </SectionLabel>
      <ActivePass x={x + 16} y={84} w={w - 32} role="view" left="6d left" />
      <SectionLabel x={x + 16} y={188}>
        EXPIRED
      </SectionLabel>
      <Pass x={x + 16} y={196} w={w - 32} h={78} role="edit" expired>
        {/* The stamp sits beside the struck-through link, then Extend and the bin. */}
        <g transform={`translate(${x + 28} 222) rotate(-3)`}>
          <rect
            width={58}
            height={18}
            rx={3}
            className="fill-none stroke-rose-400"
            strokeWidth={1.8}
          />
          <Label x={29} y={10} anchor="middle" size={10} weight={700} className="fill-rose-500">
            EXPIRED
          </Label>
        </g>
        <LinkField x={x + 92} y={220} w={0} struck />
        <Button x={x + 28} y={246} w={92} h={22} label="Extend 1 week" />
        <Bin x={x + w - 38} y={251} />
      </Pass>
    </Scene>
  );
}

/** The Opens dropdown in the composer's fine print, open on the document's tabs. */
export function ShareOpensRow() {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={196} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={180}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <SectionLabel x={x + 16} y={26}>
        ISSUE A PASS
      </SectionLabel>
      <rect x={x + 16} y={36} width={w - 32} height={70} rx={9} className="fill-slate-50" />
      <Label x={x + 26} y={55} size={10} weight={600} tone="body">
        Opens
      </Label>
      <rect
        x={x + 66}
        y={42}
        width={294}
        height={26}
        rx={7}
        className="fill-white stroke-brand-400"
        strokeWidth={1.5}
      />
      <Label x={x + 76} y={56} size={11} weight={500} tone="strong">
        Roadmap
      </Label>
      <path
        d={`M${x + 344} ${53} l4 4 l4 -4`}
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.5}
      />
      <Label x={x + 26} y={89} size={10} weight={600} tone="body">
        Valid
      </Label>
      <LifetimeControl x={x + 66} y={76} w={204} active={0} />
      <Button x={x + 278} y={76} w={82} h={26} label="Create Pass" variant="primary" />
      {/* The open dropdown, over the row below. */}
      <rect
        x={x + 66}
        y={72}
        width={206}
        height={92}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {['All tabs', 'Roadmap', 'Pricing', 'Risks'].map((t, i) => (
        <g key={t}>
          {i === 1 ? (
            <rect
              x={x + 70}
              y={76 + i * 21}
              width={198}
              height={21}
              rx={5}
              className="fill-brand-50"
            />
          ) : null}
          <Label
            x={x + 80}
            y={87 + i * 21}
            size={11}
            weight={i === 1 ? 600 : 400}
            tone={i === 1 ? 'accent' : 'body'}
          >
            {t}
          </Label>
        </g>
      ))}
    </Scene>
  );
}

/** A pass's Embed or Live image menu, open: the copy formats it offers (and, for the live image
 *  on a multi-tab document, the Tab picker). */
function ShareCopyMenu({ variant }: { variant: 'embed' | 'image' }) {
  const x = 14;
  const w = 392;
  const image = variant === 'image';
  const items = image
    ? ['Copy image URL', 'Copy Markdown', 'Copy HTML']
    : ['Copy embed URL', 'Copy iframe'];
  const m = passMenus(x + 16, w - 32);
  // The menu opens under its button, right edges aligned, so it stays inside the dialog.
  const menuX = image
    ? m.image + menuButtonWidth('Live image') - 188
    : m.embed + menuButtonWidth('Embed') - 188;
  const menuY = 110;
  const headerH = image ? 32 : 0;
  const menuH = headerH + items.length * 24 + 8;
  return (
    <Scene w={420} h={image ? 232 : 192} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={image ? 216 : 176}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <ActivePass x={x + 16} y={20} w={w - 32} role="view" open={variant} />
      <rect
        x={menuX}
        y={menuY}
        width={188}
        height={menuH}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {image ? (
        <g>
          <Label x={menuX + 12} y={menuY + 17} size={10} weight={600} tone="muted">
            Tab
          </Label>
          <rect
            x={menuX + 36}
            y={menuY + 6}
            width={140}
            height={22}
            rx={6}
            className="fill-white stroke-slate-200"
            strokeWidth={1.2}
          />
          <Label x={menuX + 44} y={menuY + 18} size={10} tone="strong">
            Overview
          </Label>
          <line
            x1={menuX}
            y1={menuY + headerH}
            x2={menuX + 188}
            y2={menuY + headerH}
            className="stroke-slate-200"
            strokeWidth={1.2}
          />
        </g>
      ) : null}
      {items.map((it, i) => (
        <g key={it}>
          <rect
            x={menuX + 14}
            y={menuY + headerH + 10 + i * 24}
            width={10}
            height={8}
            rx={1.5}
            fill="none"
            className="stroke-slate-400"
            strokeWidth={1.2}
          />
          <Label x={menuX + 32} y={menuY + headerH + 15 + i * 24} size={11} tone="body">
            {it}
          </Label>
        </g>
      ))}
    </Scene>
  );
}

export function ShareEmbedMenu() {
  return <ShareCopyMenu variant="embed" />;
}

export function ShareLiveImageMenu() {
  return <ShareCopyMenu variant="image" />;
}

/** The Share dialog's Community tab with a listed post: View Post, Edit Listing and
 *  Remove From Community. */
export function CommunityShareSection() {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={170} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={154}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {/* The dialog's two tabs, Community chosen. */}
      <Label x={x + 20} y={28} size={11} weight={500} tone="muted">
        Passes
      </Label>
      <Label x={x + 76} y={28} size={11} weight={700} tone="accent">
        Community
      </Label>
      <line x1={x + 72} y1={37} x2={x + 140} y2={37} className="stroke-brand-500" strokeWidth={2} />
      <line
        x1={x + 1}
        y1={38}
        x2={x + w - 1}
        y2={38}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <rect
        x={x + 16}
        y={44}
        width={w - 32}
        height={106}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 30} y={64} size={12} weight={600} tone="strong">
        Checkout flow, end to end
      </Label>
      <Label x={x + 30} y={84} size={10} tone="muted">
        Flows &amp; Processes · ♥ 12 · Copied 3 times
      </Label>
      <Button x={x + 30} y={108} w={78} h={26} label="View Post" />
      <Button x={x + 116} y={108} w={88} h={26} label="Edit Listing" />
      <Button x={x + 212} y={108} w={150} h={26} label="Remove From Community" />
    </Scene>
  );
}

/** The Community search box: the query as words, the clear cross after them, and My Shares,
 *  Category, Tags (a chosen tag counted) and the sort inside its right edge. */
export function CommunitySearchBox() {
  const chip = (cx: number, label: string, on = false, badge = 0) => (
    <g>
      <rect
        x={cx}
        y={34}
        width={label.length * 5.4 + 12 + (badge ? 13 : 0)}
        height={24}
        rx={7}
        className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-200'}
        strokeWidth={1.2}
      />
      <Label x={cx + 6} y={47} size={9.5} weight={600} tone={on ? 'accent' : 'body'}>
        {label}
      </Label>
      {badge ? (
        <g>
          <circle cx={cx + label.length * 5.4 + 15} cy={46} r={5.5} className="fill-brand-500" />
          <Label
            x={cx + label.length * 5.4 + 15}
            y={47}
            anchor="middle"
            size={8}
            weight={700}
            tone="onAccent"
          >
            {badge}
          </Label>
        </g>
      ) : null}
    </g>
  );
  return (
    <Scene w={420} h={176} bg="plain">
      <rect
        x={10}
        y={26}
        width={400}
        height={40}
        rx={12}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <circle cx={28} cy={45} r={5} className="fill-none stroke-slate-400" strokeWidth={1.5} />
      <path d="M32 49 l4 4" className="stroke-slate-400" strokeWidth={1.5} />
      <Label x={44} y={47} size={11} tone="strong">
        #aws sort:loved
      </Label>
      {/* The clear cross sits just after the text. */}
      <path
        d="M140 42 l6 6 M146 42 l-6 6"
        className="stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {chip(156, 'My Shares')}
      {chip(222, 'Category')}
      {chip(282, 'Tags', true, 1)}
      {chip(333, 'Most Loved', true)}
      {/* A few result cards. */}
      {[10, 144, 278].map((cx, i) => (
        <g key={cx}>
          <rect
            x={cx}
            y={82}
            width={132}
            height={84}
            rx={10}
            className="fill-white stroke-slate-200"
            strokeWidth={1.5}
          />
          <rect x={cx + 8} y={90} width={116} height={40} rx={6} className="fill-slate-50" />
          <Shape x={cx + 20} y={98} w={36} h={24} accent={i === 0} />
          <Shape x={cx + 76} y={98} w={36} h={24} kind="circle" />
          <TextBar x={cx + 10} y={140} w={84} tone="muted" />
          <Label x={cx + 10} y={156} size={10} tone="muted">
            {['♥ 48', '♥ 31', '♥ 17'][i]}
          </Label>
          <Label x={cx + 122} y={156} anchor="end" size={10} tone="muted">
            {['Copied 9', 'Copied 4', 'Copied 2'][i]}
          </Label>
        </g>
      ))}
    </Scene>
  );
}
