// What livediagram draws on and over its canvas around a selection (apps/editor/components/canvas and
// chrome/FloatingToolbar.tsx), at the chrome kit's 0.55: the quick-connect + buttons a selected shape grows on its
// four sides, the element toolbar floating above it with its small-caps title chip, and a sticky note as the editor
// places one. Scenes pair these with the shared Shape and SelectionBox.

import {
  lucideCopy,
  lucideCopyPlus,
  lucidePencil,
  lucideEllipsis,
  lucideLockOpen,
  lucideTrash2,
  lucideType,
} from '@liveworkspace/icons/lucide';
import { Label, Lift } from '@liveworkspace/help-site/art/primitives';
import { Card, Icon, type Prim } from './editor-chrome';

const HAIR = 0.75;
const PLUS: readonly Prim[] = [{ t: 'path', d: 'M5 12h14M12 5v14' }];

/** One quick-connect button: a white disc with a hairline and a plus, centred on (x, y). */
export function PlusButton({ x, y, hot = false }: { x: number; y: number; hot?: boolean }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={6}
        className={hot ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={HAIR}
      />
      <Icon
        prims={PLUS}
        x={x}
        y={y}
        size={7}
        className={hot ? 'stroke-brand-700' : 'stroke-slate-600'}
      />
    </g>
  );
}

/** The four quick-connect buttons around a selected box at (x, y, w, h), 13 units out from each side. `hot` lights the
 *  one under the pointer. */
export function PlusHandles({
  x,
  y,
  w,
  h,
  hot,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  hot?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <PlusButton x={cx} y={y - 13} hot={hot === 'top'} />
      <PlusButton x={x + w + 13} y={cy} hot={hot === 'right'} />
      <PlusButton x={cx} y={y + h + 13} hot={hot === 'bottom'} />
      <PlusButton x={x - 13} y={cy} hot={hot === 'left'} />
    </g>
  );
}

// The toolbar's group and ungroup glyphs: two boxes joined, and the same pair pulled apart.
const GROUP: readonly Prim[] = [
  { t: 'rect', x: 3, y: 3, w: 8, h: 8, rx: 2 },
  { t: 'rect', x: 13, y: 13, w: 8, h: 8, rx: 2 },
  { t: 'path', d: 'M11 7h3a3 3 0 0 1 3 3v3' },
];
const UNGROUP: readonly Prim[] = [
  { t: 'rect', x: 3, y: 3, w: 8, h: 8, rx: 2 },
  { t: 'rect', x: 13, y: 13, w: 8, h: 8, rx: 2 },
  { t: 'path', d: 'M7 11v3a3 3 0 0 0 3 3h3' },
];

/** The element toolbar's width. */
export const TOOLBAR_W = 160;

// Each button's glyph and centre from the toolbar's left edge, and the hairlines between its groups.
const BUTTONS: [readonly Prim[], number][] = [
  [lucideEllipsis, 11],
  [lucideType, 35.5],
  [lucideCopyPlus, 60],
  [GROUP, 85],
  [UNGROUP, 105],
  [lucideLockOpen, 129.5],
  [lucideTrash2, 150],
];
const SPLITS = [23, 48, 72.5, 117];

/** The element toolbar floating over a selection, top-left at (x, y), TOOLBAR_W by 21: More, Text, Duplicate, Group
 *  and Ungroup, Lock, Delete. `title` hangs the small-caps chip above it (Selected Square). */
export function ElementToolbar({ x, y, title }: { x: number; y: number; title?: string }) {
  const cy = y + 10.5;
  return (
    <g>
      {title && <TitleChip x={x + TOOLBAR_W / 2} y={y - 15} text={title} />}
      <Lift x={x} y={y} w={TOOLBAR_W} h={21} r={5} />
      <rect
        x={x}
        y={y}
        width={TOOLBAR_W}
        height={21}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      {SPLITS.map((d) => (
        <line
          key={d}
          x1={x + d}
          y1={y + 5}
          x2={x + d}
          y2={y + 16}
          className="stroke-slate-200"
          strokeWidth={HAIR}
        />
      ))}
      {BUTTONS.map(([prims, at]) => (
        <Icon key={at} prims={prims} x={x + at} y={cy} size={8.5} />
      ))}
    </g>
  );
}

/** The small-caps chip naming a selection, centred on x with its top at y. */
export function TitleChip({ x, y, text }: { x: number; y: number; text: string }) {
  const w = Math.round(text.length * 5.4 + 12);
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y}
        width={w}
        height={11}
        rx={2.5}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      <Label x={x} y={y + 6} size={9} weight={500} anchor="middle" tone="muted">
        {text.toUpperCase()}
      </Label>
    </g>
  );
}

/** A sticky note as the editor places one, top-left at (x, y), `s` square: the pale yellow card with its soft drop and
 *  its text (or the faint "Note" placeholder) at the top left. `tone` picks another sticky colour. */
export function Sticky({
  x,
  y,
  s = 60,
  text,
  tone = 'amber',
}: {
  x: number;
  y: number;
  s?: number;
  text?: string | string[];
  tone?: 'amber' | 'rose' | 'emerald' | 'sky' | 'violet';
}) {
  const fill = {
    amber: 'fill-amber-100',
    rose: 'fill-rose-100',
    emerald: 'fill-emerald-100',
    sky: 'fill-sky-100',
    violet: 'fill-violet-100',
  }[tone];
  const lines = text === undefined ? [] : Array.isArray(text) ? text : [text];
  return (
    <g>
      <rect x={x + 0.8} y={y + 2.2} width={s} height={s} className="fill-slate-900/[0.08]" />
      <rect x={x} y={y} width={s} height={s} className={fill} />
      {lines.length === 0 ? (
        <Label x={x + 7} y={y + 12} size={10} className="fill-amber-800/60">
          Note
        </Label>
      ) : (
        lines.map((t, i) => (
          <Label key={i} x={x + 7} y={y + 12 + i * 12} size={10} className="fill-slate-800">
            {t}
          </Label>
        ))
      )}
    </g>
  );
}

const ARROW_RIGHT: readonly Prim[] = [{ t: 'path', d: 'M5 12h14M13 6l6 6-6 6' }];
const QUICK_ADD: readonly [string, readonly Prim[]][] = [
  ['duplicate', lucideCopy],
  ['arrow', ARROW_RIGHT],
  ['pencil', lucidePencil],
  ['text', lucideType],
];

/** The card a quick-connect + opens beside a side edge (canvas/QuickConnectRing.tsx), top-left at (x, y), 24 by 88:
 *  Duplicate, Arrow, Pencil and Text in a column, `active` on its pale brand tile. */
export function QuickAddCard({
  x,
  y,
  active,
}: {
  x: number;
  y: number;
  active?: 'duplicate' | 'arrow' | 'pencil' | 'text';
}) {
  return (
    <Card x={x} y={y} w={24} h={88}>
      {QUICK_ADD.map(([key, prims], i) => {
        const by = y + 3 + i * 21;
        const on = key === active;
        return (
          <g key={key}>
            {on && (
              <rect x={x + 3} y={by} width={18} height={19} rx={4} className="fill-brand-100" />
            )}
            <Icon
              prims={prims}
              x={x + 12}
              y={by + 9.5}
              size={9}
              className={on ? 'stroke-brand-700' : 'stroke-slate-600'}
            />
          </g>
        );
      })}
    </Card>
  );
}
