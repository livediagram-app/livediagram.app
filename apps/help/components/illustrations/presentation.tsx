// Presentation-mode illustrations (docs/specs/012-collaboration/presentation-mode.md): the Slide Deck panel you build a
// deck in, a slide's `…` menu, the travelling transition, and the presenter's
// HUD strip. Composed from the shared primitives, with raw shapes only for the
// motifs the kit lacks (the HUD's dark strip, the jump grid glyph).

import { useId } from 'react';
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
        y={y + 10}
        size={10.5}
        weight={600}
        tone={hidden ? 'muted' : 'strong'}
        className={hidden ? 'fill-slate-400 line-through' : undefined}
      >
        {name}
      </Label>
      <Label x={x + 24} y={y + 23} size={10} tone="muted">
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
        {/* The header's presenter-settings cog, then the help link. */}
        <g className="stroke-slate-400" strokeWidth={1.4} fill="none" transform="translate(290 27)">
          <circle r={4.5} />
          <circle r={1.4} />
        </g>
        <Label x={310} y={28} size={10} weight={700} anchor="middle" tone="muted">
          ?
        </Label>
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
        <Button x={108} y={182} w={204} h={24} label="Present" variant="primary" />
        <rect
          x={236}
          y={187}
          width={18}
          height={14}
          rx={7}
          className="fill-white/25 help-art-as-drawn"
        />
        <Label x={245} y={195} size={10} weight={700} anchor="middle" tone="onAccent">
          2
        </Label>
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
        x={140}
        y={62}
        width={262}
        height={140}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* The quick actions are icon-only buttons (MenuTiles.tsx), named in hover cards:
          Rename, Add notes, Duplicate, then Delete held apart at the right edge. */}
      {quick.map((label, i) => {
        const bx = i === 3 ? 360 : 150 + i * 38;
        const cx = bx + 16;
        const cy = 89;
        return (
          <g key={label} aria-label={label}>
            <rect
              x={bx}
              y={73}
              width={32}
              height={32}
              rx={7}
              className="fill-slate-50 stroke-slate-200"
              strokeWidth={1.2}
            />
            <g
              className="stroke-slate-500"
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {i === 0 && <path d={`M${cx - 6} ${cy + 6} l2 -6 l8 -8 l4 4 l-8 8 z`} />}
              {i === 1 && (
                <path
                  d={`M${cx - 6} ${cy - 7} h12 v14 h-12 z M${cx - 3} ${cy - 3} h6 M${cx - 3} ${cy + 1} h6`}
                />
              )}
              {i === 2 && (
                <path d={`M${cx - 6} ${cy - 3} h9 v10 h-9 z M${cx - 3} ${cy - 6} h9 v10`} />
              )}
              {i === 3 && (
                <path
                  d={`M${cx - 7} ${cy - 5} h14 M${cx - 5} ${cy - 5} l1 12 h8 l1 -12 M${cx - 2} ${cy - 8} h4`}
                />
              )}
            </g>
          </g>
        );
      })}
      <rect x={150} y={116} width={242} height={34} rx={6} className="fill-brand-50" />
      <Label x={162} y={127} size={10} weight={700} tone="accent">
        Selection
      </Label>
      <Label x={162} y={141} size={10} tone="muted">
        Add · Remove · 3 on this slide
      </Label>
      <rect
        x={150}
        y={156}
        width={242}
        height={34}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={162} y={167} size={10} weight={700} tone="strong">
        Visibility
      </Label>
      <Label x={162} y={181} size={10} tone="muted">
        Hide this slide from the run
      </Label>
    </Scene>
  );
}

/** The default Slide transition, mid-move: the screen already holds the new slide, which sweeps in
 *  from the right (canvas-motion.css translates only the incoming canvas). The old slide does not
 *  travel; it is simply replaced. */
export function SlideTransition() {
  const clip = `st-${useId().replace(/:/g, '')}`;
  return (
    <Scene w={420} h={230} bg="none">
      <defs>
        <clipPath id={clip}>
          <rect x={60} y={28} width={280} height={166} rx={10} />
        </clipPath>
      </defs>
      {/* The screen */}
      <rect
        x={60}
        y={28}
        width={280}
        height={166}
        rx={10}
        className="fill-slate-100 stroke-slate-300 dark:fill-slate-800"
        strokeWidth={1.5}
      />
      {/* The incoming slide, a third of the way in, clipped by the screen's edge */}
      <g clipPath={`url(#${clip})`}>
        <g transform="translate(84 0)">
          <rect
            x={60}
            y={28}
            width={280}
            height={166}
            rx={10}
            className="fill-white stroke-brand-300"
            strokeWidth={2}
          />
          <Shape x={92} y={64} w={92} h={40} kind="rect" label="Cause" />
          <Shape x={206} y={64} w={72} h={40} kind="circle" accent label="Fix" />
          <TextBar x={92} y={136} w={150} h={7} />
          <TextBar x={92} y={152} w={100} h={7} tone="faint" />
        </g>
      </g>
      {/* The direction it is travelling */}
      <path
        d="M404 111 H364"
        className="stroke-brand-400"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M352 111 l12 -7 v14 z" className="fill-brand-400" />
      <Label x={200} y={214} anchor="middle" size={10} tone="muted">
        The next slide sweeps in from the right, backdrop and all
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
      {/* The HUD itself, dark in both appearances */}
      <g className="help-art-as-drawn">
        <rect x={40} y={32} width={364} height={30} rx={9} className="fill-slate-800" />
        <Label x={52} y={47} size={10} weight={700} tone="onAccent">
          7 / 23
        </Label>
        <Label x={90} y={47} size={10} className="fill-slate-400">
          Rollout plan
        </Label>
        <Label x={160} y={47} size={10} weight={600} className="fill-slate-300">
          12:04
        </Label>
        <rect x={194} y={38} width={70} height={18} rx={4} className="fill-amber-400/25" />
        <Label x={229} y={47} size={10} weight={600} anchor="middle" className="fill-amber-300">
          4:12 / 3:00
        </Label>
        {['‹', '›'].map((g, i) => (
          <Label key={g} x={286 + i * 18} y={47} size={13} anchor="middle" tone="onAccent">
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
      </g>
      <Label x={210} y={196} size={10} tone="muted" anchor="middle">
        Fades when the pointer rests, back the moment you move
      </Label>
    </Scene>
  );
}
