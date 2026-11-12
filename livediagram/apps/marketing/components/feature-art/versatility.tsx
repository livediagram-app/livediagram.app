// Feature illustrations for the breadth of the canvas: notes, borders and arrows here; shape
// recognition, alignment guides and backdrops in ./versatility-drawing; the shape library in
// ./versatility-shapes; rotation and sizing, Zen mode and fonts in ./versatility-more; and Markdown
// and Mermaid in ./diagram-text, all re-exported here. Each is a small
// mock of the editor surface its card describes, drawn on the full-width 300 by 96 card stage from
// the parts in ./versatility-parts with a light and a dark half, and moving with the shared fa-*
// loops plus the fa-c-* ones (app/feature-art/versatility.css), which settle to the finished frame
// under reduced motion.

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  ArrowHead,
  HAIRLINE,
  LINK,
  MUTED_TEXT,
  Node,
  PANEL,
  Pointer,
  SELECT,
  Selection,
  STAGE,
  TONE_SHAPE,
  TONE_TEXT,
  delay,
} from '@liveworkspace/marketing-site/components/feature-art/versatility-parts';

export { ShapesArt } from './versatility-shapes';
export { FontsArt, RotateArt, ZenModeArt } from './versatility-more';
export { MarkdownImportArt, MermaidArt } from './diagram-text';
export { AlignmentGuidesArt, CanvasBackdropArt, PencilArt } from './versatility-drawing';

/* ──────────────── Shapes, notes, borders, arrows ──────────────── */

// Per-element notes: a note's badge on the corner of a shape, its ring pulsing, and the note it
// opens: who wrote it and what it says, out of the way of the diagram.
export function NotesArt() {
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <defs>
          <ArrowHead id="fac-notes-head" />
        </defs>
        <Node x={10} y={18} w={58} h={22} label="Checkout" tone="sky" />
        <path className={LINK} d="M39 40 V58" strokeWidth="1.3" markerEnd="url(#fac-notes-head)" />
        <Node x={20} y={60} w={86} h={26} label="Payment API" tone="violet" />
        <Selection x={20} y={60} w={86} h={26} />
        {/* The note's badge, top right of the shape. */}
        <circle className="fa-pulse fill-amber-400/40" cx="106" cy="60" r="8" />
        <circle
          className="fill-amber-400 stroke-white dark:stroke-slate-900"
          cx="106"
          cy="60"
          r="5.5"
          strokeWidth="1.2"
        />
        <path
          d="M103.7 58 H108.3 M103.7 60 H108.3 M103.7 62 H106.5"
          stroke="#fff"
          strokeWidth="0.9"
          strokeLinecap="round"
        />

        {/* The note it opens. */}
        <g className="fa-fade">
          <path
            className="fill-amber-50 stroke-amber-300 dark:fill-amber-950 dark:stroke-amber-500/50"
            d="M134 10 h146 a6 6 0 0 1 6 6 v58 a6 6 0 0 1-6 6 h-146 a6 6 0 0 1-6-6 v-8 l-8-6 8-6 v-38 a6 6 0 0 1 6-6 z"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <circle className="fill-pink-500" cx="142" cy="22" r="4.6" />
          <text x="142" y="24" fontSize="4.4" fontWeight="700" fill="#fff" textAnchor="middle">
            JR
          </text>
          <text
            className="fill-amber-900 dark:fill-amber-100"
            x="150.5"
            y="24.3"
            fontSize="7"
            fontWeight="700"
          >
            Jo Reyes
          </text>
          <text
            className="fill-amber-700/80 dark:fill-amber-300/70"
            x="278"
            y="24.3"
            fontSize="6"
            textAnchor="end"
          >
            Note · 2m ago
          </text>
          <path
            className="stroke-amber-200 dark:stroke-amber-500/30"
            d="M136 31 H280"
            strokeWidth="0.8"
          />
          <text className="fill-amber-900 dark:fill-amber-50" fontSize="7">
            <tspan x="137" y="43">
              Retries three times, then pages
            </tspan>
            <tspan x="137" y="53">
              the on-call. Keep the timeout at 30s.
            </tspan>
          </text>
          <rect
            className="fill-amber-200/70 dark:fill-amber-500/20"
            x="136"
            y="61"
            width="42"
            height="11"
            rx="5.5"
          />
          <text
            className="fill-amber-800 dark:fill-amber-200"
            x="157"
            y="68.6"
            fontSize="6.2"
            fontWeight="700"
            textAnchor="middle"
          >
            #payments
          </text>
        </g>
      </svg>
    </Frame>
  );
}

// Border styling: the Quick Style strip's border row (solid, dashed, dotted), the chosen option
// lighting in turn, and the selected shape below wearing each: a heavier line and rounder corners
// as it goes.
export function BorderStyleArt() {
  const styles = [
    { dash: undefined as string | undefined, rx: 4, w: 1.6, mini: undefined as string | undefined },
    { dash: '5 3.5', rx: 11, w: 2.2, mini: '3 2' },
    { dash: '0.1 4.4', rx: 20, w: 2.8, mini: '0.1 2.6' },
  ];
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        {/* The strip: three border styles, three weights, the corner radius. */}
        <rect className={PANEL} x="10" y="18" width="84" height="60" rx="6" strokeWidth="1" />
        <text
          className={MUTED_TEXT}
          x="17"
          y="29"
          fontSize="5.8"
          fontWeight="700"
          letterSpacing="0.3"
        >
          BORDER
        </text>
        {styles.map((s, i) => (
          <g key={i}>
            <rect
              className={`fa-c-third ${i === 0 ? 'fa-c-first ' : ''}fill-sky-500/15 stroke-sky-500 dark:stroke-sky-400`}
              style={delay(i * 2)}
              x={16 + i * 24}
              y="34"
              width="21"
              height="14"
              rx="3"
              strokeWidth="0.9"
            />
            <path
              className="stroke-slate-600 dark:stroke-slate-300"
              d={`M${20.5 + i * 24} 41 H${32.5 + i * 24}`}
              strokeWidth="1.6"
              strokeDasharray={s.mini}
              strokeLinecap="round"
            />
          </g>
        ))}
        <path className={HAIRLINE} d="M16 54 H88" strokeWidth="0.8" />
        {[1, 2, 3].map((w, i) => (
          <rect
            key={w}
            className="fill-slate-500 dark:fill-slate-300"
            x={19 + i * 24}
            y={65 - w / 2}
            width="15"
            height={w}
            rx={w / 2}
          />
        ))}

        {/* The selected shapes, wearing each style in step with the strip. */}
        {styles.map((s, i) => (
          <g key={i} className={`fa-c-third ${i === 0 ? 'fa-c-first' : ''}`} style={delay(i * 2)}>
            <rect
              className={TONE_SHAPE.violet}
              x="124"
              y="22"
              width="76"
              height="52"
              rx={s.rx}
              strokeWidth={s.w}
              strokeDasharray={s.dash}
              strokeLinecap="round"
            />
            <text
              className={TONE_TEXT.violet}
              x="162"
              y="50.5"
              fontSize="8"
              fontWeight="700"
              textAnchor="middle"
            >
              Review
            </text>
            <rect
              className={TONE_SHAPE.emerald}
              x="214"
              y="22"
              width="76"
              height="52"
              rx={s.rx}
              strokeWidth={s.w}
              strokeDasharray={s.dash}
              strokeLinecap="round"
            />
            <text
              className={TONE_TEXT.emerald}
              x="252"
              y="50.5"
              fontSize="8"
              fontWeight="700"
              textAnchor="middle"
            >
              Approve
            </text>
          </g>
        ))}
        <Selection x={124} y={22} w={166} h={52} pad={4} />
      </svg>
    </Frame>
  );
}

// Arrows: a curved arrow and an elbow arrow from one box to two others, with the handle that
// bends each. A teammate drags the curve's handle and the bow follows; the elbow wears the hollow
// UML head; both carry a label.
export function ArrowsArt() {
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <defs>
          <ArrowHead id="fac-arrows-solid" />
          <ArrowHead id="fac-arrows-hollow" hollow />
        </defs>
        <Node x={10} y={37} w={56} h={24} label="Client" tone="sky" />
        <Node x={228} y={8} w={62} h={24} label="Orders API" tone="violet" />
        <Node x={228} y={64} w={62} h={24} label="Cache" tone="emerald" />

        {/* The curve, before and after the drag, its handle at the bow. */}
        {[
          { c: 2, cls: 'fa-c-before', hy: 14.5 },
          { c: 34, cls: 'fa-c-after', hy: 30.5 },
        ].map(({ c, cls, hy }) => (
          <g key={c} className={cls}>
            <path
              className={LINK}
              d={`M66 44 Q 147 ${c} 227 20`}
              fill="none"
              strokeWidth="1.6"
              markerEnd="url(#fac-arrows-solid)"
            />
            <circle className="fa-pulse fill-sky-400/25" cx="146.5" cy={hy} r="6.5" />
            <circle
              className={`fill-white dark:fill-slate-900 ${SELECT}`}
              cx="146.5"
              cy={hy}
              r="3.2"
              strokeWidth="1.4"
            />
            <Pointer x={148.5} y={hy + 2} name="JR" />
          </g>
        ))}
        <rect className="fill-(--art-paper)" x="96" y="21" width="22" height="9" rx="2" />
        <text
          className={MUTED_TEXT}
          x="107"
          y="27.6"
          fontSize="6.2"
          fontWeight="600"
          textAnchor="middle"
        >
          calls
        </text>

        {/* The elbow, its bend handle mid-way down, a hollow head at the end. */}
        <path
          className={LINK}
          d="M66 54 H150 V76 H227"
          fill="none"
          strokeWidth="1.6"
          strokeLinejoin="round"
          markerEnd="url(#fac-arrows-hollow)"
        />
        <rect
          className={`fill-white dark:fill-slate-900 ${SELECT}`}
          x="147.5"
          y="62.5"
          width="5"
          height="5"
          rx="1"
          strokeWidth="1.3"
        />
        <rect className="fill-(--art-paper)" x="174" y="71.5" width="26" height="9" rx="2" />
        <text
          className={MUTED_TEXT}
          x="187"
          y="78.1"
          fontSize="6.2"
          fontWeight="600"
          textAnchor="middle"
        >
          reads
        </text>
      </svg>
    </Frame>
  );
}
