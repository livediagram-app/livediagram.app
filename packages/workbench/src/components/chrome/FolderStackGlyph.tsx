'use client';

import { useEffect, useId, useRef } from 'react';
import { lucideFolder } from '@liveworkspace/icons/lucide';

// A tab folder's glyph (docs/specs/006-document/tab-folders.md "Tab bar rendering"): the folder stacks to say how many
// tabs it holds, in place of a count badge. One tab draws one folder, two draw two, three or more draw three, each
// one behind stepping up and to the right and a little fainter. A layer behind is cut away where the ones in front
// sit, with a hairline gap, so the stack reads on any shelf tint in either appearance with no fill to match. A layer
// that joins slides out from behind the front folder (at once under reduced motion).

// Most layers drawn: three or more tabs all read as "several".
export const FOLDER_STACK_MAX = 3;

// How many layers a folder of `count` tabs draws.
export function folderStackLayers(count: number): number {
  return Math.max(1, Math.min(FOLDER_STACK_MAX, Math.floor(count)));
}

// Viewbox units (the lucide folder is drawn on 24) each layer behind steps up and to the right.
const STEP = 3.5;
// Opacity of each layer, front to back: the front folder is the chip's full ink.
const BACK_OPACITY = [1, 0.6, 0.35];
// The gap cut round a layer in front: half the stroke plus a hairline each side.
const CUT_WIDTH = 5;
const FOLDER_D = (lucideFolder[0] as { d: string }).d;
const JOIN_MS = 220;

export function FolderStackGlyph({ count, size = 14 }: { count: number; size?: number }) {
  const layers = folderStackLayers(count);
  const id = useId().replace(/:/g, '');
  const span = (layers - 1) * STEP;
  const box = 24 + span;
  const px = (size * box) / 24;

  // A layer that joins after the first paint slides out from behind the front folder.
  const drawn = useRef(layers);
  const groups = useRef<(SVGGElement | null)[]>([]);
  useEffect(() => {
    const before = drawn.current;
    drawn.current = layers;
    if (layers <= before) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    for (let k = before; k < layers; k += 1) {
      const el = groups.current[k];
      if (!el || typeof el.animate !== 'function') continue;
      el.animate(
        [
          { transform: `translate(${-k * STEP}px, ${k * STEP}px)`, opacity: 0 },
          { transform: 'translate(0, 0)', opacity: 1 },
        ],
        { duration: JOIN_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }
  }, [layers]);

  // Back to front, so the front folder paints last. Layer k sits k steps up and right of the front one.
  const order = Array.from({ length: layers }, (_, i) => layers - 1 - i);
  return (
    <svg
      aria-hidden
      data-folder-stack={layers}
      width={px}
      height={px}
      viewBox={`0 ${-span} ${box} ${box}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // The layers behind rise above the line: the front folder sits where a single one does, so the chip's glyph and
      // name never shift as a folder fills.
      style={layers > 1 ? { marginTop: size - px } : undefined}
      className="shrink-0 overflow-visible"
    >
      {layers > 1 ? (
        <defs>
          {order
            .filter((k) => k > 0)
            .map((k) => (
              // Everything in front of layer k is cut out of it.
              <mask
                key={k}
                id={`${id}-cut-${k}`}
                maskUnits="userSpaceOnUse"
                x={-4}
                y={-span - 4}
                width={box + 8}
                height={box + 8}
              >
                <rect x={-4} y={-span - 4} width={box + 8} height={box + 8} fill="white" />
                {Array.from({ length: k }, (_, j) => (
                  <path
                    key={j}
                    d={FOLDER_D}
                    transform={`translate(${j * STEP} ${-j * STEP})`}
                    fill="black"
                    stroke="black"
                    strokeWidth={CUT_WIDTH}
                  />
                ))}
              </mask>
            ))}
        </defs>
      ) : null}
      {order.map((k) => (
        <g
          key={k}
          data-folder-layer={k}
          mask={k > 0 ? `url(#${id}-cut-${k})` : undefined}
          opacity={BACK_OPACITY[k]}
        >
          <g
            ref={(el) => {
              groups.current[k] = el;
            }}
          >
            <path d={FOLDER_D} transform={`translate(${k * STEP} ${-k * STEP})`} />
          </g>
        </g>
      ))}
    </svg>
  );
}
