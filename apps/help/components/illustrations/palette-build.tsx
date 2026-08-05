// Build-category illustrations (spec/132): the containers you lay a diagram
// out with. The frame is the one that needed drawing, because what it does is
// spatial (it sits behind a cluster and takes the cluster with it) and no
// amount of prose replaces seeing that.

import { Scene, Shape, Arrow, Label } from './primitives';

/** A frame around a cluster: drawn behind its contents, labelled top-left, and
 *  mid-drag with a ghost of where the whole section is heading. */
export function FrameSection() {
  return (
    <Scene w={420} h={230}>
      {/* Where the section is going: the same outline, faint. */}
      <rect
        x={202}
        y={54}
        width={180}
        height={118}
        rx={8}
        className="fill-none stroke-brand-200"
        strokeWidth={1.5}
        strokeDasharray="6 5"
      />
      {/* The frame itself: fill-less, so its contents show through. */}
      <rect
        x={30}
        y={40}
        width={180}
        height={118}
        rx={8}
        className="fill-none stroke-brand-400"
        strokeWidth={2}
      />
      <Label x={36} y={30} size={11} weight={700} tone="accent">
        Rollout
      </Label>
      <Shape x={46} y={56} w={70} h={36} label="Plan" />
      <Shape x={132} y={56} w={64} h={36} kind="circle" accent label="Ship" />
      <Shape x={46} y={110} w={70} h={36} label="Review" />
      <Arrow from={[116, 74]} to={[132, 74]} />
      <Arrow from={[81, 92]} to={[81, 110]} tone="muted" />
      {/* The drag. */}
      <path
        d="M222 100 L286 106"
        className="stroke-slate-300"
        strokeWidth={2}
        strokeDasharray="5 5"
        strokeLinecap="round"
        fill="none"
      />
      <Label x={210} y={196} size={10} tone="muted" anchor="middle">
        Drag the frame, the whole section goes
      </Label>
    </Scene>
  );
}
