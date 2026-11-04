// Getting-started-category illustrations (docs/specs/018-help/help-app.md): beginner walkthroughs for
// quick-connecting arrows,
// guest vs account, and the essential keyboard shortcuts. Composed only from
// the shared primitives so the house style holds.

import { lucideCloud } from '@liveworkspace/icons/lucide';
import { Prims } from '@livehuddle/ui';
import {
  Scene,
  Shape,
  Arrow,
  Label,
  Avatar,
  Button,
} from '@liveworkspace/help-site/art/primitives';
import { Switch } from '@liveworkspace/help-site/art/illustrations/settings-dialog';

/** Quick-connect: a selected shape shows + buttons on its sides; clicking one opens a card of
 *  icon buttons (Duplicate, Arrow, Pencil, Text), and dragging Arrow onto a second shape pins
 *  an arrow to both. */
export function QuickConnect() {
  const plus: [number, number][] = [
    [90, 54],
    [90, 150],
    [26, 102],
  ];
  return (
    <Scene w={420} h={210}>
      <Shape x={38} y={74} w={104} h={56} kind="rect" label="Order" />
      <rect
        x={34}
        y={70}
        width={112}
        height={64}
        rx={6}
        className="stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        fill="none"
      />
      {plus.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={8} className="fill-white stroke-brand-400" strokeWidth={1.5} />
          <path
            d={`M${cx - 4} ${cy} h8 M${cx} ${cy - 4} v8`}
            className="stroke-brand-500"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      ))}
      {/* The clicked + on the right opens one card of icon buttons beside it (QuickConnectRing):
          Duplicate, Arrow, Pencil and Text, their names in hover cards. */}
      <circle cx={158} cy={102} r={8} className="fill-brand-500" />
      <path
        d="M154 102 h8 M158 98 v8"
        className="stroke-white help-art-as-drawn"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <rect
        x={172}
        y={50}
        width={32}
        height={106}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          x1={176}
          y1={76 + i * 26}
          x2={200}
          y2={76 + i * 26}
          className="stroke-slate-100"
          strokeWidth={1}
        />
      ))}
      {/* Duplicate */}
      <g className="fill-none stroke-slate-500" strokeWidth={1.4}>
        <rect x={181} y={57} width={10} height={10} rx={2} />
        <path d="M185 57 v-2 a2 2 0 0 1 2 -2 h6 a2 2 0 0 1 2 2 v6 a2 2 0 0 1 -2 2 h-2" />
      </g>
      {/* Arrow, the one being dragged */}
      <rect x={176} y={80} width={24} height={22} rx={5} className="fill-brand-500" />
      <path
        d="M182 91 h11 M189 87 l4 4 l-4 4"
        className="fill-none stroke-white help-art-as-drawn"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pencil */}
      <path
        d="M182 124 l9 -9 l3 3 l-9 9 h-3 Z"
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Text */}
      <path
        d="M182 137 h12 M188 137 v11"
        className="fill-none stroke-slate-500"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* Drag the Arrow option onto the second shape. */}
      <Arrow from={[204, 91]} to={[294, 118]} kind="curved" tone="accent" />
      <Shape x={296} y={100} w={96} h={52} kind="rect" accent label="Pay" />
    </Scene>
  );
}

/** Side-by-side comparison: a guest tied to one browser versus an account that
 *  syncs the same library across devices. */
export function GuestVsAccount() {
  return (
    <Scene w={420} h={240} bg="plain">
      {/* Guest side */}
      <rect
        x={20}
        y={20}
        width={180}
        height={200}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={110} y={40} anchor="middle" size={12} weight={700} tone="strong">
        Guest
      </Label>
      <Label x={110} y={56} anchor="middle" size={10} weight={600} tone="muted">
        SAVED IN THIS BROWSER
      </Label>
      {/* Single browser window */}
      <rect
        x={56}
        y={78}
        width={108}
        height={92}
        rx={9}
        className="fill-white stroke-slate-300"
        strokeWidth={2}
      />
      <rect x={56} y={78} width={108} height={18} rx={9} className="fill-slate-100" />
      <circle cx={68} cy={87} r={2.5} className="fill-slate-300" />
      <circle cx={77} cy={87} r={2.5} className="fill-slate-300" />
      <Shape x={70} y={108} w={36} h={22} kind="rect" />
      <Shape x={120} y={132} w={34} h={20} kind="circle" accent />
      <Arrow from={[106, 119]} to={[120, 142]} tone="muted" head={false} width={2} />
      <Label x={110} y={196} anchor="middle" size={10} tone="muted">
        Per-browser id
      </Label>

      {/* Account side */}
      <rect
        x={220}
        y={20}
        width={180}
        height={200}
        rx={12}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={310} y={40} anchor="middle" size={12} weight={700} tone="accent">
        Account
      </Label>
      <Label x={310} y={56} anchor="middle" size={10} weight={600} tone="muted">
        SYNCED ACROSS DEVICES
      </Label>
      {/* Cloud syncing two devices */}
      <path
        d="M286 86 a13 13 0 0 1 25 -4 a11 11 0 0 1 9 19 h-30 a11 11 0 0 1 -4 -15 Z"
        className="fill-brand-100 stroke-brand-400"
        strokeWidth={2}
      />
      {/* Laptop device */}
      <rect
        x={236}
        y={132}
        width={64}
        height={40}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={2}
      />
      <rect x={230} y={172} width={76} height={6} rx={3} className="fill-slate-200" />
      <Shape x={246} y={142} w={20} h={13} kind="rect" />
      <Shape x={272} y={142} w={20} h={13} kind="rect" accent />
      {/* Phone device */}
      <rect
        x={328}
        y={130}
        width={32}
        height={48}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={2}
      />
      <Shape x={334} y={140} w={20} h={12} kind="rect" />
      <Shape x={334} y={158} w={20} h={12} kind="rect" accent />
      {/* sync links from cloud to devices */}
      <Arrow from={[296, 104]} to={[270, 130]} tone="accent" head={false} width={2} dashed />
      <Arrow from={[316, 104]} to={[344, 126]} tone="accent" head={false} width={2} dashed />
      <Avatar cx={310} cy={200} r={11} initial="A" colour="brand" />
    </Scene>
  );
}

/** A single rendered key cap. */
function KeyCap({ x, y, label, w = 40 }: { x: number; y: number; label: string; w?: number }) {
  const h = 40;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-white stroke-slate-300"
        strokeWidth={2}
      />
      <rect x={x + 3} y={y + h - 8} width={w - 6} height={5} rx={2} className="fill-slate-200" />
      <Label
        x={x + w / 2}
        y={y + h / 2 - 1}
        anchor="middle"
        size={label.length > 2 ? 10 : 14}
        weight={700}
        tone="strong"
      >
        {label}
      </Label>
    </g>
  );
}

/** The essential single-key shortcuts as a row of labelled key caps. */
export function KeyboardEssentials() {
  const keys: { label: string; caption: string }[] = [
    { label: 'V', caption: 'Select' },
    { label: 'H', caption: 'Hand' },
    { label: 'K', caption: 'Laser' },
    { label: 'E', caption: 'Eraser' },
    { label: 'Z', caption: 'Zen' },
  ];
  return (
    <Scene w={420} h={150} bg="plain">
      {keys.map((k, i) => {
        const kx = 36 + i * 74;
        return (
          <g key={k.label}>
            <KeyCap x={kx} y={40} label={k.label} />
            <Label x={kx + 20} y={98} anchor="middle" size={10} weight={600} tone="body">
              {k.caption}
            </Label>
          </g>
        );
      })}
      {/* Space bar for panning */}
      <rect
        x={70}
        y={114}
        width={210}
        height={20}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={2}
      />
      <Label x={175} y={125} anchor="middle" size={10} weight={700} tone="muted">
        Space, hold and drag to pan
      </Label>
    </Scene>
  );
}

// The chips under "Templates on its start": the first three Virtual Spaces (NewSpaceSummary.tsx START_TEMPLATE_TITLES).
const START_CHIPS = ['Virtual Office', 'Coworking Space', 'Team Pod'];

/** The New Space wizard at /new, as a signed-in person sees it (apps/editor/components/palette/NewDocumentWizard.tsx
 *  and NewSpaceSummary.tsx): the heading and its line, the Blank Space that Create makes with the templates waiting
 *  on its start, the Sync Space to Server switch, and Open Existing Space, Skip and Create. */
export function NewSpaceWizard() {
  const x = 30;
  const w = 360;
  const inX = x + 18;
  const inW = w - 36;
  const chipWidths = START_CHIPS.map((t) => Math.round(t.length * 4.9 + 16));
  const chipLefts = chipWidths.map(
    (_, i) => inX + 12 + chipWidths.slice(0, i).reduce((a, b) => a + b + 5, 0),
  );
  return (
    <Scene w={420} h={306}>
      <rect x={0} y={0} width={420} height={306} className="fill-slate-900/10" />
      <rect
        x={x}
        y={10}
        width={w}
        height={286}
        rx={14}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Header: the title and its line, then Help and Close. */}
      <Label x={inX} y={34} size={15} weight={700} tone="strong">
        New Space
      </Label>
      <Label x={inX} y={53} size={10} tone="muted">
        A place for your team to meet, plan and run sessions.
      </Label>
      <Label x={x + w - 44} y={33} anchor="middle" size={12} weight={700} tone="muted">
        ?
      </Label>
      <Label x={x + w - 20} y={33} anchor="middle" size={14} tone="muted">
        ×
      </Label>
      <line x1={x} y1={68} x2={x + w} y2={68} className="stroke-slate-100" strokeWidth={1.2} />
      {/* What Create makes. */}
      <rect
        x={inX}
        y={82}
        width={inW}
        height={118}
        rx={12}
        className="fill-brand-50 stroke-slate-200"
        strokeWidth={1}
      />
      <rect x={inX + 12} y={94} width={30} height={30} rx={8} className="fill-brand-700" />
      <g
        transform={`translate(${inX + 18} ${100}) scale(0.75)`}
        className="stroke-white help-art-as-drawn"
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3.5H21" />
        <rect x="4.5" y="3.5" width="15" height="12" rx="1" />
        <path d="M8 8H16M8 11.5H13" />
        <path d="M12 15.5V21M8 15.5L5.5 21M16 15.5L18.5 21" />
      </g>
      <Label x={inX + 54} y={101} size={12} weight={700} tone="strong">
        Blank Space
      </Label>
      <Label x={inX + 54} y={117} size={9.5} tone="body">
        Opens on its start, with templates and the
      </Label>
      <Label x={inX + 54} y={129} size={9.5} tone="body">
        session tools ready.
      </Label>
      <line
        x1={inX + 12}
        y1={142}
        x2={inX + inW - 12}
        y2={142}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={inX + 12} y={154} size={8.5} weight={600} tone="muted">
        TEMPLATES ON ITS START
      </Label>
      {START_CHIPS.map((t, i) => {
        const cw = chipWidths[i] ?? 0;
        const cx = chipLefts[i] ?? 0;
        return (
          <g key={t}>
            <rect
              x={cx}
              y={162}
              width={cw}
              height={18}
              rx={9}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <Label x={cx + cw / 2} y={171.5} anchor="middle" size={9} tone="body">
              {t}
            </Label>
          </g>
        );
      })}
      <Label x={inX + 14} y={190} size={9} tone="muted">
        and sessions to run
      </Label>
      {/* Where it will be saved: the Sync Space to Server switch, on for a signed-in person. */}
      <rect x={inX} y={210} width={26} height={26} rx={7} className="fill-brand-50" />
      <g
        transform={`translate(${inX + 6} ${216}) scale(${14 / 24})`}
        className="stroke-brand-600"
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Prims prims={lucideCloud} />
      </g>
      <Label x={inX + 36} y={217} size={11} weight={600} tone="strong">
        Sync Space to Server
      </Label>
      <Label x={inX + 36} y={231} size={9.5} tone="muted">
        Saved to your account, on every device.
      </Label>
      <Switch x={inX + inW - 30} y={215} on />
      {/* Footer. */}
      <line x1={x} y1={250} x2={x + w} y2={250} className="stroke-slate-100" strokeWidth={1.2} />
      <Label x={inX} y={273} size={10} weight={500} tone="muted">
        Open Existing Space
      </Label>
      <Button x={x + w - 128} y={261} w={44} h={24} label="Skip" />
      <Button x={x + w - 78} y={261} w={60} h={24} label="Create" variant="primary" />
    </Scene>
  );
}
