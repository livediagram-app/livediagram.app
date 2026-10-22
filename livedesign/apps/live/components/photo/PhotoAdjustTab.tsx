'use client';

// The Photo panel's Adjust tab (docs/specs/031-photo/photo-adjustments.md "The Adjust tab"): the adjustments as
// tiles in their sections (Light, Colour, Creative), each the photo itself through that adjustment
// (useAdjustmentPreviews), a press adding an adjustment layer of it above the active layer (clipped to it with Alt,
// masked by the selection when there is one). While an adjustment layer is active, its settings take the tiles'
// place under a header (its picture, name, Reset, and All Adjustments back to the tiles); a change shows at once
// and commits once it rests.
import { useState } from 'react';
import { lucideChevronLeft, lucideRotateCcw } from '@livedesign/icons/lucide';
import { HoverCard, lucideGlyph } from '@livedesign/ui';
import {
  ADJUSTMENTS,
  LAYER_ADJUSTMENT_IDS,
  adjustmentName,
  setLayer,
  type AdjustmentId,
} from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { ADJUST_SECTIONS } from '@/lib/photo-editor/adjust-showcase';
import { newAdjustmentLayer } from '@/lib/photo-editor/layer-ops';
import { addMask } from '@/lib/photo-editor/mask-ops';
import { track } from '@/lib/telemetry';
import { AdjustmentEditor } from './AdjustmentEditor';
import { FlyoutSection, SwitchRow } from './flyout-controls';
import { useRestingCommit } from './PhotoLayersTab';
import { useAdjustmentPreviews, type AdjustPreviews } from './useAdjustmentPreviews';
import { usePhotoHistogram } from './usePhotoHistogram';

const Back = lucideGlyph(lucideChevronLeft, 14);
const ResetIcon = lucideGlyph(lucideRotateCcw, 13);

const pascal = (id: string) => id.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase());

// What each adjustment does, in a line, for its tile's title.
const ADJUST_LINES: Partial<Record<AdjustmentId, string>> = {
  brightness: 'Lighter or darker, and more or less contrast.',
  levels: 'Set the black, white and middle points.',
  curves: 'Reshape the tones point by point.',
  exposure: 'As if the photo had more or less light.',
  vibrance: 'Richer colour, gentle on what is already strong.',
  'hue-saturation': 'Shift the colours, or make them stronger or softer.',
  'colour-balance': 'Warm or cool the shadows, midtones and highlights.',
  'white-balance': 'Make whites white: warmer, cooler or tinted.',
  'photo-filter': 'A coloured lens over the photo.',
  'selective-colour': 'Change one family of colours on its own.',
  'channel-mixer': 'Blend the red, green and blue channels.',
  'black-white': 'Black and white, each colour its own grey.',
  'gradient-map': 'Map the tones onto a gradient.',
  invert: 'A negative of the photo.',
  posterize: 'A few flat bands of each colour.',
  threshold: 'Pure black and white.',
};

function Tile({
  id,
  src,
  onPick,
}: {
  id: AdjustmentId;
  src: string | undefined;
  onPick: (alt: boolean) => void;
}) {
  return (
    <HoverCard title={adjustmentName(id)} description={ADJUST_LINES[id]}>
      <button
        type="button"
        aria-label={adjustmentName(id)}
        onClick={(e) => onPick(e.altKey)}
        className="group flex min-w-0 flex-col gap-1.5 rounded-xl p-1 text-left ring-1 ring-transparent transition hover:bg-slate-50 hover:ring-slate-200 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-slate-800/70 dark:hover:ring-slate-700"
      >
        <span
          aria-hidden
          className="block aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/80 transition group-hover:shadow-md dark:bg-slate-800 dark:ring-slate-700"
        >
          {src ? (
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover transition-transform duration-micro group-hover:scale-105"
            />
          ) : null}
        </span>
        <span className="truncate px-0.5 text-[11.5px] font-medium leading-tight text-slate-700 dark:text-slate-200">
          {adjustmentName(id)}
        </span>
      </button>
    </HoverCard>
  );
}

function Tiles({ photo, previews }: { photo: PhotoEditorView; previews: AdjustPreviews }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const pick = (id: AdjustmentId, alt: boolean) => {
    const made = newAdjustmentLayer(s, id, alt);
    if (s.selection) addMask(s, made, 'selection');
    track('Element', 'Changed', `PhotoAdjust${pascal(id)}`);
  };
  return (
    <div className="flex flex-col gap-3 px-3 pb-2" data-photo-adjust="">
      {ADJUST_SECTIONS.map((section) => (
        <FlyoutSection key={section.title} title={section.title}>
          <div className="grid grid-cols-3 gap-1.5">
            {section.ids
              .filter((id) => LAYER_ADJUSTMENT_IDS.includes(id))
              .map((id) => (
                <Tile key={id} id={id} src={previews[id]} onPick={(alt) => pick(id, alt)} />
              ))}
          </div>
        </FlyoutSection>
      ))}
      <p className="px-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Each adds an adjustment layer above the selected layer, changing everything under it;
        Alt-click to change only that layer. With a selection, only the selected part changes.
      </p>
    </div>
  );
}

export function PhotoAdjustTab({ photo }: { photo: PhotoEditorView }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const resting = useRestingCommit(photo);
  const active = s.layer(s.active);
  // The adjustment layer whose settings were left for the tiles (All Adjustments), while it stays active.
  const [browsingFrom, setBrowsingFrom] = useState<string | null>(null);
  const settings = active?.layerKind === 'adjustment' && browsingFrom !== active.id ? active : null;
  const previews = useAdjustmentPreviews(photo, LAYER_ADJUSTMENT_IDS, photo.canEdit);
  // What is under an adjustment layer, for its Auto and its histogram (only Levels, Curves and
  // Threshold read it, so only they work it out).
  const reads = !!settings && ['levels', 'curves', 'threshold'].includes(settings.adjustment.id);
  const histogram = usePhotoHistogram(photo, {
    without: reads ? settings.id : undefined,
    skip: !reads,
  });
  if (settings) {
    const id = settings.adjustment.id;
    return (
      <div className="flex flex-col gap-3 px-3 pb-2" data-photo-adjust="">
        {photo.canEdit ? (
          <button
            type="button"
            onClick={() => setBrowsingFrom(settings.id)}
            className="flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-[12px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Back />
            All Adjustments
          </button>
        ) : null}
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/80 dark:bg-slate-800/50 dark:ring-slate-700">
          <span className="block h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-200 ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600">
            {previews[id] ? (
              <img src={previews[id]} alt="" className="h-full w-full object-cover" />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-slate-50">
              {settings.name}
            </span>
            <span className="line-clamp-2 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
              {ADJUST_LINES[id] ?? 'An adjustment layer.'}
            </span>
          </span>
          {photo.canEdit ? (
            <button
              type="button"
              onClick={() =>
                s.commitStack(
                  setLayer(s.photo, settings.id, {
                    adjustment: { id, params: structuredClone(ADJUSTMENTS[id].defaults) },
                  }),
                  `Reset ${adjustmentName(id)}`,
                )
              }
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium text-slate-500 ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              <ResetIcon />
              Reset
            </button>
          ) : null}
        </div>
        {photo.canEdit ? (
          <>
            <AdjustmentEditor
              id={id}
              histogram={histogram}
              canPickNeutral
              params={settings.adjustment.params}
              onChange={(params) =>
                resting(
                  (p) => setLayer(p, settings.id, { adjustment: { id, params } }),
                  adjustmentName(id),
                )
              }
            />
            <SwitchRow
              label="Clip to Layer Below"
              guide="clip"
              on={!!settings.clip}
              onChange={(on) =>
                s.commitStack(
                  setLayer(s.photo, settings.id, { clip: on ? true : undefined }),
                  on ? 'Create Clipping Mask' : 'Release Clipping Mask',
                )
              }
              onPoint={() => {}}
            />
          </>
        ) : (
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
            Only an editor can change its settings.
          </p>
        )}
      </div>
    );
  }
  if (!photo.canEdit)
    return (
      <p className="px-3 pb-2 text-[11.5px] text-slate-500 dark:text-slate-400">
        Choose an adjustment layer to see its settings.
      </p>
    );
  return <Tiles photo={photo} previews={previews} />;
}
