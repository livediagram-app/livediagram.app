'use client';

// The options flyout while a Free Transform is open (docs/specs/031-photo/photo-pages.md "The options flyout"):
// Position, Size (px or a percent) and Angle, Shape (Mode and Interpolation), the flips, and Cancel and Commit.
import { useState, type ReactNode } from 'react';
import { lucideFlipHorizontal2, lucideFlipVertical2 } from '@liveworkspace/icons/lucide';
import { Button, lucideGlyph } from '@livedesign/ui';
import type { Interpolation, TransformMode } from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import {
  cancelTransform,
  commitTransform,
  flipTransform,
  readout,
  setTransformInterpolation,
  setTransformMode,
  setTransformReadout,
  useFreeTransform,
} from '@/lib/photo-editor/tools/transform-tool';
import { FlyoutSection, SliderRow, SwitchRow, TileChoice, type Pointed } from './flyout-controls';

const icon = (g: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(g, 15);
const FlipH = icon(lucideFlipHorizontal2);
const FlipV = icon(lucideFlipVertical2);
const SECONDARY =
  'flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800';

/** A Free Transform's box: its numbers, how a corner drag shapes it, how it is resampled, the flips, and the ends. */
export function TransformOptionsBody({
  photo,
  onPoint,
}: {
  photo: PhotoEditorView;
  onPoint: (p: Pointed) => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const t = useFreeTransform();
  // W and H in px, or as a percent of the pixels lifted (photo-tools.md "Transform").
  const [percent, setPercent] = useState(false);
  const ctx = photo.ctx;
  if (!t || !ctx) return null;
  const r = readout(t);
  const { width: rw, height: rh } = t.lifted.raster;
  const W = photo.session?.photo.width ?? 1000;
  const H = photo.session?.photo.height ?? 1000;
  const num = (
    label: string,
    k: 'x' | 'y' | 'width' | 'height',
    min: number,
    max: number,
  ): ReactNode => {
    const of = k === 'width' ? rw : rh;
    const pct = percent && (k === 'width' || k === 'height');
    return (
      <SliderRow
        key={k}
        label={label}
        guide={label.toLowerCase()}
        value={pct ? Math.round((r[k] / of) * 1000) / 10 : Math.round(r[k] * 10) / 10}
        min={pct ? 0.1 : min}
        max={pct ? 400 : max}
        step={pct ? 0.1 : 1}
        unit={pct ? '%' : 'px'}
        onChange={(v) => setTransformReadout(ctx, { [k]: pct ? (v / 100) * of : v })}
        onPoint={onPoint}
      />
    );
  };
  return (
    <>
      <FlyoutSection title="Position">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {num('X', 'x', -W, W * 2)}
          {num('Y', 'y', -H, H * 2)}
        </div>
      </FlyoutSection>
      <FlyoutSection title="Size">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {num('W', 'width', 1, W * 4)}
          {num('H', 'height', 1, H * 4)}
        </div>
        <SwitchRow
          label="As a Percent"
          guide="percent"
          on={percent}
          onChange={setPercent}
          onPoint={onPoint}
        />
        <SliderRow
          label="Angle"
          guide="angle"
          value={Math.round(r.angle * 10) / 10}
          min={-180}
          max={180}
          step={0.1}
          unit="°"
          onChange={(v) => setTransformReadout(ctx, { angle: v })}
          onPoint={onPoint}
        />
      </FlyoutSection>
      <FlyoutSection title="Shape">
        <TileChoice<TransformMode>
          label="Mode"
          guide="transformMode"
          value={t.mode}
          choices={[
            { value: 'free', label: 'Free' },
            { value: 'skew', label: 'Skew' },
            { value: 'perspective', label: 'Perspective' },
          ]}
          onChange={setTransformMode}
          onPoint={onPoint}
        />
        <TileChoice<Interpolation>
          label="Interpolation"
          guide="interpolation"
          value={t.interpolation}
          choices={[
            { value: 'bicubic', label: 'Bicubic' },
            { value: 'bilinear', label: 'Bilinear' },
            { value: 'nearest', label: 'Nearest' },
          ]}
          onChange={setTransformInterpolation}
          onPoint={onPoint}
        />
      </FlyoutSection>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className={SECONDARY} onClick={() => flipTransform(ctx, true)}>
          <FlipH />
          Flip Horizontal
        </button>
        <button type="button" className={SECONDARY} onClick={() => flipTransform(ctx, false)}>
          <FlipV />
          Flip Vertical
        </button>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" className={SECONDARY} onClick={() => cancelTransform(ctx)}>
          Cancel
        </button>
        <Button size="sm" onClick={() => commitTransform(ctx)}>
          Commit
        </Button>
      </div>
    </>
  );
}
