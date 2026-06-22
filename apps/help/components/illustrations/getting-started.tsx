// Getting-started-category illustrations (spec/55): beginner walkthroughs for
// the new-diagram welcome flow, the shape palette, quick-connecting arrows,
// guest vs account, and the essential keyboard shortcuts. Composed only from
// the shared primitives so the house style holds.

import { Scene, Shape, Arrow, Panel, Dialog, Tabs, Tile, Label, Avatar } from './primitives';

/** The new-diagram welcome flow: a Blank card and a couple of template cards,
 *  the entry point to every diagram. */
export function NewDiagramWelcome() {
  return (
    <Scene w={420} h={236} bg="plain">
      <Dialog
        x={48}
        y={18}
        w={324}
        h={200}
        title="New diagram"
        sceneW={420}
        sceneH={236}
        scrim={false}
      >
        {/* Top-right chrome: a help icon button to the left of the close X. */}
        <g className="stroke-slate-400" strokeWidth={1.6} fill="none" strokeLinecap="round">
          <circle cx={338} cy={38} r={7} />
          <path d="M335.6 35.8 a2.4 2.4 0 1 1 2.9 2.4 v1.2" />
          <path d="M357 35 l7 7 M364 35 l-7 7" />
        </g>
        <circle cx={338} cy={41.6} r={0.7} className="fill-slate-400" />
        {/* Three cards centred in the dialog with even 12u margins and gaps. */}
        {/* Blank card, selected */}
        <rect
          x={60}
          y={72}
          width={92}
          height={116}
          rx={9}
          className="fill-white stroke-brand-500"
          strokeWidth={2.5}
        />
        <path
          d="M90 122 h32 M106 106 v32"
          className="stroke-brand-400"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Label x={106} y={174} anchor="middle" size={11} weight={700} tone="strong">
          Blank
        </Label>
        {/* Template card A */}
        <rect
          x={164}
          y={72}
          width={92}
          height={116}
          rx={9}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <rect x={178} y={92} width={26} height={18} rx={3} className="fill-brand-200" />
        <rect x={216} y={92} width={26} height={18} rx={3} className="fill-brand-400" />
        <line x1={204} y1={101} x2={216} y2={101} className="stroke-slate-300" strokeWidth={2} />
        <rect x={190} y={124} width={40} height={16} rx={3} className="fill-brand-300" />
        <Label x={210} y={174} anchor="middle" size={11} weight={600} tone="body">
          Flowchart
        </Label>
        {/* Template card B */}
        <rect
          x={268}
          y={72}
          width={92}
          height={116}
          rx={9}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <circle cx={314} cy={104} r={11} className="fill-emerald-200" />
        <rect x={284} y={124} width={26} height={16} rx={3} className="fill-violet-300" />
        <rect x={318} y={124} width={26} height={16} rx={3} className="fill-amber-300" />
        <Label x={314} y={174} anchor="middle" size={11} weight={600} tone="body">
          Mind map
        </Label>
      </Dialog>
    </Scene>
  );
}

/** The Palette panel with its category tabs and a grid of shape tiles, the
 *  surface every element comes from. */
export function ShapePalette() {
  return (
    <Scene w={420} h={200}>
      <Panel x={96} y={20} w={228} h={160} title="PALETTE">
        <Tabs
          x={110}
          y={54}
          items={['Shapes', 'Tools', 'Devices', 'Icons']}
          active={0}
          tabW={50}
          h={22}
        />
        {/* Shape tiles, two rows */}
        <Tile x={114} y={92} active>
          <rect
            x={-7}
            y={-7}
            width={14}
            height={14}
            rx={2}
            className="stroke-white"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={154} y={92}>
          <circle r={7} className="stroke-brand-500" strokeWidth={2} fill="none" />
        </Tile>
        <Tile x={194} y={92}>
          <path
            d="M0 -8 L8 0 L0 8 L-8 0 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={234} y={92}>
          <path
            d="M-8 -4 a8 4 0 0 1 16 0 v8 a8 4 0 0 1 -16 0 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={274} y={92}>
          <path
            d="M-5 -7 h10 l4 7 l-4 7 h-10 l-4 -7 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={114} y={132}>
          <rect
            x={-8}
            y={-6}
            width={16}
            height={12}
            rx={6}
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={154} y={132}>
          <path
            d="M-8 -6 h16 v12 h-16 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={194} y={132}>
          <path
            d="M-7 -7 h14 l-3 14 h-8 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={234} y={132}>
          <path
            d="M-6 -8 l4 0 l6 8 l-6 8 l-4 0 l6 -8 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={274} y={132}>
          <path d="M0 -8 L8 8 H-8 Z" className="stroke-brand-500" strokeWidth={2} fill="none" />
        </Tile>
      </Panel>
    </Scene>
  );
}

/** Quick-connect: hovering a shape surfaces + handles, and dragging from one
 *  pins an arrow to a second shape. */
export function QuickConnect() {
  return (
    <Scene w={420} h={220}>
      <Shape x={48} y={84} w={104} h={56} kind="rect" label="Order" />
      {/* + quick-connect affordances around the hovered shape */}
      {(
        [
          [100, 74],
          [100, 150],
          [38, 112],
          [162, 112],
        ] as [number, number][]
      ).map(([cx, cy], i) => (
        <g key={i}>
          <circle
            cx={cx}
            cy={cy}
            r={9}
            className={i === 3 ? 'fill-brand-500' : 'fill-white stroke-brand-400'}
            strokeWidth={1.5}
          />
          <path
            d={`M${cx - 4} ${cy} h8 M${cx} ${cy - 4} v8`}
            className={i === 3 ? 'stroke-white' : 'stroke-brand-500'}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      ))}
      {/* Drag from the right + to the second shape */}
      <Arrow from={[171, 112]} to={[264, 138]} kind="curved" tone="accent" />
      <Shape x={272} y={112} w={104} h={52} kind="rect" accent label="Pay" />
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
      <Label x={110} y={56} anchor="middle" size={8} weight={600} tone="muted">
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
      <Label x={110} y={196} anchor="middle" size={8} tone="muted">
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
      <Label x={310} y={56} anchor="middle" size={8} weight={600} tone="muted">
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
