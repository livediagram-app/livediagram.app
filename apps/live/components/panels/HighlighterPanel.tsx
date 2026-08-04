'use client';

// The Highlighter Panel (spec/81): the marker's colour and strength, present
// only while the Highlighter tool is held — the sixth tool panel, on the same
// terms as the Eraser, Laser, Spotlight, Format and Avatar ones.
//
// These two settings used to live in the top mode banner, in a pair of
// popovers hanging off a strip that also carried a Cancel. That was the right
// home while the highlighter was a one-shot ARM (pick it, draw one stroke, it
// puts itself down): the banner was the only thing on screen that knew the arm
// existed. It became the wrong home the moment the marker turned into a held
// tool, because a mode's settings belong wherever every OTHER mode keeps
// theirs, and because the banner sat across the top of the canvas covering the
// toolbar you were trying to highlight next to.
//
// The preview is a real stroke at the chosen colour and width, over a line of
// "text": "Bold" is a number until you see how much of a sentence it covers.

import { useState } from 'react';

import {
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_WIDTHS,
  highlighterWidthId,
  highlighterWidthPx,
} from '@/lib/highlighter-config';
import { ToolOptionRow } from '@/components/panels/ToolOptionRow';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

type Row = 'colour' | 'strength';

// A marker stroke at the real colour and width, laid over a line of mock text.
// The stroke is drawn with the canvas's own recipe — translucent, flat caps —
// so the preview and the board agree about what "Bold in pink" looks like.
function MarkerPreview({ color, width }: { color: string; width: number }) {
  return (
    <div className="relative mb-1 flex h-14 items-center overflow-hidden rounded-lg bg-slate-100 px-3 dark:bg-slate-800">
      {/* The passage being highlighted. Bars rather than words: a preview that
          says something in English invites reading it instead of looking at
          the stroke. */}
      <div className="absolute inset-x-3 flex flex-col gap-1.5">
        {[10, 8, 6].map((w, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"
            style={{ width: `${w * 9}%` }}
          />
        ))}
      </div>
      {/* Capped to the preview box: a 22px stroke is most of the panel's
          height, and a preview that overflows teaches nothing. */}
      <span
        aria-hidden
        className="relative w-full rounded-[2px]"
        style={{
          height: Math.min(width, 26),
          backgroundColor: color,
          // The marker's own translucency, the pen recipe the renderers use.
          opacity: 0.55,
        }}
      />
    </div>
  );
}

export function HighlighterPanel({
  color,
  width,
  onSetColor,
  onSetWidth,
  ...placement
}: {
  color: string;
  width: number;
  onSetColor: (color: string) => void;
  onSetWidth: (width: number) => void;
} & ModePanelProps) {
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpenRow((r) => (r === row ? null : row));

  const widthId = highlighterWidthId(width);
  const colourLabel = HIGHLIGHTER_COLORS.find((c) => c.id === color)?.label;

  return (
    <ModePanel title="Highlighter" {...placement}>
      <div className="flex flex-col px-2 pb-2">
        <MarkerPreview color={color} width={width} />
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <ToolOptionRow
            label="Colour"
            options={HIGHLIGHTER_COLORS}
            value={color}
            // A stroke recoloured from the element's own Colours category can
            // sit off the cup entirely, so the header names the hex rather
            // than showing nothing.
            valueLabel={colourLabel ?? color}
            open={openRow === 'colour'}
            onToggle={() => toggle('colour')}
            onPick={(id) => onSetColor(id)}
            swatchFor={(id) => id}
          />
          <ToolOptionRow
            label="Strength"
            options={HIGHLIGHTER_WIDTHS}
            value={widthId}
            valueLabel={widthId ? undefined : `${width}px`}
            open={openRow === 'strength'}
            onToggle={() => toggle('strength')}
            onPick={(id) => onSetWidth(highlighterWidthPx(id))}
          />
        </div>
        <p className="px-1 pt-1.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          Drag across the board to highlight. The marker stays in your hand until you pick another
          tool, and each pass is its own undo.
        </p>
      </div>
    </ModePanel>
  );
}
