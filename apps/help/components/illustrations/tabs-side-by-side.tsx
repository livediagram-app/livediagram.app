// Side by side tabs (docs/specs/007-editor/split-view.md, docs/specs/018-help/help-app.md): a tab pill
// dragged to the right edge with the drop ghost showing, and the open split, one header and one tab
// bar across both panes, the editor's chrome in the pane being edited and the seam's two buttons.
// Composed only from the shared primitives so the house style holds.

import { Arrow, Cursor, Label, Scene, Shape } from './primitives';

const W = 440;
const H = 230;
const HEADER = 26;
const FOOTER = 26;

/** The site header strip, across the whole window. */
function Header({ title }: { title: string }) {
  return (
    <g>
      <rect x={0} y={0} width={W} height={HEADER} className="fill-white stroke-slate-200" />
      <Label x={W / 2} y={17} size={10} weight={600} tone="strong" anchor="middle">
        {title}
      </Label>
    </g>
  );
}

/** The tab bar, across the whole window, with its pills. `beside` marks the tab in the other pane. */
function Footer({
  tabs,
}: {
  tabs: { label: string; x: number; w: number; active?: boolean; beside?: boolean }[];
}) {
  const y = H - FOOTER;
  return (
    <g>
      <rect x={0} y={y} width={W} height={FOOTER} className="fill-slate-50 stroke-slate-200" />
      {tabs.map((t) => (
        <g key={t.label}>
          <rect
            x={t.x}
            y={y + 5}
            width={t.w}
            height={16}
            rx={5}
            className={
              t.active
                ? 'fill-white stroke-brand-400'
                : t.beside
                  ? 'fill-slate-100 stroke-brand-400'
                  : 'fill-slate-100 stroke-transparent'
            }
            strokeWidth={1.2}
            strokeDasharray={t.beside ? '3 2' : undefined}
          />
          <Label
            x={t.x + t.w / 2}
            y={y + 16}
            size={8.5}
            weight={600}
            tone={t.active ? 'accent' : 'muted'}
            anchor="middle"
          >
            {t.label}
          </Label>
        </g>
      ))}
    </g>
  );
}

/** A floating panel of the editor's chrome (a palette, the Explorer), drawn as a titled card. */
function ChromePanel({
  x,
  y,
  w,
  h,
  title,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5} className="fill-white stroke-slate-300" />
      <Label x={x + 6} y={y + 10} size={6.5} weight={600} tone="muted">
        {title}
      </Label>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={x + 6 + i * ((w - 12) / 3)}
          y={y + 16}
          width={(w - 12) / 3 - 4}
          height={h - 22}
          rx={2}
          className="fill-slate-100"
        />
      ))}
    </g>
  );
}

/** Dragging a tab pill toward the right edge: the drop zone's ghost shows the pane it will open. */
export function SideBySideDrag() {
  const ghostX = W * 0.52;
  return (
    <Scene w={W} h={H}>
      <Header title="Launch plan" />
      <Shape x={60} y={70} w={70} h={34} label="Goals" />
      <Shape x={150} y={110} w={70} h={34} label="Risks" />
      <Arrow from={[130, 87]} to={[150, 120]} tone="muted" width={1.5} />
      {/* The ghost of the pane, at the width it will open. */}
      <rect
        x={ghostX}
        y={HEADER}
        width={W - ghostX}
        height={H - HEADER - FOOTER}
        rx={8}
        className="fill-brand-50 stroke-brand-500"
        strokeWidth={2}
      />
      <Label x={ghostX + 12} y={HEADER + 18} size={9} weight={600} tone="accent">
        Open Timeline Side by Side
      </Label>
      <Shape x={ghostX + 30} y={HEADER + 50} w={60} h={28} label="Q1" />
      <Shape x={ghostX + 110} y={HEADER + 50} w={60} h={28} label="Q2" />
      <rect
        x={ghostX + (W - ghostX) / 2 - 38}
        y={H - FOOTER - 32}
        width={76}
        height={18}
        rx={9}
        className="fill-brand-600"
      />
      <Label
        x={ghostX + (W - ghostX) / 2}
        y={H - FOOTER - 20}
        size={8.5}
        weight={600}
        tone="onAccent"
        anchor="middle"
      >
        Release to Open
      </Label>
      <Footer
        tabs={[
          { label: 'Plan', x: 10, w: 48, active: true },
          { label: 'Timeline', x: 64, w: 60 },
        ]}
      />
      {/* The pill on its way, under the pointer. */}
      <Arrow
        from={[96, H - FOOTER - 8]}
        to={[ghostX + 70, 140]}
        kind="curved"
        tone="muted"
        dashed
        width={1.5}
      />
      <Cursor x={ghostX + 74} y={136} />
    </Scene>
  );
}

/** The open split: one header and one tab bar across both panes, the editor's chrome in the left
 *  pane (being edited), the other tab live on the right, and the seam's Fit and Close buttons. */
export function SideBySideOpen() {
  const seam = W / 2;
  const top = HEADER;
  return (
    <Scene w={W} h={H}>
      {/* Left pane: the editor, with its panels. */}
      <ChromePanel x={8} y={top + 8} w={56} h={44} title="EXPLORER" />
      <ChromePanel x={seam - 70} y={top + 8} w={62} h={34} title="PALETTE" />
      <Shape x={80} y={top + 70} w={64} h={30} label="Goals" />
      <Shape x={120} y={top + 120} w={64} h={30} label="Risks" accent labelTone="onAccent" />
      {/* Right pane: the other tab, live, with its name chip. */}
      <rect
        x={seam}
        y={top}
        width={W - seam}
        height={H - top - FOOTER}
        className="fill-slate-50/60"
      />
      <rect
        x={seam + 10}
        y={top + 8}
        width={62}
        height={16}
        rx={8}
        className="fill-white stroke-slate-300"
      />
      <Label x={seam + 18} y={top + 19} size={8} weight={600} tone="strong">
        Timeline
      </Label>
      <Shape x={seam + 40} y={top + 70} w={60} h={28} label="Q1" />
      <Shape x={seam + 120} y={top + 70} w={60} h={28} label="Q2" />
      <Arrow from={[seam + 100, top + 84]} to={[seam + 120, top + 84]} tone="muted" width={1.5} />
      {/* The seam: the line, its two buttons, and the resize grip below them. */}
      <line
        x1={seam}
        y1={top}
        x2={seam}
        y2={H - FOOTER}
        className="stroke-slate-300"
        strokeWidth={1.2}
      />
      <rect
        x={seam - 8}
        y={top + 54}
        width={16}
        height={34}
        rx={8}
        className="fill-white stroke-slate-300"
      />
      <path
        d={`M${seam - 3.5} ${top + 62} h7 M${seam - 3.5} ${top + 62} v3 M${seam + 3.5} ${top + 62} v3`}
        className="stroke-slate-500"
        strokeWidth={1.2}
        fill="none"
      />
      <path
        d={`M${seam - 3} ${top + 76} l6 6 M${seam + 3} ${top + 76} l-6 6`}
        className="stroke-slate-500"
        strokeWidth={1.2}
      />
      <rect
        x={seam - 3}
        y={top + 96}
        width={6}
        height={20}
        rx={3}
        className="fill-white stroke-slate-300"
      />
      <Header title="Launch plan" />
      <Footer
        tabs={[
          { label: 'Plan', x: 10, w: 48, active: true },
          { label: 'Timeline', x: 64, w: 60, beside: true },
          { label: 'Budget', x: 130, w: 54 },
        ]}
      />
      <Label x={seam + 12} y={H - FOOTER - 12} size={8.5} tone="muted">
        Click here to edit Timeline
      </Label>
    </Scene>
  );
}
