// Getting-started-category illustrations (docs/specs/018-help/help-app.md): beginner walkthroughs for
// the new-document welcome flow, the shape palette, quick-connecting arrows,
// guest vs account, and the essential keyboard shortcuts. Composed only from
// the shared primitives so the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Dialog, Button, Tile, Label, Avatar } from './primitives';

/** A template card in the New Document wizard: a thumbnail over its title. */
function TemplateCard({
  x,
  y,
  title,
  selected = false,
  children,
}: {
  x: number;
  y: number;
  title: string;
  selected?: boolean;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={98}
        height={84}
        rx={9}
        className={selected ? 'fill-white stroke-brand-500' : 'fill-white stroke-slate-200'}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      <rect x={x + 8} y={y + 8} width={82} height={46} rx={5} className="fill-slate-50" />
      {children}
      <Label
        x={x + 49}
        y={y + 70}
        anchor="middle"
        size={10}
        weight={selected ? 700 : 600}
        tone={selected ? 'strong' : 'body'}
      >
        {title}
      </Label>
    </g>
  );
}

/** The New Document wizard on its first step: the Template / Location rail,
 *  the template search, the Popular shelf led by Blank Diagram, and the
 *  footer's Skip and Next. */
export function NewDocumentWelcome() {
  return (
    <Scene w={420} h={270} bg="plain">
      <Dialog
        x={30}
        y={10}
        w={360}
        h={252}
        title="New Document"
        sceneW={420}
        sceneH={270}
        scrim={false}
      >
        <g className="stroke-slate-400" strokeWidth={1.6} fill="none" strokeLinecap="round">
          <path d="M366 26 l7 7 M373 26 l-7 7" />
        </g>
        {/* Step rail: 1 Template (current), 2 Location. */}
        <rect x={42} y={54} width={78} height={20} rx={10} className="fill-brand-50" />
        <circle cx={53} cy={64} r={8} className="fill-brand-500" />
        <Label x={53} y={65} anchor="middle" size={10} weight={700} tone="onAccent">
          1
        </Label>
        <Label x={66} y={65} size={10} weight={600} tone="strong">
          Template
        </Label>
        <rect x={126} y={62} width={20} height={4} rx={2} className="fill-slate-200" />
        <circle cx={160} cy={64} r={8} className="fill-slate-200" />
        <Label x={160} y={65} anchor="middle" size={10} weight={700} tone="muted">
          2
        </Label>
        <Label x={173} y={65} size={10} weight={600} tone="muted">
          Location
        </Label>
        {/* Search field. */}
        <rect
          x={42}
          y={84}
          width={336}
          height={22}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={54} y={96} size={10} tone="muted">
          Search templates...
        </Label>
        <Label x={42} y={120} size={10} weight={700} tone="strong">
          Popular
        </Label>
        <TemplateCard x={42} y={130} title="Blank Diagram" selected>
          <path
            d="M83 155 h16 M91 147 v16"
            className="stroke-brand-400"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </TemplateCard>
        <TemplateCard x={161} y={130} title="Flowchart">
          <rect x={180} y={146} width={22} height={13} rx={3} className="fill-brand-200" />
          <rect x={220} y={146} width={22} height={13} rx={3} className="fill-brand-400" />
          <line x1={202} y1={152} x2={220} y2={152} className="stroke-slate-300" strokeWidth={2} />
          <rect x={200} y={166} width={22} height={11} rx={3} className="fill-brand-300" />
        </TemplateCard>
        <TemplateCard x={280} y={130} title="Mind map">
          <circle cx={329} cy={158} r={8} className="fill-emerald-400" />
          <rect x={295} y={146} width={18} height={9} rx={3} className="fill-violet-400" />
          <rect x={345} y={162} width={18} height={9} rx={3} className="fill-amber-400" />
        </TemplateCard>
        {/* Footer: Skip creates a Blank Diagram straight away; Next goes to Location. */}
        <line x1={30} y1={224} x2={390} y2={224} className="stroke-slate-200" strokeWidth={1} />
        <Button x={250} y={231} w={56} h={22} label="Skip" />
        <Button x={314} y={231} w={64} h={22} label="Next" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** A dropdown chip in the palette's header band: a label and a caret. */
function DropdownChip({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 9} y={y + 11} size={10} weight={600} tone="strong">
        {label}
      </Label>
      <path
        d={`M${x + w - 14} ${y + 8} l4 4 l4 -4`}
        className="stroke-slate-400"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** The palette strip across the top of the canvas: the selection-mode and category dropdowns,
 *  Popular's twelve tiles, then More (⋯) and Search. */
export function ShapePalette() {
  const stroke = { className: 'stroke-brand-500', strokeWidth: 2, fill: 'none' } as const;
  const glyphs: ReactNode[] = [
    <rect
      key="sq"
      x={-7}
      y={-7}
      width={14}
      height={14}
      rx={2}
      className="stroke-white"
      strokeWidth={2}
      fill="none"
    />,
    <circle key="ci" r={7} {...stroke} />,
    <path key="di" d="M0 -8 L8 0 L0 8 L-8 0 Z" {...stroke} />,
    <path key="tx" d="M-6 -6 h12 M0 -6 v13" {...stroke} strokeLinecap="round" />,
    <path key="ar" d="M-7 5 L6 -6 M1 -6 h5 v5" {...stroke} strokeLinecap="round" />,
    <rect key="fr" x={-8} y={-7} width={16} height={14} rx={2} {...stroke} strokeDasharray="3 2" />,
    <rect key="st" x={-7} y={-7} width={14} height={14} rx={1.5} className="fill-amber-400" />,
    <path key="im" d="M-8 6 L-3 -1 L1 3 L4 0 L8 6 Z" className="fill-brand-300" />,
    <path key="pe" d="M-7 4 q3 -9 7 -2 t7 -4" {...stroke} strokeLinecap="round" />,
    <path key="tb" d="M-8 -6 h16 v12 h-16 Z M-8 0 h16 M-2 -6 v12" {...stroke} strokeWidth={1.5} />,
    <path key="co" d="M-3 -5 L-8 0 L-3 5 M3 -5 L8 0 L3 5" {...stroke} strokeLinecap="round" />,
    <path key="en" d="M-8 -7 h16 v14 h-16 Z M-8 -2 h16" {...stroke} strokeWidth={1.5} />,
  ];
  return (
    <Scene w={600} h={96}>
      <rect
        x={10}
        y={24}
        width={580}
        height={46}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <DropdownChip x={20} y={37} w={70} label="Select" />
      <path d="M98 33v28" className="stroke-slate-200" strokeWidth={1} />
      <DropdownChip x={106} y={37} w={80} label="Popular" />
      <path d="M194 33v28" className="stroke-slate-200" strokeWidth={1} />
      {glyphs.map((g, i) => (
        <Tile key={i} x={202 + i * 28} y={34} active={i === 0}>
          {g}
        </Tile>
      ))}
      <path d="M544 33v28" className="stroke-slate-200" strokeWidth={1} />
      {/* More (⋯), then Search. */}
      <g className="fill-slate-400">
        <circle cx={551} cy={47} r={1.6} />
        <circle cx={556} cy={47} r={1.6} />
        <circle cx={561} cy={47} r={1.6} />
      </g>
      <circle cx={576} cy={46} r={5} className="fill-none stroke-slate-500" strokeWidth={1.6} />
      <path d="M580 50 l4 4" className="stroke-slate-500" strokeWidth={1.6} strokeLinecap="round" />
    </Scene>
  );
}

/** Quick-connect: a selected shape shows + buttons on its sides; clicking one
 *  fans out its options (Duplicate, Arrow, Pencil, Text), and dragging Arrow
 *  onto a second shape pins an arrow to both. */
export function QuickConnect() {
  const plus: [number, number][] = [
    [90, 54],
    [90, 150],
    [26, 102],
  ];
  const options: { label: string; cx: number; cy: number }[] = [
    { label: 'Duplicate', cx: 190, cy: 52 },
    { label: 'Arrow', cx: 204, cy: 86 },
    { label: 'Pencil', cx: 204, cy: 120 },
    { label: 'Text', cx: 190, cy: 154 },
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
      {/* The clicked + on the right, its options fanned in an arc. */}
      <circle cx={158} cy={102} r={8} className="fill-brand-500" />
      <path
        d="M154 102 h8 M158 98 v8"
        className="stroke-white help-art-as-drawn"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {options.map((o) => (
        <g key={o.label}>
          <circle
            cx={o.cx}
            cy={o.cy}
            r={11}
            className={o.label === 'Arrow' ? 'fill-brand-500' : 'fill-white stroke-slate-300'}
            strokeWidth={1.5}
          />
          <Label
            x={o.cx}
            y={o.cy - 17}
            anchor="middle"
            size={10}
            weight={o.label === 'Arrow' ? 700 : 500}
            tone={o.label === 'Arrow' ? 'accent' : 'muted'}
          >
            {o.label}
          </Label>
        </g>
      ))}
      <path
        d="M199 86 h11 M206 82 l4 4 l-4 4"
        className="stroke-white help-art-as-drawn"
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
      {/* Drag the Arrow option onto the second shape. */}
      <Arrow from={[216, 88]} to={[290, 118]} kind="curved" tone="accent" />
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

/** The welcome tour's offer card: a short welcome, then No thanks or Show me around. */
export function WelcomeTourCard() {
  return (
    <Scene w={420} h={170} bg="plain">
      <rect
        x={70}
        y={12}
        width={280}
        height={146}
        rx={14}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={210} y={34} anchor="middle" size={10} weight={700} tone="accent">
        QUICK TOUR
      </Label>
      <Label x={210} y={54} anchor="middle" size={14} weight={700} tone="strong">
        Welcome to livediagram
      </Label>
      <rect x={110} y={68} width={200} height={6} rx={3} className="fill-slate-200" />
      <rect x={130} y={82} width={160} height={6} rx={3} className="fill-slate-200" />
      <Button x={110} y={116} w={92} h={26} label="No thanks" />
      <Button x={210} y={116} w={104} h={26} label="Show me around" variant="primary" />
    </Scene>
  );
}
