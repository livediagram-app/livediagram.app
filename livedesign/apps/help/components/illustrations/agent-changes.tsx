// Agent changesets in the editor (docs/specs/024-agents/agent-changesets.md "In the editor"): the
// change arrives outlined in its author's colour, and an information toast at the bottom names it
// with Show and Undo (apps/live/hooks/ui/useToast.tsx, apps/live/app/design/[id]/useChangesetFeed.ts).

import { Arrow, Button, Label, Scene, Shape } from './primitives';

/** The info toast's glyph: a circle with an "i", as ToneGlyph draws it. */
function InfoGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill="none"
      className="stroke-slate-600"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <circle cx={0} cy={0} r={6.5} />
      <path d="M0 3v-3M0 -3h0" />
    </g>
  );
}

/** The change toast an agent's changeset raises: the author, the count and the summary, then
 *  Show (secondary) and Undo (primary), with the dismiss cross on the right. */
export function AgentChangeToast() {
  return (
    <Scene w={420} h={220}>
      <Shape x={50} y={34} w={96} h={44} label="Checkout" />
      <Arrow from={[146, 56]} to={[238, 56]} />
      <Shape x={250} y={34} w={120} h={44} label="Payment service" />
      {/* The reveal outline, in the token owner's colour, around what the changeset touched. */}
      <rect
        x={243}
        y={27}
        width={134}
        height={58}
        rx={11}
        className="fill-none stroke-violet-500 dark:stroke-violet-700"
        strokeWidth={2.5}
      />

      <g>
        <rect
          x={40}
          y={122}
          width={340}
          height={76}
          rx={8}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <InfoGlyph x={60} y={140} />
        <Label x={76} y={140} size={10} tone="strong">
          Webber changed 2 elements: add payment service
        </Label>
        <Button x={76} y={156} w={50} h={24} label="Show" />
        <Button x={134} y={156} w={50} h={24} label="Undo" variant="primary" />
        <path
          d="M360 136l7 7M367 136l-7 7"
          className="stroke-slate-400"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </g>
    </Scene>
  );
}
