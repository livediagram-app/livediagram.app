// Side by side tabs (docs/specs/007-editor/split-view.md, liveworkspace/docs/specs/017-help/help-centre.md): a tab
// dragged to the right edge with the drop ghost showing, and the open split, one tab bar across both panes, the
// editor's chrome in the pane being edited, Share and the account floating top right, and the seam's two buttons.
// There is no header bar across the top: the tab bar names the tabs.
// Composed only from the shared primitives so the house style holds.

import { Arrow, Avatar, BarTab, Cursor, Label, Scene, Shape } from '../primitives';

const W = 440;
const H = 230;
// No header bar: the panes start at the window's top.
const TOP = 0;
const FOOTER = 26;

/** Share and the account, floating in their card at the window's top right. */
function TopRightCard() {
  return (
    <g>
      <rect
        x={W - 84}
        y={8}
        width={76}
        height={22}
        rx={6}
        className="fill-white stroke-slate-300"
      />
      <rect x={W - 80} y={11} width={44} height={16} rx={5} className="fill-brand-600" />
      <Label x={W - 58} y={19.5} size={8.5} weight={600} tone="onAccent" anchor="middle">
        Share
      </Label>
      <Avatar cx={W - 20} cy={19} r={7.5} initial="A" colour="emerald" />
    </g>
  );
}

/** The tab bar, across the whole window, with its tabs. `beside` marks the tab in the other pane. */
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
        <BarTab
          key={t.label}
          x={t.x}
          y={y + 4}
          w={t.w}
          h={FOOTER - 4}
          label={t.label}
          active={t.active}
          beside={t.beside}
          size={8.5}
        />
      ))}
    </g>
  );
}

/** The editor's top row in a pane, from (x, y) to `right`: the top-left card with the logo and the menu button,
 *  then the palette strip, its category bar a run of glyph buttons (a pane has no room for the names). */
function ChromeTopRow({ x, y, right }: { x: number; y: number; right: number }) {
  const sx = x + 38;
  const tiles = Math.floor((right - sx - 12) / 14);
  return (
    <g>
      <rect x={x} y={y} width={34} height={18} rx={4} className="fill-white stroke-slate-300" />
      <rect x={x + 4} y={y + 4} width={10} height={10} rx={3} className="fill-brand-500" />
      <path
        d={`M${x + 20} ${y + 5.5}h8M${x + 20} ${y + 9}h8M${x + 20} ${y + 12.5}h8`}
        className="stroke-slate-400"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <rect
        x={sx}
        y={y}
        width={right - sx}
        height={18}
        rx={5}
        className="fill-white stroke-slate-300"
      />
      {Array.from({ length: tiles }, (_, i) => (
        <rect
          key={i}
          x={sx + 6 + i * 14}
          y={y + 5}
          width={8}
          height={8}
          rx={2}
          className="fill-slate-100"
        />
      ))}
    </g>
  );
}

/** The first tab's name, open in the left pane: `Plan` unless the article names its own. */
type FirstTab = { firstTab?: string };

/** Dragging a tab toward the right edge: the drop zone's ghost shows the pane it will open. */
export function SideBySideDrag({ firstTab = 'Plan' }: FirstTab = {}) {
  const ghostX = W * 0.52;
  return (
    <Scene w={W} h={H}>
      <Shape x={40} y={50} w={70} h={34} label="Goals" />
      <Shape x={40} y={112} w={70} h={34} label="Risks" />
      <Arrow connector from={[75, 84]} to={[75, 112]} tone="muted" width={1.5} />
      {/* The ghost of the pane, at the width it will open. */}
      <rect
        x={ghostX}
        y={TOP}
        width={W - ghostX}
        height={H - TOP - FOOTER}
        rx={8}
        className="fill-brand-50 stroke-brand-500"
        strokeWidth={2}
      />
      <Label x={ghostX + 12} y={TOP + 18} size={9} weight={600} tone="accent">
        Open Timeline Side by Side
      </Label>
      <Shape x={ghostX + 30} y={TOP + 50} w={60} h={28} label="Q1" />
      <Shape x={ghostX + 110} y={TOP + 50} w={60} h={28} label="Q2" />
      <rect
        x={ghostX + (W - ghostX) / 2 - 44}
        y={H - FOOTER - 32}
        width={88}
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
          { label: firstTab, x: 10, w: 48, active: true },
          { label: 'Timeline', x: 64, w: 60 },
        ]}
      />
      {/* The tab on its way, under the pointer. */}
      <Arrow
        from={[96, H - FOOTER - 8]}
        to={[ghostX + 96, 140]}
        kind="curved"
        tone="muted"
        dashed
        width={1.5}
      />
      <TopRightCard />
      <Cursor x={ghostX + 100} y={136} />
    </Scene>
  );
}

/** The open split: one tab bar across both panes, Share and the account top right, the editor's chrome in the left
 *  pane (being edited), the other tab live on the right, and the seam's Fit and Close buttons. */
export function SideBySideOpen({ firstTab = 'Plan' }: FirstTab = {}) {
  const seam = W / 2;
  const top = TOP;
  return (
    <Scene w={W} h={H}>
      {/* Left pane: the editor, with its panels. */}
      <ChromeTopRow x={8} y={top + 8} right={seam - 8} />
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
      <Arrow
        connector
        from={[seam + 100, top + 84]}
        to={[seam + 120, top + 84]}
        tone="muted"
        width={1.5}
      />
      {/* The seam: the line, its two buttons, and the resize grip below them. */}
      <line
        x1={seam}
        y1={top}
        x2={seam}
        y2={H - FOOTER}
        className="stroke-slate-300"
        strokeWidth={0.75}
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
      <TopRightCard />
      <Footer
        tabs={[
          { label: firstTab, x: 10, w: 48, active: true },
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
