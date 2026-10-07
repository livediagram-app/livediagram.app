// Share dialog, share-gate and Community scenes for the Collaboration › Sharing articles
// (docs/specs/018-help/help-app.md). Drawn from the live Share dialog
// (apps/live/components/dialogs/Share*.tsx): every link is a pass with a role-coloured stub, the
// composer's fine print holds Opens / Valid / Create Pass, and the password is one switch beneath the
// passes. Labels are the real UI strings.

import type { ReactNode } from 'react';
import { Button, Label, Scene, Shape, TextBar } from './primitives';

type Role = 'edit' | 'view';

// --- Shared pieces -----------------------------------------------------------

/** The uppercase caption the dialog's bands share ("ISSUE A PASS", "PASSES", "EXPIRED"). */
function SectionLabel({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <Label x={x} y={y} size={10} weight={700} tone="muted">
      {children}
    </Label>
  );
}

/** A pass: role-coloured stub (EDITOR brand, VIEWER violet, greyed when expired) and a body the
 *  caller fills. Mirrors SharePassTicket. */
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
  const stub = 56;
  const stubFill = expired
    ? 'fill-slate-200'
    : role === 'edit'
      ? 'fill-brand-500'
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
        d={`M${x + 10} ${y} H${x + stub} V${y + h} H${x + 10} a10 10 0 0 1 -10 -10 V${y + 10} a10 10 0 0 1 10 -10 Z`}
        className={stubFill}
      />
      <Label
        x={x + stub / 2}
        y={y + h / 2 + 1}
        anchor="middle"
        size={10}
        weight={700}
        tone={expired ? 'muted' : 'onAccent'}
      >
        {role === 'edit' ? 'EDITOR' : 'VIEWER'}
      </Label>
      {children}
    </g>
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
  const w = label.length * 6 + 26;
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
        <circle key={i} cx={x + w - 14 + i * 4} cy={y + 10} r={1.1} className="fill-slate-400" />
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
                  role === 'edit' ? 'fill-brand-500' : 'fill-violet-500 dark:fill-violet-700'
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
        Share this document
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

/** The Share dialog: Issue a pass (role cards, Valid, Create Pass) above the live passes. */
export function SharePassesDialog() {
  const x = 14;
  const w = 392;
  const roleCard = (cx: number, role: Role, title: string, blurb: string, on: boolean) => (
    <g>
      <rect
        x={cx}
        y={78}
        width={174}
        height={40}
        rx={9}
        className={
          on
            ? role === 'edit'
              ? 'fill-brand-50 stroke-brand-500'
              : 'fill-violet-50 stroke-violet-500'
            : 'fill-white stroke-slate-200'
        }
        strokeWidth={1.8}
      />
      {on ? (
        <circle
          cx={cx + 162}
          cy={90}
          r={5}
          className={role === 'edit' ? 'fill-brand-500' : 'fill-violet-500 dark:fill-violet-700'}
        />
      ) : null}
      <Label x={cx + 12} y={91} size={11} weight={700} tone="strong">
        {title}
      </Label>
      <Label x={cx + 12} y={106} size={10} tone="muted">
        {blurb}
      </Label>
    </g>
  );
  return (
    <Scene w={420} h={282} bg="plain">
      <ShareCard x={x} y={8} w={w} h={266} status="Shared: anyone holding the pass can get in.">
        <SectionLabel x={x + 16} y={68}>
          ISSUE A PASS
        </SectionLabel>
        {roleCard(x + 16, 'edit', 'Editor', 'Draws with you in real time.', true)}
        {roleCard(x + 198, 'view', 'Viewer', 'Watches, pans and zooms.', false)}
        {/* The fine print: Valid, then Create Pass ending the row. */}
        <rect x={x + 16} y={126} width={w - 32} height={36} rx={9} className="fill-slate-50" />
        <Label x={x + 26} y={145} size={10} weight={600} tone="body">
          Valid
        </Label>
        <LifetimeControl x={x + 60} y={131} w={210} active={0} />
        <Button x={x + 278} y={131} w={82} h={26} label="Create Pass" variant="primary" />
        <SectionLabel x={x + 16} y={180}>
          PASSES
        </SectionLabel>
        <Pass x={x + 16} y={190} w={w - 32} h={74} role="edit">
          <LinkField x={x + 82} y={198} w={268} />
          <Label x={x + 82} y={232} size={10} weight={700} tone="muted">
            VALID
          </Label>
          <Label x={x + 118} y={232} size={10} weight={600} tone="body">
            Forever
          </Label>
          <MenuButton x={x + 82} y={241} label="Embed" />
          <MenuButton x={x + 150} y={241} label="Live image" />
          <Bin x={x + 336} y={245} />
        </Pass>
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
    <Scene w={420} h={206} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={190}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <SectionLabel x={x + 16} y={26}>
        PASSES
      </SectionLabel>
      <Pass x={x + 16} y={36} w={w - 32} h={58} role="view">
        <LinkField x={x + 82} y={44} w={268} />
        <Label x={x + 82} y={80} size={10} weight={700} tone="muted">
          VALID
        </Label>
        <Label x={x + 118} y={80} size={10} weight={600} tone="body">
          Forever
        </Label>
        <Lock x={x + 172} y={73} className="stroke-emerald-500" />
        <Label x={x + 186} y={80} size={10} weight={600} className="fill-emerald-500">
          Password
        </Label>
      </Pass>
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
        This document is password-protected
      </Label>
      <Label x={210} y={98} anchor="middle" size={10} tone="body">
        Enter the password Aria set to open this document.
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
      <Button x={94} y={174} w={232} h={30} label="Open document" variant="primary" />
    </Scene>
  );
}

/** Choosing a lifetime, the countdown chip on an expiring pass, and an expired pass with Extend. */
export function ShareLifetimes() {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={248} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={232}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <rect x={x + 16} y={20} width={w - 32} height={36} rx={9} className="fill-slate-50" />
      <Label x={x + 26} y={39} size={10} weight={600} tone="body">
        Valid
      </Label>
      <LifetimeControl x={x + 60} y={25} w={210} active={1} role="view" />
      <Button x={x + 278} y={25} w={82} h={26} label="Create Pass" variant="primary" />
      <SectionLabel x={x + 16} y={74}>
        PASSES
      </SectionLabel>
      <Pass x={x + 16} y={84} w={w - 32} h={58} role="view">
        <LinkField x={x + 82} y={92} w={268} />
        <Label x={x + 82} y={128} size={10} weight={700} tone="muted">
          VALID
        </Label>
        <rect
          x={x + 116}
          y={119}
          width={60}
          height={18}
          rx={9}
          className="fill-amber-50 stroke-amber-400"
          strokeWidth={1}
        />
        <Label
          x={x + 146}
          y={129}
          anchor="middle"
          size={10}
          weight={600}
          className="fill-amber-500"
        >
          6d left
        </Label>
      </Pass>
      <SectionLabel x={x + 16} y={160}>
        EXPIRED
      </SectionLabel>
      <Pass x={x + 16} y={170} w={w - 32} h={60} role="edit" expired>
        <g transform={`translate(${x + 82} 176) rotate(-3)`}>
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
        <LinkField x={x + 146} y={174} w={0} struck />
        <Button x={x + 82} y={202} w={92} h={22} label="Extend 1 week" />
        <Bin x={x + 336} y={207} />
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
        x={x + 60}
        y={42}
        width={300}
        height={26}
        rx={7}
        className="fill-white stroke-brand-400"
        strokeWidth={1.5}
      />
      <Label x={x + 70} y={56} size={11} weight={500} tone="strong">
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
      <LifetimeControl x={x + 60} y={76} w={210} active={0} />
      <Button x={x + 278} y={76} w={82} h={26} label="Create Pass" variant="primary" />
      {/* The open dropdown, over the row below. */}
      <rect
        x={x + 60}
        y={72}
        width={180}
        height={92}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {['All tabs', 'Roadmap', 'Pricing', 'Risks'].map((t, i) => (
        <g key={t}>
          {i === 1 ? (
            <rect
              x={x + 64}
              y={76 + i * 21}
              width={172}
              height={21}
              rx={5}
              className="fill-brand-50"
            />
          ) : null}
          <Label
            x={x + 74}
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
  const menuX = image ? x + 150 : x + 82;
  const menuY = 104;
  const headerH = image ? 32 : 0;
  const menuH = headerH + items.length * 24 + 8;
  return (
    <Scene w={420} h={image ? 226 : 186} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={image ? 210 : 170}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Pass x={x + 16} y={20} w={w - 32} h={76} role="view">
        <LinkField x={x + 82} y={28} w={268} />
        <Label x={x + 82} y={62} size={10} weight={700} tone="muted">
          VALID
        </Label>
        <Label x={x + 118} y={62} size={10} weight={600} tone="body">
          Forever
        </Label>
        <MenuButton x={x + 82} y={71} label="Embed" active={!image} />
        <MenuButton x={x + 150} y={71} label="Live image" active={image} />
        <Bin x={x + 336} y={75} />
      </Pass>
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

/** The Share dialog's Community band with a listed post: View Post, Edit Listing and
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
      <circle cx={x + 21} cy={28} r={5} className="fill-none stroke-slate-400" strokeWidth={1.3} />
      <SectionLabel x={x + 32} y={29}>
        COMMUNITY
      </SectionLabel>
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
      <Button x={x + 30} y={108} w={84} h={26} label="View Post" />
      <Button x={x + 122} y={108} w={90} h={26} label="Edit Listing" />
      <rect
        x={x + 220}
        y={108}
        width={142}
        height={26}
        rx={7}
        className="fill-amber-50 stroke-amber-400"
        strokeWidth={1.5}
      />
      <Label x={x + 291} y={122} anchor="middle" size={11} weight={600} className="fill-amber-500">
        Remove From Community
      </Label>
    </Scene>
  );
}

/** The Community search box: the query as words, with My Shares, Category, Tags and the sort
 *  inside its right edge. */
export function CommunitySearchBox() {
  const chip = (cx: number, label: string, on = false) => (
    <g>
      <rect
        x={cx}
        y={34}
        width={label.length * 5.8 + 14}
        height={24}
        rx={7}
        className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-200'}
        strokeWidth={1.2}
      />
      <Label x={cx + 7} y={47} size={10} weight={600} tone={on ? 'accent' : 'body'}>
        {label}
      </Label>
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
      {chip(140, 'My Shares')}
      {chip(210, 'Category')}
      {chip(274, 'Tags')}
      {chip(315, 'Most Loved', true)}
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
        </g>
      ))}
    </Scene>
  );
}
