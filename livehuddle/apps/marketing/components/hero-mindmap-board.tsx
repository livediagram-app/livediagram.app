import type { CSSProperties } from 'react';
import {
  lucideCalendar,
  lucideGlobe,
  lucideMessagesSquare,
  lucidePackage,
} from '@liveworkspace/icons/lucide';
import { Glyph, Prims } from '@livediagram/ui';
import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';
import { cursorRide } from '@/lib/hero-motion';
import {
  LEAF_H,
  NODE_GLYPH,
  NODE_H,
  TALL_LAYOUT,
  WIDE_LAYOUT,
  type Box,
  type Branch,
  type PlacedBranch,
  type PlacedLeaf,
} from './hero-mindmap-layout';

// The hero's Mind Map window (docs/specs/019-marketing/marketing-site.md "Hero"): a launch plan
// grown from the centre in Diagram mode's mind map (docs/specs/009-elements/mind-node.md), drawn
// as the editor's Mind map template draws one. The round centre topic lands with its date, four
// branches grow out on tapered curves to their nodes (each tinted in its colour with its glyph:
// Marketing, Product, Support, Events), and ideas sprout from each in small outlined boxes. You
// fill Marketing as the keyboard does it, the selection hopping on with Tab and then Enter; a
// teammate fills Events at the same time, their own selection in their colour; a rocket sticker
// lands on the centre, and the editor's hint sits under the map. Each piece arrives at its own --d
// delay (hero-mode-animations.css, hero-scenes/mindmap.css); the geometry is
// hero-mindmap-layout.ts.

const GLYPHS: Record<Branch['key'], Parameters<typeof Prims>[0]['prims']> = {
  marketing: lucideGlobe,
  product: lucidePackage,
  support: lucideMessagesSquare,
  events: lucideCalendar,
};

// A branch's colours as custom properties, so one set of classes paints it in light and dark.
function tone(b: Branch): CSSProperties {
  const t = b.tone;
  return {
    '--mm-c': t.stroke,
    '--mm-cd': t.strokeDark,
    '--mm-t': t.tint,
    '--mm-td': t.tintDark,
    '--mm-k': t.ink,
    '--mm-kd': t.inkDark,
  } as CSSProperties;
}

const STROKE = 'stroke-(--mm-c) dark:stroke-(--mm-cd)';
const FILL = 'fill-(--mm-c) dark:fill-(--mm-cd)';

// Who is filling which branch: the keyboard's selection is yours, Events is the teammate's.
const teammateFills = (b: PlacedBranch) => b.key === 'events';

// A selection outline round a box, shown for `dur` seconds from `d` in its owner's colour.
function Selection({ box, d, dur, colour }: { box: Box; d: number; dur: number; colour: string }) {
  return (
    <rect
      className="mm-sel"
      style={at(d, { '--dur': `${dur}s` })}
      x={box.x - 3.5}
      y={box.y - 3.5}
      width={box.w + 7}
      height={box.h + 7}
      rx="7"
      fill="none"
      stroke={colour}
      strokeWidth="1.5"
    />
  );
}

// The key that made the next idea, shown for a moment beside the box it was pressed on.
function KeyCap({ x, y, d, label }: { x: number; y: number; d: number; label: string }) {
  const w = label.length * 5.4 + 12;
  return (
    <g className="mm-sel" style={at(d, { '--dur': '0.55s' })}>
      <rect
        x={x - w / 2}
        y={y - 8}
        width={w}
        height="16"
        rx="4"
        className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
        strokeWidth="1"
      />
      <rect
        x={x - w / 2}
        y={y + 6}
        width={w}
        height="2"
        rx="1"
        className="fill-slate-300 dark:fill-slate-600"
      />
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="8.5"
        fontWeight="600"
        className="fill-slate-600 dark:fill-slate-300"
      >
        {label}
      </text>
    </g>
  );
}

function LeafNode({ leaf }: { leaf: PlacedLeaf }) {
  const { box } = leaf;
  return (
    <g>
      <path
        className={`hm-draw ${STROKE}`}
        style={at(leaf.d - 0.15, { '--dur': '0.35s', '--len': leaf.linkLen })}
        d={leaf.link}
        fill="none"
        strokeWidth="1.5"
        strokeOpacity="0.6"
        strokeLinecap="round"
      />
      <g className="hm-pop" style={at(leaf.d)}>
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx="4"
          className={`fill-white dark:fill-(--art-ink-fill) ${STROKE}`}
          strokeWidth="1.25"
        />
      </g>
      <text
        className="hm-type fill-(--art-text)"
        style={at(leaf.d + 0.12, { '--steps': leaf.text.length })}
        x={box.x + box.w / 2}
        y={box.y + LEAF_H / 2 + 3.5}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="10"
        fontWeight="500"
      >
        {leaf.text}
      </text>
    </g>
  );
}

function BranchNode({ b }: { b: PlacedBranch }) {
  const { node } = b;
  const textW = node.w - NODE_GLYPH - 5 - 30;
  const left = node.x + (node.w - (NODE_GLYPH + 5 + textW)) / 2;
  return (
    <>
      <g className="hm-pop" style={at(b.d)}>
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={NODE_H}
          rx="7"
          className={`fill-(--mm-t) dark:fill-(--mm-td) ${STROKE}`}
          strokeWidth="2"
        />
        <Glyph
          x={left}
          y={node.y + (NODE_H - NODE_GLYPH) / 2}
          size={NODE_GLYPH}
          units={24}
          weight={1.6}
          className="text-(--mm-k) dark:text-(--mm-kd)"
        >
          <Prims prims={GLYPHS[b.key]} />
        </Glyph>
      </g>
      <text
        className="hm-type fill-(--mm-k) dark:fill-(--mm-kd)"
        style={at(b.d + 0.1, { '--steps': b.label.length })}
        x={left + NODE_GLYPH + 5}
        y={node.y + NODE_H / 2 + 4.3}
        fontFamily={FONT}
        fontSize="12"
        fontWeight="700"
      >
        {b.label}
      </text>
    </>
  );
}

// The keyboard's path through a branch: the selection on the node, Tab adds the first idea, and
// Enter each one after; the selection follows each new idea until the next is made.
function Keyboard({ b, colour, keys }: { b: PlacedBranch; colour: string; keys: boolean }) {
  const first = b.leaves[0]!;
  const capX = (box: Box) => (b.side === 'left' ? box.x + box.w + 18 : box.x - 18);
  return (
    <>
      <Selection box={b.node} d={first.d - 0.55} dur={0.6} colour={colour} />
      {keys ? <KeyCap x={capX(b.node)} y={b.node.y - 12} d={first.d - 0.35} label="Tab" /> : null}
      {b.leaves.map((leaf, i) => {
        const next = b.leaves[i + 1];
        const dur = next ? next.d - leaf.d : 1.1;
        return (
          <g key={leaf.text}>
            <Selection box={leaf.box} d={leaf.d + 0.05} dur={dur} colour={colour} />
            {keys && next ? (
              <KeyCap
                x={b.side === 'left' ? leaf.box.x - 22 : leaf.box.x + leaf.box.w + 22}
                y={leaf.box.y + LEAF_H / 2}
                d={next.d - 0.35}
                label="Enter"
              />
            ) : null}
          </g>
        );
      })}
    </>
  );
}

export function MindMapBoard({ portrait = false }: { portrait?: boolean }) {
  const L = portrait ? TALL_LAYOUT : WIDE_LAYOUT;
  const { centre: c } = L;
  return (
    <>
      {/* The trunks, tapering from the centre out to each branch: a line draws on, then the taper
          fills in under it. */}
      {L.branches.map((b) => (
        <g key={b.key} style={tone(b)}>
          <path className={`hm-fade ${FILL}`} style={at(b.d - 0.05)} d={b.trunk.fill} />
          <path
            className={`hm-draw ${STROKE}`}
            style={at(b.d - 0.3, { '--dur': '0.4s', '--len': b.trunk.len })}
            d={b.trunk.centre}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* The centre topic: a round node in the theme's ink, its name and its date. */}
      <g className="hm-pop" style={at(0.2)}>
        <circle
          cx={c.x}
          cy={c.y}
          r={c.r}
          className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
          strokeWidth="2"
        />
      </g>
      <text
        className="hm-type fill-(--art-ink-text)"
        style={at(0.4, { '--steps': 11 })}
        x={c.x}
        y={c.y + 1}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={portrait ? 14 : 17}
        fontWeight="700"
      >
        Launch plan
      </text>
      <text
        className="hm-fade fill-(--art-ink-text)"
        style={at(0.8)}
        x={c.x}
        y={c.y + (portrait ? 15 : 18)}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={portrait ? 8 : 9}
        fontWeight="500"
        opacity="0.8"
      >
        v2.0 · ships 14 May
      </text>

      {/* The branches, their ideas, and who is adding them. */}
      {L.branches.map((b) => (
        <g key={b.key} style={tone(b)}>
          <BranchNode b={b} />
          {b.leaves.map((leaf) => (
            <LeafNode key={leaf.text} leaf={leaf} />
          ))}
          {b.key === 'marketing' ? <Keyboard b={b} colour={YOU} keys /> : null}
          {teammateFills(b) ? <Keyboard b={b} colour={TEAMMATE} keys={false} /> : null}
        </g>
      ))}

      {/* A rocket sticker on the centre, for the launch: the editor's sticker look (a die-cut white
          plate on a soft shadow, @liveworkspace/icons sticker-markup.ts). An emoji's ink is the
          platform's emoji font's, so it is left out of the optical audit
          (docs/specs/004-interface-design/blueprints/DEFAULTS.md D45). */}
      <g transform={`translate(${c.x + 6} ${c.y - c.r - 8}) rotate(8)`} data-optical-ignore="">
        <g className="hm-pop" style={at(8.6)}>
          <rect x="-15" y="-12" width="30" height="30" rx="9" fill="#0f172a" opacity="0.14" />
          <rect x="-15" y="-15" width="30" height="30" rx="9" fill="#ffffff" stroke="#e2e8f0" />
          <text x="0" y="5.5" textAnchor="middle" fontSize="17">
            🚀
          </text>
        </g>
      </g>

      {/* The editor's hint under a mind map. */}
      <text
        className="hm-fade fill-slate-500 dark:fill-slate-400"
        style={at(1.6)}
        x={L.hint.x}
        y={L.hint.y}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={portrait ? 7.5 : 8.5}
      >
        {portrait
          ? 'Select an idea: Tab adds a child, Enter a sibling.'
          : 'Select any idea, then press Tab to add a child or Enter to add a sibling.'}
      </text>

      {/* The teammate, filling in Events. */}
      <g className="mm-jr" style={cursorRide(L.teammate)} aria-hidden>
        <CursorMark colour={TEAMMATE} label="JR" />
      </g>
    </>
  );
}
