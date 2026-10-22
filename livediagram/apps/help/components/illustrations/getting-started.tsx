// Getting-started-category illustrations (docs/specs/018-help/help-app.md): beginner walkthroughs for
// the new-document welcome flow, quick-connecting arrows,
// guest vs account, and the essential keyboard shortcuts. Composed only from
// the shared primitives so the house style holds.

import { Scene, Shape, Arrow, Dialog, Button, Label, Avatar } from './primitives';

/** The New Document wizard, its one question: "What are you making today?", the
 *  four mode cards, two by two at one height (Diagram first and chosen),
 *  each with its number key, and the footer's Skip and Create. Choosing a card
 *  creates the document there and then. */
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
        {/* The one question, under the title. */}
        <Label x={42} y={65} size={10.5} tone="muted">
          What are you making today?
        </Label>
        {/* The four mode cards, two by two, every one the same build and height: a plate
            on top, then the name and its number key. Diagram, where most start, leads and is
            chosen; its plate holds a small flow. */}
        {(['Diagram', 'Draw', 'Workshop', 'Plan'] as const).map((mode, i) => {
          const w = 164;
          const x = 42 + (i % 2) * (w + 8);
          const y = i < 2 ? 84 : 152;
          const chosen = i === 0;
          return (
            <g key={mode}>
              <rect
                x={x}
                y={y}
                width={w}
                height={62}
                rx={9}
                className={chosen ? 'fill-white stroke-brand-500' : 'fill-white stroke-slate-200'}
                strokeWidth={chosen ? 2.5 : 1.5}
              />
              <rect
                x={x + 6}
                y={y + 6}
                width={w - 12}
                height={30}
                rx={5}
                className={chosen ? 'fill-brand-50' : 'fill-slate-50'}
              />
              {chosen ? (
                <g>
                  <g className="fill-white stroke-brand-400" strokeWidth={1.5}>
                    <rect x={x + 20} y={y + 14} width={22} height={13} rx={3} />
                    <rect x={x + 64} y={y + 14} width={22} height={13} rx={3} />
                  </g>
                  <path
                    d={`M${x + 42} ${y + 20.5} h18 m-4 -3.5 l4 3.5 l-4 3.5`}
                    className="fill-none stroke-brand-400"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ) : (
                <rect
                  x={x + w / 2 - 13}
                  y={y + 13}
                  width={26}
                  height={16}
                  rx={3}
                  className="fill-brand-100"
                />
              )}
              <Label x={x + 9} y={y + 50} size={10} weight={chosen ? 700 : 600} tone="strong">
                {mode}
              </Label>
              {/* The card's number key, at the row's end. */}
              <rect
                x={x + w - 21}
                y={y + 43}
                width={13}
                height={13}
                rx={2.5}
                className="fill-white stroke-slate-300"
                strokeWidth={1}
              />
              <Label x={x + w - 14.5} y={y + 50} anchor="middle" size={8} weight={500} tone="muted">
                {String(i + 1)}
              </Label>
            </g>
          );
        })}
        {/* Footer: Open Existing Document at the left; Skip creates a Blank Diagram straight
            away; Create makes the chosen mode's document. */}
        <line x1={30} y1={224} x2={390} y2={224} className="stroke-slate-200" strokeWidth={1} />
        <Label x={42} y={243} size={9.5} weight={600} tone="accent">
          Open Existing Document
        </Label>
        <Button x={250} y={231} w={56} h={22} label="Skip" />
        <Button x={314} y={231} w={64} h={22} label="Create" variant="primary" />
      </Dialog>
    </Scene>
  );
}

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

/** The Diagram tour's offer card: a short welcome, then No or Yes. */
export function DiagramTourCard() {
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
        DIAGRAM TOUR
      </Label>
      <Label x={210} y={54} anchor="middle" size={14} weight={700} tone="strong">
        Getting started with Diagrams?
      </Label>
      <rect x={110} y={68} width={200} height={6} rx={3} className="fill-slate-200" />
      <rect x={130} y={82} width={160} height={6} rx={3} className="fill-slate-200" />
      {/* No is a plain text button, beside the primary. */}
      <Label x={156} y={130} anchor="middle" size={11} weight={600} tone="body">
        No
      </Label>
      <Button x={210} y={116} w={104} h={26} label="Yes" variant="primary" />
    </Scene>
  );
}
