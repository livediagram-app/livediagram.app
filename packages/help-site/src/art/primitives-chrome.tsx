// The UI chrome primitives of the help illustrations' kit (./primitives): panels, dialogs,
// buttons, tabs, menus and tiles, drawn the way the editor draws them.
import { type ReactNode } from 'react';
import { Label } from './primitives-text';

// --- UI chrome ---------------------------------------------------------------

/** A floating editor panel with a title bar. Children draw inside the body. */
export function Panel({
  x,
  y,
  w,
  h,
  title,
  children,
  accentBar = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  children?: ReactNode;
  accentBar?: boolean;
}) {
  const barH = title ? 22 : 0;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {title && (
        <>
          <path
            d={`M${x} ${y + 10} a10 10 0 0 1 10 -10 H${x + w - 10} a10 10 0 0 1 10 10 V${y + barH} H${x} Z`}
            className={accentBar ? 'fill-brand-500' : 'fill-slate-50'}
          />
          <Label
            x={x + 12}
            y={y + barH / 2 + 1}
            size={10}
            weight={700}
            tone={accentBar ? 'onAccent' : 'muted'}
            className={accentBar ? undefined : 'fill-slate-400'}
          >
            {title}
          </Label>
        </>
      )}
      {children}
    </g>
  );
}

/** A modal dialog: a backing scrim plus a titled white card. */
export function Dialog({
  x,
  y,
  w,
  h,
  title,
  children,
  sceneW = 400,
  sceneH = 240,
  scrim = true,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  children?: ReactNode;
  sceneW?: number;
  sceneH?: number;
  /** The dimmed backdrop behind the dialog. Set false when the scene has no
   *  canvas behind the dialog, so it isn't a flat grey block. */
  scrim?: boolean;
}) {
  return (
    <g>
      {scrim && <rect x={0} y={0} width={sceneW} height={sceneH} className="fill-slate-900/10" />}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {title && (
        <>
          <Label x={x + 16} y={y + 20} size={13} weight={700} tone="strong">
            {title}
          </Label>
          <line
            x1={x}
            y1={y + 36}
            x2={x + w}
            y2={y + 36}
            className="stroke-slate-200"
            strokeWidth={1.5}
          />
        </>
      )}
      {children}
    </g>
  );
}

/** A button. `variant` switches the fill; `icon` draws to the left of text. */
export function Button({
  x,
  y,
  w,
  h = 26,
  label,
  variant = 'default',
  icon,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label?: string;
  variant?: 'default' | 'primary' | 'ghost';
  icon?: ReactNode;
}) {
  const cls = {
    default: 'fill-white stroke-slate-300',
    primary: 'fill-brand-500 stroke-brand-600',
    ghost: 'fill-slate-100 stroke-transparent',
  }[variant];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} className={cls} strokeWidth={1.5} />
      {label && (
        <Label
          x={x + w / 2 + (icon ? 6 : 0)}
          y={y + h / 2 + 1}
          anchor="middle"
          size={11}
          weight={600}
          tone={variant === 'primary' ? 'onAccent' : 'body'}
        >
          {label}
        </Label>
      )}
      {icon && <g transform={`translate(${x + 9} ${y + h / 2})`}>{icon}</g>}
    </g>
  );
}

/** One tab on an editor's bottom bar (the shared TabFrame): the open tab is a white card that
 *  stands on the bar's bottom edge, rounded only at the top, its name in the accent; the others are
 *  bare names. `beside` outlines a tab open in the other pane with a dashed line. The tab occupies
 *  (x, y) to (x + w, y + h) and stands on y + h. `children` draw inside it (presence avatars). */
export function BarTab({
  x,
  y,
  w,
  h,
  label,
  active = false,
  beside = false,
  size = 10,
  anchor = 'middle',
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  active?: boolean;
  beside?: boolean;
  size?: number;
  anchor?: 'start' | 'middle';
  children?: ReactNode;
}) {
  const r = Math.min(5, h / 3);
  const bottom = y + h;
  const card = `M${x} ${bottom} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} H${x + w - r} a${r} ${r} 0 0 1 ${r} ${r} V${bottom}`;
  return (
    <g>
      {active && <path d={`${card} Z`} className="fill-white stroke-slate-300" strokeWidth={1} />}
      {beside && !active && (
        <path
          d={card}
          fill="none"
          className="stroke-brand-400"
          strokeWidth={1.2}
          strokeDasharray="3 2"
        />
      )}
      <Label
        x={anchor === 'middle' ? x + w / 2 : x + 10}
        y={y + h / 2 + 1}
        anchor={anchor}
        size={size}
        weight={active ? 700 : 500}
        tone={active ? 'accent' : 'muted'}
      >
        {label}
      </Label>
      {children}
    </g>
  );
}

/** A segmented control / tab strip. The `active` index is brand-filled. */
export function Tabs({
  x,
  y,
  items,
  active = 0,
  tabW = 56,
  h = 24,
}: {
  x: number;
  y: number;
  items: string[];
  active?: number;
  tabW?: number;
  h?: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={tabW * items.length}
        height={h}
        rx={7}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1.5}
      />
      {items.map((it, i) => {
        const tx = x + i * tabW;
        const on = i === active;
        return (
          <g key={i}>
            {on && (
              <rect
                x={tx + 2}
                y={y + 2}
                width={tabW - 4}
                height={h - 4}
                rx={5}
                className="fill-white stroke-slate-200"
                strokeWidth={1}
              />
            )}
            <Label
              x={tx + tabW / 2}
              y={y + h / 2 + 1}
              anchor="middle"
              size={10}
              weight={on ? 700 : 500}
              tone={on ? 'accent' : 'muted'}
            >
              {it}
            </Label>
          </g>
        );
      })}
    </g>
  );
}

/** A right-click context menu: rows, with one optionally highlighted. */
export function Menu({
  x,
  y,
  w = 130,
  items,
  active = -1,
  rowH = 22,
}: {
  x: number;
  y: number;
  w?: number;
  items: string[];
  active?: number;
  rowH?: number;
}) {
  const h = items.length * rowH + 8;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {items.map((it, i) => {
        const ry = y + 4 + i * rowH;
        const on = i === active;
        return (
          <g key={i}>
            {on && (
              <rect x={x + 4} y={ry} width={w - 8} height={rowH} rx={5} className="fill-brand-50" />
            )}
            <Label
              x={x + 12}
              y={ry + rowH / 2 + 1}
              size={11}
              tone={on ? 'accent' : 'body'}
              weight={on ? 600 : 400}
            >
              {it}
            </Label>
          </g>
        );
      })}
    </g>
  );
}

/** A small square tool/icon tile (palette tile, toolbar button). */
export function Tile({
  x,
  y,
  size = 26,
  active = false,
  children,
  label,
}: {
  x: number;
  y: number;
  size?: number;
  active?: boolean;
  children?: ReactNode;
  label?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={6}
        className={active ? 'fill-brand-500 stroke-brand-600' : 'fill-slate-50 stroke-slate-200'}
        strokeWidth={1.5}
      />
      {children && <g transform={`translate(${x + size / 2} ${y + size / 2})`}>{children}</g>}
      {label && (
        <Label x={x + size / 2} y={y + size + 8} anchor="middle" size={8} tone="muted">
          {label}
        </Label>
      )}
    </g>
  );
}
