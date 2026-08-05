// Presentation-mode illustrations (spec/31): the Slide Deck panel you build a
// deck in, a slide's `…` menu, the travelling transition, and the presenter's
// HUD strip. Composed from the shared primitives, with raw shapes only for the
// motifs the kit lacks (the HUD's dark strip, the jump grid glyph).

import { Scene, Shape, Panel, Label, Button, TextBar } from './primitives';

/** One row of the Slide Deck panel: position, name, tab and element count. */
function SlideRow({
  x,
  y,
  w,
  n,
  name,
  tab,
  count,
  hidden = false,
  active = false,
}: {
  x: number;
  y: number;
  w: number;
  n: number;
  name: string;
  tab: string;
  count: number;
  hidden?: boolean;
  active?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={30}
        rx={6}
        className={active ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'}
        strokeWidth={1.2}
      />
      <Label x={x + 10} y={y + 15} size={10} weight={700} tone={hidden ? 'muted' : 'accent'}>
        {String(n)}
      </Label>
      <Label
        x={x + 24}
        y={y + 11}
        size={10.5}
        weight={600}
        tone={hidden ? 'muted' : 'strong'}
        className={hidden ? 'fill-slate-400 line-through' : undefined}
      >
        {name}
      </Label>
      <Label x={x + 24} y={y + 23} size={9} tone="muted">
        {`${tab} · ${count} elements`}
      </Label>
      <Label x={x + w - 12} y={y + 16} size={12} tone="muted" anchor="end">
        ⋯
      </Label>
    </g>
  );
}

/** The Slide Deck panel: the deck in order, a hidden slide struck through, and
 *  the button that counts your selection back to you. */
export function SlideDeckPanel() {
  return (
    <Scene w={420} h={230}>
      <Panel x={96} y={16} w={228} h={198} title="SLIDE DECK">
        <SlideRow
          x={108}
          y={46}
          w={204}
          n={1}
          name="Where we are"
          tab="Overview"
          count={5}
          active
        />
        <SlideRow x={108} y={80} w={204} n={2} name="The bottleneck" tab="Detail" count={3} />
        <SlideRow x={108} y={114} w={204} n={3} name="Old numbers" tab="Detail" count={7} hidden />
        <Button x={108} y={152} w={204} h={26} label="New slide from 3 elements" />
        <Button x={108} y={182} w={204} h={24} label="Present · 2" variant="primary" />
      </Panel>
    </Scene>
  );
}

/** A slide's `…` menu: quick actions across the top, then the two categories. */
export function SlideMenu() {
  // The editor's own labels, so the picture names what the reader will see.
  const quick = ['Rename', 'Add notes', 'Duplicate', 'Delete'];
  return (
    <Scene w={420} h={230}>
      <SlideRow x={40} y={26} w={200} n={2} name="The bottleneck" tab="Detail" count={3} active />
      <rect
        x={168}
        y={62}
        width={214}
        height={140}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {quick.map((label, i) => (
        <g key={label}>
          <rect
            x={178 + i * 49}
            y={72}
            width={45}
            height={34}
            rx={6}
            className={i === 3 ? 'fill-rose-50 stroke-rose-200' : 'fill-slate-50 stroke-slate-200'}
            strokeWidth={1.2}
          />
          <Label
            x={200.5 + i * 49}
            y={89}
            size={8.5}
            anchor="middle"
            weight={600}
            className={i === 3 ? 'fill-rose-500' : 'fill-slate-600'}
          >
            {label}
          </Label>
        </g>
      ))}
      <rect x={178} y={116} width={194} height={34} rx={6} className="fill-brand-50" />
      <Label x={190} y={127} size={10} weight={700} tone="accent">
        Selection
      </Label>
      <Label x={190} y={141} size={9} tone="muted">
        Add · Remove · 3 on this slide
      </Label>
      <rect
        x={178}
        y={156}
        width={194}
        height={34}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={190} y={167} size={10} weight={700} tone="strong">
        Visibility
      </Label>
      <Label x={190} y={181} size={9} tone="muted">
        Hide this slide from the run
      </Label>
    </Scene>
  );
}

/** The transition: the outgoing slide leaving left, the next arriving right. */
export function SlideTransition() {
  return (
    <Scene w={420} h={230} bg="none">
      {/* Outgoing */}
      <g opacity={0.45}>
        <rect
          x={-40}
          y={40}
          width={190}
          height={150}
          rx={10}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <Shape x={-16} y={70} w={80} h={36} label="Step one" />
        <Shape x={-16} y={124} w={80} h={36} label="Step two" />
      </g>
      {/* Incoming */}
      <rect
        x={186}
        y={40}
        width={230}
        height={150}
        rx={10}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Shape x={216} y={72} w={92} h={40} kind="rect" label="Cause" />
      <Shape x={324} y={72} w={68} h={40} kind="circle" accent label="Fix" />
      <TextBar x={216} y={140} w={130} h={7} />
      <TextBar x={216} y={156} w={92} h={7} tone="faint" />
      {/* Travel arrows */}
      <path
        d="M168 118 L120 118"
        className="stroke-slate-300"
        strokeWidth={2}
        strokeDasharray="5 5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M112 118 l8 -5 v10 z" className="fill-slate-300" />
      <Label x={210} y={210} size={10} tone="muted">
        The whole screen travels, backdrop and all
      </Label>
    </Scene>
  );
}

/** The presenter's strip: position, pacing, step buttons, jump, notes, cog and
 *  close, in the order the HUD carries them. The budget chip is drawn in its
 *  over-time state, which is the only state that needs explaining. */
export function PresenterHud() {
  return (
    <Scene w={420} h={230} bg="none">
      {/* The slide behind the strip */}
      <rect x={8} y={16} width={404} height={198} rx={10} className="fill-slate-50" />
      <Shape x={60} y={110} w={110} h={44} label="Rollout" />
      <Shape x={230} y={110} w={110} h={44} accent label="Week one" />
      {/* The HUD itself */}
      <rect x={100} y={32} width={304} height={30} rx={9} className="fill-slate-800" />
      <Label x={112} y={47} size={10} weight={700} tone="onAccent">
        7 / 23
      </Label>
      <Label x={146} y={47} size={9} className="fill-slate-400">
        Rollout plan
      </Label>
      <Label x={212} y={47} size={9.5} weight={600} className="fill-slate-300">
        12:04
      </Label>
      <rect x={238} y={39} width={50} height={16} rx={4} className="fill-amber-400/25" />
      <Label x={263} y={47} size={9} weight={600} anchor="middle" className="fill-amber-300">
        4:12 / 3:00
      </Label>
      {['‹', '›'].map((g, i) => (
        <Label key={g} x={300 + i * 14} y={47} size={13} anchor="middle" tone="onAccent">
          {g}
        </Label>
      ))}
      {/* Jump: the four-pane grid the button wears. */}
      <g className="stroke-white" strokeWidth={1.3} fill="none">
        <rect x={326} y={40} width={6} height={6} rx={1.5} />
        <rect x={334} y={40} width={6} height={6} rx={1.5} />
        <rect x={326} y={48} width={6} height={6} rx={1.5} />
        <rect x={334} y={48} width={6} height={6} rx={1.5} />
      </g>
      {/* Notes: a written card, shown only on a slide that has any. */}
      <g className="stroke-white" strokeWidth={1.3} fill="none">
        <rect x={348} y={39} width={13} height={16} rx={2} />
        <path d="M351 44h7M351 48h4" strokeLinecap="round" />
      </g>
      {/* Settings, then close. */}
      <g className="stroke-white" strokeWidth={1.3} fill="none" transform="translate(375 47)">
        <circle r={5} />
        <circle r={1.6} />
      </g>
      <g className="stroke-white" strokeWidth={1.4} fill="none" strokeLinecap="round">
        <path d="M391 43l8 8M399 43l-8 8" />
      </g>
      <Label x={210} y={196} size={10} tone="muted" anchor="middle">
        Fades when the pointer rests, back the moment you move
      </Label>
    </Scene>
  );
}
