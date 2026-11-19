// The editing surfaces behind the Tools-family elements: the Portal section of an element's menu
// (docs/specs/008-canvas/canvas-and-palette.md). Every label is the editor's own string. Composed from the
// shared primitives; raw shapes only for motifs the kit lacks.

import { Scene, Panel, Label, Arrow } from '@liveworkspace/help-site/art/primitives';

// --- Building blocks ---------------------------------------------------------

/** A small rounded text field with its typed value. */
function Field({ x, y, w, value }: { x: number; y: number; w: number; value: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={x + 7} y={y + 11} size={10} tone="body">
        {value}
      </Label>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** A tall portal ring in the given hue: an outer bloom, a bright rim and a
 *  dark mouth. Dimmed when it leads nowhere. */
function PortalRing({
  cx,
  cy,
  hue,
  dim = false,
}: {
  cx: number;
  cy: number;
  hue: 'brand' | 'amber';
  dim?: boolean;
}) {
  const rim = hue === 'brand' ? 'stroke-brand-400' : 'stroke-amber-400';
  const bloom = hue === 'brand' ? 'fill-brand-100' : 'fill-amber-100';
  return (
    <g opacity={dim ? 0.45 : 1}>
      <ellipse cx={cx} cy={cy} rx={30} ry={46} className={bloom} />
      <ellipse cx={cx} cy={cy} rx={22} ry={38} className="fill-slate-700" />
      <ellipse cx={cx} cy={cy} rx={22} ry={38} fill="none" className={rim} strokeWidth={4} />
    </g>
  );
}

/** Two linked portals on the canvas, and the Portal section of the menu:
 *  Name, the Leads to grid (with a portal on another tab), and Create Portal. */
export function PortalMenu() {
  const tiles = ['Portal 2', 'Portal 3 · Detail', 'Create Portal'];
  return (
    <Scene w={420} h={236}>
      <PortalRing cx={56} cy={84} hue="brand" />
      <PortalRing cx={56} cy={186} hue="amber" />
      <Arrow from={[92, 104]} to={[92, 168]} kind="straight" tone="muted" dashed />
      <Panel x={140} y={20} w={260} h={196}>
        <Label x={156} y={38} size={11} weight={700} tone="strong">
          Portal
        </Label>
        <line x1={140} y1={52} x2={400} y2={52} className="stroke-slate-200" strokeWidth={1.2} />
        <Label x={156} y={66} size={10} tone="muted">
          Name
        </Label>
        <Field x={156} y={76} w={228} value="Back to overview" />
        <Label x={156} y={112} size={10} tone="muted">
          Leads to
        </Label>
        {tiles.map((t, i) => {
          const tx = 156 + (i % 2) * 116;
          const ty = 124 + Math.floor(i / 2) * 42;
          const on = i === 0;
          return (
            <g key={t}>
              <rect
                x={tx}
                y={ty}
                width={110}
                height={36}
                rx={7}
                className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
                strokeWidth={1.4}
              />
              <Label
                x={tx + 55}
                y={ty + 19}
                anchor="middle"
                size={10}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {t === 'Create Portal' ? `+ ${t}` : t}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}
