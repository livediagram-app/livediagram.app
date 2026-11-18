// Illustrations for the Element Indicators article (docs/specs/008-canvas/element-indicators.md), drawn for
// livedocuments, where element links and notes are retired (docs/specs/009-elements/links-and-notes-retired.md): an
// element shows only its open action and its unresolved comments. Glyphs come from the shared kit
// (@liveworkspace/help-site/art/illustrations/element-indicators), lifted from apps/editor's
// components/canvas/ElementIndicators.tsx and @liveworkspace/workbench/components/canvas/indicator-items.ts.

import { Label, Scene, Shape } from '@liveworkspace/help-site/art/primitives';
import { Glyph } from '@liveworkspace/help-site/art/illustrations/element-indicators';

/** The comment glyph with its count beside it, at half strength as the editor draws it at rest. */
function CommentCount({ cx, cy, count }: { cx: number; cy: number; count: number }) {
  return (
    <g>
      <Glyph kind="comment" cx={cx} cy={cy} />
      <g opacity={0.5}>
        <Label x={cx + 8} y={cy + 0.5} size={10} weight={700} tone="strong">
          {count}
        </Label>
      </g>
    </g>
  );
}

/** One element with an open action and two comments, drawn in each of Top, Footer and Off. */
export function DocumentIndicatorStylesScene() {
  const y = 44;
  const w = 124;
  const h = 84;
  const cols = [
    { x: 14, title: 'Top', hint: 'Icons near the top' },
    { x: 148, title: 'Footer', hint: 'A row along the bottom' },
    { x: 282, title: 'Off', hint: 'Nothing drawn' },
  ];
  return (
    <Scene w={420} h={190}>
      {cols.map((c, i) => (
        <g key={c.title}>
          <Shape x={c.x} y={y} w={w} h={h} />
          <Label
            x={c.x + w / 2}
            y={i === 1 ? y + 36 : y + h / 2 + (i === 0 ? 6 : 1)}
            anchor="middle"
            size={12}
            weight={500}
            tone="strong"
          >
            Checkout
          </Label>
          <Label
            x={c.x + w / 2}
            y={y + h + 22}
            anchor="middle"
            size={12}
            weight={700}
            tone="strong"
          >
            {c.title}
          </Label>
          <Label x={c.x + w / 2} y={y + h + 38} anchor="middle" size={10} tone="muted">
            {c.hint}
          </Label>
        </g>
      ))}
      {/* Top: the action, then the comments with their count, along the top-right. */}
      <Glyph kind="action" cx={14 + 78} cy={y + 15} />
      <CommentCount cx={14 + 96} cy={y + 15} count={2} />
      {/* Footer: the assignee's initials disc and "Action", then the comment count. */}
      <circle cx={164} cy={y + h - 14} r={8} className="fill-brand-500" />
      <Label x={164} y={y + h - 13.5} anchor="middle" size={9} weight={700} tone="onAccent">
        SK
      </Label>
      <g opacity={0.5}>
        <Label x={176} y={y + h - 13.5} size={10} weight={500} tone="strong">
          Action
        </Label>
      </g>
      <CommentCount cx={226} cy={y + h - 14} count={2} />
    </Scene>
  );
}

/** Top on a box (top-right), on a round shape (centred along the top), and the chip on the edge of a pill too
 *  small for either. */
export function DocumentIndicatorPlacementScene() {
  // The pill: 45 degrees in from its top-right corner meets the outline here.
  const pill = { x: 292, y: 82, w: 100, h: 28 };
  const r = pill.h / 2;
  const pipX = pill.x + pill.w - r * (1 - Math.SQRT1_2);
  const pipY = pill.y + r * (1 - Math.SQRT1_2);
  return (
    <Scene w={420} h={190}>
      {/* A box: top-right */}
      <Shape x={18} y={50} w={116} h={72} />
      <Label x={76} y={92} anchor="middle" size={12} weight={500} tone="strong">
        Orders
      </Label>
      <Glyph kind="action" cx={96} cy={64} />
      <CommentCount cx={112} cy={64} count={1} />
      {/* A round shape: centred along the top */}
      <Shape x={158} y={42} w={112} h={88} kind="circle" />
      <Label x={214} y={94} anchor="middle" size={12} weight={500} tone="strong">
        Billing
      </Label>
      <CommentCount cx={210} cy={62} count={3} />
      {/* Too small: the chip, centred on the outline */}
      <Shape x={pill.x} y={pill.y} w={pill.w} h={pill.h} kind="stadium" />
      <Label
        x={pill.x + 42}
        y={pill.y + r + 1}
        anchor="middle"
        size={11}
        weight={500}
        tone="strong"
      >
        Done
      </Label>
      <rect
        x={pipX - 22}
        y={pipY - 10}
        width={44}
        height={20}
        rx={10}
        className="fill-white stroke-slate-300"
        strokeWidth={1}
      />
      <Glyph kind="action" cx={pipX - 11} cy={pipY} scale={0.8} />
      <Glyph kind="comment" cx={pipX + 3} cy={pipY} scale={0.8} />
      <g opacity={0.5}>
        <Label x={pipX + 10} y={pipY + 0.5} size={10} weight={700} tone="strong">
          3
        </Label>
      </g>
      <Label x={76} y={152} anchor="middle" size={10.5} tone="muted">
        Box: top-right
      </Label>
      <Label x={214} y={152} anchor="middle" size={10.5} tone="muted">
        Round: centred
      </Label>
      <Label x={342} y={152} anchor="middle" size={10.5} tone="muted">
        Too small: a chip
      </Label>
    </Scene>
  );
}
