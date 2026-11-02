// Illustration for Find and Replace (docs/specs/018-help/help-app.md, docs/specs/007-editor/find-and-replace.md):
// the Find bar at the top right of the canvas (components/find/FindBar.tsx) with its Replace row open, over a page
// whose matches are tinted, the match in hand stronger, and an element holding a match ringed. Composed from the
// shared primitives.

import { Label, Scene, TextBar } from '@liveworkspace/help-site/art/primitives';

/** A small square control in the bar, its glyph drawn by the caller. */
function BarControl({ x, y, pressed = false }: { x: number; y: number; pressed?: boolean }) {
  return (
    <rect
      x={x}
      y={y}
      width={18}
      height={18}
      rx={4}
      className={pressed ? 'fill-brand-50 stroke-brand-200' : 'fill-white stroke-white'}
      strokeWidth={1}
    />
  );
}

/** The Find bar open with its Replace row, over a page with its matches highlighted. */
export function FindBarScene() {
  return (
    <Scene w={420} h={240}>
      {/* The page, its writing and a box holding a match. */}
      <rect x={30} y={30} width={220} height={200} rx={2} className="fill-slate-200" />
      <rect
        x={28}
        y={27}
        width={220}
        height={200}
        rx={2}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={46} y={50} size={14} weight={800} tone="strong">
        Launch plan
      </Label>
      {/* A match, tinted find yellow (the same in both appearances). */}
      <g className="help-art-as-drawn">
        <rect x={44} y={64} width={34} height={11} rx={2} className="fill-amber-100" />
        <Label x={46} y={70} size={9.5} tone="strong">
          launch
        </Label>
      </g>
      <TextBar x={82} y={67} w={140} />
      <TextBar x={46} y={81} w={176} />
      {/* The match in hand, in a stronger amber with an outline. */}
      <TextBar x={46} y={95} w={70} />
      <g className="help-art-as-drawn">
        <rect
          x={120}
          y={92}
          width={34}
          height={11}
          rx={2}
          className="fill-amber-400 stroke-amber-500"
          strokeWidth={1}
        />
        <Label x={122} y={98} size={9.5} tone="strong">
          launch
        </Label>
      </g>
      <TextBar x={158} y={95} w={64} />
      <TextBar x={46} y={109} w={150} />
      {/* A box whose label holds a match: ringed in dashed yellow. */}
      <rect
        x={42}
        y={132}
        width={96}
        height={44}
        rx={6}
        fill="none"
        className="stroke-amber-400"
        strokeWidth={1.6}
        strokeDasharray="4 3"
      />
      <rect
        x={46}
        y={136}
        width={88}
        height={36}
        rx={5}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={1}
      />
      <Label x={90} y={155} size={9.5} weight={600} tone="strong" anchor="middle">
        Launch day
      </Label>
      <TextBar x={150} y={142} w={80} />
      <TextBar x={150} y={154} w={64} />
      <TextBar x={46} y={194} w={176} />
      <TextBar x={46} y={206} w={120} />

      {/* The Find bar: a card at the top right of the canvas. */}
      <rect
        x={170}
        y={12}
        width={240}
        height={66}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Show/Hide Replace, turned down while the Replace row is open. */}
      <path
        d="M178 25 l4 4 l4 -4"
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* The Find field with its count. */}
      <rect
        x={192}
        y={18}
        width={98}
        height={20}
        rx={5}
        className="fill-white stroke-brand-400"
        strokeWidth={1.2}
      />
      <Label x={198} y={28.5} size={10} tone="strong">
        launch
      </Label>
      <Label x={285} y={28.5} size={9} tone="muted" anchor="end">
        2 of 5
      </Label>
      {/* Match Case, Whole Word, then Previous, Next, help and Close. */}
      <BarControl x={293} y={19} />
      <Label x={302} y={28.5} size={9} weight={700} tone="body" anchor="middle">
        Aa
      </Label>
      <BarControl x={312} y={19} />
      <Label x={321} y={28} size={9} weight={700} tone="body" anchor="middle">
        ab
      </Label>
      <line x1={316} y1={33} x2={326} y2={33} className="stroke-slate-600" strokeWidth={1.2} />
      <g className="stroke-slate-600" strokeWidth={1.3} fill="none" strokeLinecap="round">
        <path d="M341 32 v-8 M337.5 27.5 l3.5 -3.5 l3.5 3.5" />
        <path d="M357 24 v8 M353.5 28.5 l3.5 3.5 l3.5 -3.5" />
      </g>
      <Label x={373} y={28.5} size={11} weight={700} tone="muted" anchor="middle">
        ?
      </Label>
      <path
        d="M386 24.5 l7 7 M393 24.5 l-7 7"
        className="stroke-slate-600"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      {/* The Replace row. */}
      <rect
        x={192}
        y={46}
        width={98}
        height={20}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={198} y={56.5} size={10} tone="strong">
        release
      </Label>
      <rect
        x={294}
        y={46}
        width={44}
        height={20}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={316} y={56.5} size={9.5} weight={600} tone="body" anchor="middle">
        Replace
      </Label>
      <rect x={342} y={46} width={60} height={20} rx={5} className="fill-brand-500" />
      <Label x={372} y={56.5} size={9.5} weight={600} tone="onAccent" anchor="middle">
        Replace All
      </Label>
    </Scene>
  );
}
