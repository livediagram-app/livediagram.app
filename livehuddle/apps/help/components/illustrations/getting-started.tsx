// Getting-started-category illustrations (docs/specs/018-help/help-app.md): beginner walkthroughs for
// guest vs account, and the essential keyboard shortcuts. Composed only from
// the shared primitives so the house style holds.

import { lucideCloud } from '@liveworkspace/icons/lucide';
import { Prims } from '@livehuddle/ui';
import { Scene, Shape, Arrow, Label, Avatar } from '@liveworkspace/help-site/art/primitives';
import { Switch } from '@liveworkspace/help-site/art/illustrations/settings-dialog';

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
    { label: 'E', caption: 'Edit' },
    { label: 'W', caption: 'Walk' },
    { label: 'N', caption: 'Sticky note' },
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

// Start a Space's rail (apps/editor/components/start/start-template-items.ts): Recommended first and open, then the
// catalogue's categories.
const START_RAIL = ['Recommended', 'Campus', 'Events', 'Office', 'Outdoor', 'Recreation'];
// Recommended's first cards: the blank, then the Popular picks.
const START_CARDS = ['Blank Space', 'Virtual Office', 'Team Pod', 'Coworking Space'];

/** Start a Space over a new Space's empty board (apps/editor/components/start/StartFromTemplates.tsx): the title, the
 *  search, the rail open on Recommended, its first template cards, and the Sync Space to Server switch in the footer. */
export function StartASpace() {
  const x = 20;
  const w = 380;
  const inX = x + 16;
  const railW = 96;
  const gridX = inX + railW + 12;
  const cardW = 108;
  const cardH = 74;
  return (
    <Scene w={420} h={300}>
      <rect x={0} y={0} width={420} height={300} className="fill-slate-900/10" />
      <rect
        x={x}
        y={10}
        width={w}
        height={280}
        rx={14}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Header: the title and its line, then Help and Close. */}
      <Label x={inX} y={34} size={15} weight={700} tone="strong">
        Start a Space
      </Label>
      <Label x={inX} y={52} size={9.5} tone="muted">
        Walk into an office, a hall, a bar or a garden.
      </Label>
      <Label x={x + w - 44} y={33} anchor="middle" size={12} weight={700} tone="muted">
        ?
      </Label>
      <Label x={x + w - 20} y={33} anchor="middle" size={14} tone="muted">
        ×
      </Label>
      {/* The search. */}
      <rect
        x={inX}
        y={62}
        width={w - 32}
        height={22}
        rx={11}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={inX + 12} y={76.5} size={9.5} tone="muted">
        Find a template
      </Label>
      {/* The rail, open on Recommended. */}
      {START_RAIL.map((name, i) => (
        <g key={name}>
          {i === 0 && (
            <rect x={inX} y={94} width={railW} height={22} rx={7} className="fill-brand-50" />
          )}
          <Label
            x={inX + 10}
            y={108.5 + i * 26}
            size={10}
            weight={i === 0 ? 700 : 500}
            tone={i === 0 ? 'strong' : 'body'}
          >
            {name}
          </Label>
        </g>
      ))}
      {/* Recommended's first cards: a preview over the name. */}
      {START_CARDS.map((name, i) => {
        const cx = gridX + (i % 2) * (cardW + 10);
        const cy = 94 + Math.floor(i / 2) * (cardH + 10);
        return (
          <g key={name}>
            <rect
              x={cx}
              y={cy}
              width={cardW}
              height={cardH}
              rx={9}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <rect
              x={cx + 6}
              y={cy + 6}
              width={cardW - 12}
              height={cardH - 30}
              rx={6}
              className={i === 0 ? 'fill-slate-50' : 'fill-brand-50'}
            />
            {i > 0 && (
              <>
                <rect
                  x={cx + 14}
                  y={cy + 14}
                  width={34}
                  height={20}
                  rx={3}
                  className="fill-brand-200"
                />
                <rect
                  x={cx + 56}
                  y={cy + 14}
                  width={38}
                  height={28}
                  rx={3}
                  className="fill-brand-100"
                />
              </>
            )}
            <Label x={cx + 8} y={cy + cardH - 10} size={9.5} weight={600} tone="strong">
              {name}
            </Label>
          </g>
        );
      })}
      {/* Footer: where the new Space is saved, the Sync Space to Server switch. */}
      <line x1={x} y1={258} x2={x + w} y2={258} className="stroke-slate-100" strokeWidth={1.2} />
      <g
        transform={`translate(${inX} ${266}) scale(${14 / 24})`}
        className="stroke-brand-600"
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Prims prims={lucideCloud} />
      </g>
      <Label x={inX + 22} y={277} size={10} weight={600} tone="strong">
        Sync Space to Server
      </Label>
      <Switch x={x + w - 46} y={266} on />
    </Scene>
  );
}
