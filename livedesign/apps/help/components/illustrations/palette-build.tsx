// Build-category illustrations (docs/specs/010-palette/build-category.md): the containers you lay a diagram
// out with. The frame is the one that needed drawing, because what it does is
// spatial (it sits behind a cluster and takes the cluster with it) and no
// amount of prose replaces seeing that.

import { Scene, Shape, Arrow, Label } from './primitives';

/** A frame around a cluster: drawn behind its contents, its title inside the top-right
 *  corner, and mid-drag with a ghost of where the whole section is heading. */
export function FrameSection() {
  // The section after the drag: a faint copy of the frame and everything in it, to the right.
  const dx = 216;
  const ghost = [
    { x: 32, y: 66, w: 66, h: 36, rx: 7 },
    { x: 116, y: 66, w: 60, h: 36, rx: 18 },
    { x: 32, y: 114, w: 66, h: 36, rx: 7 },
  ];
  return (
    <Scene w={420} h={230}>
      {/* The frame itself: fill-less, so its contents show through. */}
      <rect
        x={20}
        y={40}
        width={170}
        height={122}
        rx={1}
        className="fill-none stroke-brand-400"
        strokeWidth={2}
      />
      <Label x={184} y={54} size={11} weight={700} tone="accent" anchor="end">
        Rollout
      </Label>
      <Shape x={32} y={66} w={66} h={36} label="Plan" />
      <Shape x={116} y={66} w={60} h={36} kind="circle" accent label="Ship" />
      <Shape x={32} y={114} w={66} h={36} label="Review" />
      <Arrow from={[98, 84]} to={[116, 84]} />
      <Arrow from={[65, 102]} to={[65, 114]} tone="muted" />
      {/* The drag, from the frame's edge to where the section lands */}
      <Arrow from={[196, 101]} to={[230, 101]} tone="muted" />
      {/* Where it lands: the frame and its whole cluster, together */}
      <g opacity={0.5}>
        <rect
          x={20 + dx}
          y={40}
          width={170}
          height={122}
          rx={1}
          className="fill-none stroke-brand-300"
          strokeWidth={1.5}
          strokeDasharray="6 5"
        />
        {ghost.map((g, i) => (
          <rect
            key={i}
            x={g.x + dx}
            y={g.y}
            width={g.w}
            height={g.h}
            rx={g.rx}
            className="fill-none stroke-brand-300"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ))}
      </g>
      <Label x={210} y={196} size={10} tone="muted" anchor="middle">
        Drag the frame, the whole section goes
      </Label>
    </Scene>
  );
}
