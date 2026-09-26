// About-category illustrations (docs/specs/018-help/help-app.md): the conceptual articles, what
// livediagram is, who it serves, why use it, and what open source means.
// Composed only from the shared primitives so the house style holds. Several
// About figures reuse canvas / collaboration scenes (CanvasOverview,
// LiveCursors) rather than redrawing them.

import { Scene, Shape, Arrow, Label, TextBar } from './primitives';

/** A montage of the diagram kinds livediagram covers: a flowchart, a mind map,
 *  and a wireframe, side by side as three mini-canvases. */
export function DiagramTypes() {
  return (
    <Scene w={420} h={210}>
      {/* Flowchart */}
      <Label x={70} y={26} anchor="middle" size={10} weight={700} tone="muted">
        FLOWCHART
      </Label>
      <Shape x={42} y={42} w={56} h={30} kind="stadium" label="Start" />
      <Shape x={42} y={96} w={56} h={32} kind="diamond" />
      <Shape x={42} y={150} w={56} h={30} kind="rect" accent label="Done" />
      <Arrow from={[70, 72]} to={[70, 96]} />
      <Arrow from={[70, 128]} to={[70, 150]} />

      {/* Mind map */}
      <Label x={210} y={26} anchor="middle" size={10} weight={700} tone="muted">
        MIND MAP
      </Label>
      <Shape x={180} y={94} w={60} h={32} kind="circle" accent label="Idea" />
      <Shape x={150} y={42} w={44} h={24} kind="stadium" label="A" />
      <Shape x={232} y={44} w={44} h={24} kind="stadium" label="B" />
      <Shape x={156} y={150} w={44} h={24} kind="stadium" label="C" />
      <Shape x={230} y={150} w={44} h={24} kind="stadium" label="D" />
      <Arrow from={[200, 96]} to={[178, 66]} tone="muted" head={false} />
      <Arrow from={[222, 96]} to={[252, 68]} tone="muted" head={false} />
      <Arrow from={[200, 124]} to={[182, 150]} tone="muted" head={false} />
      <Arrow from={[222, 124]} to={[250, 150]} tone="muted" head={false} />

      {/* Wireframe */}
      <Label x={350} y={26} anchor="middle" size={10} weight={700} tone="muted">
        WIREFRAME
      </Label>
      <rect
        x={314}
        y={38}
        width={72}
        height={148}
        rx={8}
        className="fill-white stroke-slate-300"
        strokeWidth={2}
      />
      <rect x={314} y={38} width={72} height={20} rx={8} className="fill-slate-100" />
      <rect x={314} y={50} width={72} height={8} className="fill-slate-100" />
      <TextBar x={324} y={47} w={28} h={5} />
      <rect x={324} y={70} width={52} height={26} rx={4} className="fill-brand-100" />
      <TextBar x={324} y={106} w={52} />
      <TextBar x={324} y={118} w={40} tone="faint" />
      <rect x={324} y={134} width={24} height={14} rx={4} className="fill-brand-500" />
      <rect x={352} y={134} width={24} height={14} rx={4} className="fill-slate-200" />
      <TextBar x={324} y={162} w={52} tone="faint" />
    </Scene>
  );
}

/** The open canvas with no sign-in wall: a blank diagram already in use, and a
 *  dismissed "Sign in" gate crossed out to the side. */
export function OpenCanvas() {
  return (
    <Scene w={420} h={220}>
      <Shape x={48} y={70} w={88} h={48} kind="rect" label="Start" />
      <Shape x={180} y={70} w={88} h={48} kind="diamond" />
      <Shape x={180} y={150} w={88} h={44} kind="rect" accent label="Done" />
      <Arrow from={[136, 94]} to={[180, 94]} />
      <Arrow from={[224, 118]} to={[224, 150]} />

      {/* The blocked-out sign-in gate */}
      <g transform="translate(300 58)">
        <rect
          width={104}
          height={92}
          rx={10}
          className="fill-white stroke-slate-200"
          strokeWidth={2}
        />
        <Label x={52} y={22} anchor="middle" size={10} weight={700} tone="muted">
          Sign in
        </Label>
        <rect x={16} y={36} width={72} height={16} rx={5} className="fill-slate-100" />
        <rect x={16} y={58} width={72} height={20} rx={6} className="fill-brand-200" />
        {/* Crossed out */}
        <line
          x1={6}
          y1={6}
          x2={98}
          y2={86}
          className="stroke-rose-500"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
      <Label x={352} y={166} anchor="middle" size={11} weight={700} tone="accent">
        Not required
      </Label>
    </Scene>
  );
}

/** Open source motif: a code window whose contents flow out to a self-hosted
 *  copy you can run, with an MIT-licence tag. */
export function OpenSource() {
  return (
    <Scene w={420} h={210} bg="plain">
      {/* Code window */}
      <rect
        x={32}
        y={36}
        width={176}
        height={138}
        rx={10}
        className="fill-slate-800"
        strokeWidth={2}
      />
      <rect x={32} y={36} width={176} height={22} rx={10} className="fill-slate-700" />
      <circle cx={46} cy={47} r={3} className="fill-rose-400" />
      <circle cx={58} cy={47} r={3} className="fill-amber-400" />
      <circle cx={70} cy={47} r={3} className="fill-emerald-400" />
      {[
        ['fill-emerald-400', 70, 48],
        ['fill-slate-400', 86, 96],
        ['fill-brand-300', 102, 72],
        ['fill-slate-400', 118, 120],
        ['fill-emerald-400', 134, 60],
        ['fill-slate-400', 150, 104],
      ].map(([cls, y, w], i) => (
        <rect
          key={i}
          x={48 + (i % 2) * 10}
          y={y as number}
          width={w as number}
          height={6}
          rx={3}
          className={cls as string}
        />
      ))}

      {/* Flow to a runnable copy */}
      <Arrow from={[214, 105]} to={[268, 105]} tone="accent" />

      {/* Self-hosted copy */}
      <rect
        x={276}
        y={56}
        width={120}
        height={98}
        rx={10}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <rect x={276} y={56} width={120} height={20} rx={10} className="fill-brand-100" />
      <Label x={336} y={67} anchor="middle" size={10} weight={700} tone="accent">
        Your copy
      </Label>
      <Shape x={292} y={90} w={40} h={24} kind="rect" label="A" />
      <Shape x={344} y={90} w={40} h={24} kind="circle" accent />
      <Arrow from={[332, 102]} to={[344, 102]} tone="muted" />
      <TextBar x={292} y={130} w={92} tone="accent" />

      {/* MIT licence tag */}
      <g transform="translate(32 178)">
        <rect
          width={72}
          height={22}
          rx={7}
          className="fill-white stroke-brand-300"
          strokeWidth={1.5}
        />
        <Label x={36} y={12} anchor="middle" size={10} weight={700} tone="accent">
          MIT licence
        </Label>
      </g>
    </Scene>
  );
}
