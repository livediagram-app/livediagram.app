// The Tab Style dialog's shared bits, for every product's canvas-basics scenes (docs/specs/018-help/help-app.md):
// captions, option boxes, sliders, carousel headings and page dots, and the panel a Tab Style pane opens in
// under its back bar (CanvasThemeDialog.tsx, BackBar.tsx). Composed from the shared primitives.

import type { ReactNode } from 'react';
import { Dialog, Label, Scene } from '../primitives';

// --- Shared bits -------------------------------------------------------------------------------

/** A small section caption, as the dialogs print them. */
export function Caption({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Label x={x} y={y} size={10} weight={600} tone="muted">
      {children}
    </Label>
  );
}

/** A selectable option box; `on` fills it as the chosen option. */
export function OptionBox({
  x,
  y,
  w,
  h,
  on = false,
  label,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  on?: boolean;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={on ? 1.8 : 1.3}
      />
      {children}
      {label && (
        <Label
          x={x + w / 2}
          y={y + h - 9}
          anchor="middle"
          size={10}
          weight={on ? 700 : 500}
          tone={on ? 'accent' : 'body'}
        >
          {label}
        </Label>
      )}
    </g>
  );
}

/** A slider: caption and percentage readout over a track with a knob at `t` (0 to 1). */
export function Slider({
  x,
  y,
  w,
  t,
  label,
  readout,
}: {
  x: number;
  y: number;
  w: number;
  t: number;
  label: string;
  readout: string;
}) {
  return (
    <g>
      <Caption x={x} y={y}>
        {label}
      </Caption>
      <Label x={x + w} y={y} anchor="end" size={10} weight={600} tone="body">
        {readout}
      </Label>
      <rect x={x} y={y + 12} width={w} height={4} rx={2} className="fill-slate-200" />
      <rect x={x} y={y + 12} width={w * t} height={4} rx={2} className="fill-brand-400" />
      <circle
        cx={x + w * t}
        cy={y + 14}
        r={6}
        className="fill-white stroke-brand-500"
        strokeWidth={1.8}
      />
    </g>
  );
}

/** The shared back bar a Tab Style panel opens under (BackBar.tsx): the chevron well, Tab Style,
 *  and the open panel's name in a chip on the right. */
function TabStyleBackBar({ x, y, w, panel }: { x: number; y: number; w: number; panel: string }) {
  const chipW = panel.length * 6 + 16;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={26}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.3}
      />
      <rect x={x + 7} y={y + 5} width={16} height={16} rx={4} className="fill-slate-100" />
      <path
        d={`M${x + 17} ${y + 9} L${x + 13} ${y + 13} L${x + 17} ${y + 17}`}
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={x + 30} y={y + 13} size={10} weight={600} tone="body">
        Tab Style
      </Label>
      <rect
        x={x + w - 7 - chipW}
        y={y + 6}
        width={chipW}
        height={14}
        rx={4}
        className="fill-slate-100"
      />
      <Label x={x + w - 7 - chipW / 2} y={y + 13} anchor="middle" size={9} weight={600} tone="body">
        {panel}
      </Label>
    </g>
  );
}

/** A carousel's previous / next arrows, right-aligned to `right`, centred on `y`. */
function PagerArrows({ right, y }: { right: number; y: number }) {
  return (
    <g>
      {[0, 1].map((i) => {
        const bx = right - 36 + i * 20;
        const d =
          i === 0
            ? `M${bx + 9.5} ${y - 3} L${bx + 6.5} ${y} L${bx + 9.5} ${y + 3}`
            : `M${bx + 6.5} ${y - 3} L${bx + 9.5} ${y} L${bx + 6.5} ${y + 3}`;
        return (
          <g key={i}>
            <rect
              x={bx}
              y={y - 7}
              width={16}
              height={14}
              rx={4}
              className="fill-white stroke-slate-200"
              strokeWidth={1.2}
            />
            <path
              d={d}
              fill="none"
              className="stroke-slate-500"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </g>
  );
}

/** A carousel's page dots, centred on `cx`, the first page current. */
export function PageDots({ cx, y, count }: { cx: number; y: number; count: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={cx + (i - (count - 1) / 2) * 10}
          cy={y}
          r={2.5}
          className={i === 0 ? 'fill-brand-500' : 'fill-slate-300'}
        />
      ))}
    </g>
  );
}

/** A carousel heading: the section caption on the left, the pager arrows on the right. */
export function CarouselHeading({ y, label }: { y: number; label: string }) {
  return (
    <g>
      <Caption x={60} y={y}>
        {label}
      </Caption>
      <PagerArrows right={360} y={y - 2} />
    </g>
  );
}

/** A Tab Style panel as it opens from Fine-tune: the dialog, then the shared back bar naming
 *  the panel. */
export function TabStylePanel({
  panel,
  h,
  sceneH,
  children,
}: {
  panel: 'Colours' | 'Text' | 'Canvas';
  h: number;
  sceneH: number;
  children: ReactNode;
}) {
  return (
    <Scene w={420} h={sceneH} bg="plain">
      <Dialog
        x={40}
        y={12}
        w={340}
        h={h}
        title="Tab Style"
        sceneW={420}
        sceneH={sceneH}
        scrim={false}
      >
        <TabStyleBackBar x={60} y={56} w={300} panel={panel} />
        {children}
      </Dialog>
    </Scene>
  );
}
