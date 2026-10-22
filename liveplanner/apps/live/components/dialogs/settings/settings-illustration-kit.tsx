import type { ReactNode } from 'react';

// The drawing kit the Settings illustrations are drawn from: the frame size,
// the ring and caption every state wears, and click-to-pick.

export const W = 104;
export const H = 66;
export const GAP = 18;

// The widest a drawing renders, as rem per viewBox unit: two frames, a gap
// and a 4-unit margin each side in 17rem, so a drawing of any option count
// keeps the same frame size.
const TOGGLE_MAX_REM = 17;
export const REM_PER_UNIT = TOGGLE_MAX_REM / (W * 2 + GAP + 8);

// The ring and caption every state drawing wears, whichever registry it is
// in. `current` rings it: glance at the picture and you know which way the
// setting is set without reading the control.
// Click-to-pick for one state of a drawing: a pointer cursor and the handler
// when it can be picked, nothing when it can't (no handler wired, already in
// force, or not allowed right now) so a disabled state doesn't look live.
export function pickable(
  onPick: (() => void) | undefined,
  enabled: boolean,
): { onClick?: () => void; className?: string } {
  if (!onPick || !enabled) return {};
  return { onClick: onPick, className: 'cursor-pointer' };
}

export function StateFrame({
  art,
  caption,
  current,
  fade = true,
}: {
  art: ReactNode;
  caption: string;
  current: boolean;
  // Dim the states not in force. Off for a drawing whose COLOUR is the point
  // (light vs dark): dimmed, the light editor reads grey on a dark dialog.
  fade?: boolean;
}) {
  return (
    <>
      {current ? (
        <rect
          x="-3.5"
          y="-3.5"
          width={W + 7}
          height={H + 7}
          rx="6"
          className="fill-brand-500/5 stroke-brand-500"
          strokeWidth="1.5"
        />
      ) : null}
      <g className={current || !fade ? '' : 'opacity-60'}>{art}</g>
      <text
        x={W / 2}
        y={H + 13}
        textAnchor="middle"
        className={
          current
            ? 'fill-brand-600 text-[8px] font-semibold dark:fill-brand-300'
            : 'fill-slate-400 text-[8px]'
        }
      >
        {caption}
      </text>
    </>
  );
}
