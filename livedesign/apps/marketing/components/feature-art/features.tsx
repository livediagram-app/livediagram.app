// Feature illustrations for the editor's own surfaces: the tab bar, copying a tab, undo, locking,
// shift-drag and layers (images, keyboard shortcuts and the session tools are in ./features-more). Each is a small,
// faithful mock of what the editor draws, on the Default scheme's canvas (--art-*) with panel
// chrome that has a light and a dark half, moving on a shared 6s loop (fa-b-* in
// app/feature-art/features.css). Under reduced motion every scene shows its finished state.
//
// Split from FeatureArt.tsx; see ./shared for Frame and the colour constants, ./features-parts
// for the pointer, window, node, arrow and key cap the scenes are drawn from.

import { UndoCluster, Node, Pointer, to, VIEW } from './features-parts';
import { Frame, PINK, SKY } from '@liveworkspace/marketing-site/components/feature-art/shared';

/** Undo that is yours alone: your move steps back, a teammate's edit beside it stays. */
export function UndoRedoArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* A teammate's node, edited by them, untouched by your undo. */}
        <g>
          <rect
            className="fill-pink-50 stroke-pink-400 dark:fill-pink-500/15 dark:stroke-pink-400"
            x="34"
            y="52"
            width="58"
            height="22"
            rx="4"
            strokeWidth="1.6"
          />
          <text
            className="fill-pink-700 dark:fill-pink-200"
            x="63"
            y="65.3"
            textAnchor="middle"
            fontSize="6.5"
            fontWeight="600"
          >
            Pricing
          </text>
          <g transform="translate(86 68)">
            <Pointer color={PINK} name="JR" />
          </g>
        </g>

        {/* Your node: dragged across, then undone back to where it was. */}
        <path
          className="stroke-(--art-ink-stroke)"
          d="M60 14 h50 a4 4 0 0 1 4 4 v14 a4 4 0 0 1 -4 4 h-50 a4 4 0 0 1 -4 -4 v-14 a4 4 0 0 1 4 -4 z"
          fill="none"
          strokeWidth="1"
          strokeDasharray="2.5 2.5"
          strokeOpacity="0.5"
        />
        <g className="fa-b-drag" style={to(92, 6)}>
          <Node x={56} y={14} w={58} h={22} label="Checkout" />
        </g>

        <UndoCluster x={242} y={62} />
        <g className="fa-b-undo" style={to(92, 6, { '--ux': '156px', '--uy': '40px' })}>
          <g transform="translate(96 30)">
            <Pointer color={SKY} name="You" />
          </g>
        </g>
        <g className="fa-b-tip">
          <rect
            className="fill-slate-800 dark:fill-slate-100"
            x="212"
            y="46"
            width="50"
            height="11"
            rx="3"
          />
          <text
            className="fill-white dark:fill-slate-900"
            x="237"
            y="53.4"
            textAnchor="middle"
            fontSize="5.5"
            fontWeight="600"
          >
            Undo ⌘Z
          </text>
        </g>
      </svg>
    </Frame>
  );
}
