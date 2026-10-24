'use client';

// The options flyout's Brush Presets (docs/specs/031-photo/photo-tools.md "Shared gestures and options"): a
// press opens the saved tips, each drawn as its dab with its name; a press on one takes its size, hardness,
// flow and spacing for the tool in hand. Save Preset keeps the tip in hand under a name; the person's own
// presets can be deleted.
import { useState } from 'react';
import { lucideX } from '@liveworkspace/icons/lucide';
import { Button, lucideGlyph, TextInput, Tooltip } from '@livedesign/ui';
import {
  deletePreset,
  savePreset,
  tipOf,
  useBrushPresets,
  type BrushPreset,
  type BrushTip,
} from '@/lib/photo-editor/brush-presets';
import { track } from '@/lib/telemetry';

const DeleteIcon = lucideGlyph(lucideX, 10);

/** A tip's dab: a disc whose edge softens with its hardness. */
function Dab({ preset }: { preset: BrushTip }) {
  const hard = Math.round(preset.hardness * 100);
  const side = 10 + Math.min(1, preset.size / 120) * 18;
  return (
    <span
      aria-hidden
      className="block rounded-full text-slate-800 dark:text-slate-100"
      style={{
        width: side,
        height: side,
        opacity: 0.35 + preset.flow * 0.65,
        background: `radial-gradient(circle, currentColor ${hard}%, transparent 100%)`,
      }}
    />
  );
}

/** Whether a preset is the tip in hand. */
const sameTip = (p: BrushTip, tip: BrushTip): boolean =>
  p.size === tip.size &&
  p.hardness === tip.hardness &&
  p.flow === tip.flow &&
  p.spacing === tip.spacing;

/** The saved tips as tiles, each drawn as its dab with its name (the tip in hand marked), and Save Preset: in place
 *  in the options flyout, or in the popover off the Brush Presets button. */
export function BrushPresetGrid({
  tip,
  onTake,
}: {
  tip: BrushTip;
  onTake: (tip: BrushTip) => void;
}) {
  const presets = useBrushPresets();
  const [name, setName] = useState('');
  const take = (p: BrushPreset) => {
    onTake(tipOf(p));
    track('Element', 'Changed', 'PhotoBrushPreset');
  };
  return (
    <div className="flex flex-col gap-3">
      <div role="list" aria-label="Brush Presets" className="grid grid-cols-4 gap-1.5">
        {presets.map((p) => (
          <div key={p.id} role="listitem" className="relative">
            <button
              type="button"
              aria-pressed={sameTip(p, tip)}
              onClick={() => take(p)}
              className={`flex h-16 w-full flex-col items-center justify-end gap-1 rounded-xl p-1 text-[10.5px] font-medium ring-1 transition ${
                sameTip(p, tip)
                  ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-100 dark:ring-brand-500/50'
                  : 'text-slate-600 ring-slate-200/80 hover:bg-slate-50 hover:shadow-sm dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800/70'
              }`}
            >
              <span className="flex flex-1 items-center">
                <Dab preset={p} />
              </span>
              <span className="w-full truncate text-center">{p.name}</span>
            </button>
            {p.own ? (
              <Tooltip label={`Delete ${p.name}`}>
                <button
                  type="button"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => deletePreset(p.id)}
                  className="absolute right-0.5 top-0.5 rounded p-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <DeleteIcon />
                </button>
              </Tooltip>
            ) : null}
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          savePreset(name, tip);
          setName('');
          track('Element', 'Changed', 'PhotoBrushPresetSaved');
        }}
      >
        <TextInput
          compact
          aria-label="Preset Name"
          placeholder="Preset name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button size="xs" type="submit">
          Save Preset
        </Button>
      </form>
    </div>
  );
}
