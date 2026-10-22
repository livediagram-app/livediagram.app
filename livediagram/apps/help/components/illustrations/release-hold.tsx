// Freeing an element somebody left selected (docs/specs/012-collaboration/facilitator.md "Freeing
// somebody's lock", apps/editor/components/canvas/LockedElementMenu.tsx). Composed only from the
// shared primitives so the house style holds.

import { Scene, Shape, Avatar, Cursor, Label } from './primitives';

/** A teammate's held element (their dashed outline and initials disc), right-clicked by you, with
 *  the small In use menu open beside it: one Release row per holder, and the note underneath. */
export function ReleaseHold() {
  const menuX = 184;
  const menuY = 70;
  const menuW = 206;
  return (
    <Scene w={420} h={200}>
      <Shape x={44} y={72} w={112} h={56} kind="rect" label="Schema" />
      {/* The holder's selection outline, in their colour */}
      <rect
        x={40}
        y={68}
        width={120}
        height={64}
        rx={6}
        className="fill-none stroke-violet-500"
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      <Avatar cx={42} cy={70} r={10} initial="J" colour="violet" />
      {/* Your pointer, right-clicking the locked element */}
      <Cursor x={146} y={98} />
      {/* The In use menu, opened at the click */}
      <g>
        <rect
          x={menuX}
          y={menuY}
          width={menuW}
          height={84}
          rx={8}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={menuX + 12} y={menuY + 14} size={8} weight={700} tone="muted">
          IN USE
        </Label>
        <rect
          x={menuX + 4}
          y={menuY + 24}
          width={menuW - 8}
          height={22}
          rx={5}
          className="fill-slate-100"
        />
        <circle cx={menuX + 15} cy={menuY + 35} r={3.5} className="fill-violet-500" />
        <Label x={menuX + 25} y={menuY + 36} size={11} tone="body">
          Release Jae’s Hold
        </Label>
        <Label x={menuX + 12} y={menuY + 60} size={9} tone="muted">
          They keep their work; it just stops
        </Label>
        <Label x={menuX + 12} y={menuY + 72} size={9} tone="muted">
          being theirs to edit.
        </Label>
      </g>
    </Scene>
  );
}
