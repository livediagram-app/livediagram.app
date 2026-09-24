import type { ReactNode } from 'react';

// The drawing kit the Settings illustrations share: the frame size, the
// colour roles, and the editor-window outline most of them are drawn inside.
// Split out so the toggle drawings (settings-illustrations.tsx) and the
// one-per-option choice drawings (settings-choice-illustrations.tsx) are
// drawn from the same parts and cannot drift into two styles.

export const W = 104;
export const H = 66;
export const GAP = 18;

export const PAPER = 'fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600';
export const CHROME = 'fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600';
export const PANEL = 'fill-brand-500/20 stroke-brand-500/70';
export const SHAPE = 'fill-slate-200 stroke-slate-400 dark:fill-slate-700 dark:stroke-slate-500';

// The editor window: the header strip and bottom tab bar every layout keeps.
// Drawing them is what makes two states read as the same app twice rather
// than two unrelated boxes.
export function Window({ children }: { children?: ReactNode }) {
  return (
    <g strokeWidth="1">
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="3.5" className={PAPER} />
      <path d={`M0.5 10.5h${W - 1}`} className="stroke-slate-300 dark:stroke-slate-600" />
      <rect x="0.5" y={H - 9.5} width={W - 1} height="9" className={CHROME} />
      <rect
        x="5"
        y={H - 7}
        width="16"
        height="4"
        rx="1.5"
        className="fill-brand-500/40 stroke-none"
      />
      {children}
    </g>
  );
}

// The ring and caption every state drawing wears, whichever registry it is
// in. `current` rings it: glance at the picture and you know which way the
// setting is set without reading the control.
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
            : 'fill-slate-400 text-[8px] dark:fill-slate-500'
        }
      >
        {caption}
      </text>
    </>
  );
}
