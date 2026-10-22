'use client';

// An adjustment's settings (docs/specs/031-photo/photo-adjustments.md "The adjustments"): its section
// chooser (a channel, a range, a tone), its fields, and Curves' own editor; each change handed back
// as the adjustment's whole params. Shared by an adjustment layer's properties and the applied
// adjustment's dialog.
import { useEffect, useState } from 'react';
import { Button } from '@livedesign/ui';
import {
  whiteBalanceFromNeutral,
  type AdjustmentId,
  type Gradient,
  type Histogram,
} from '@livedesign/photo-engine';
import { autoCurves, autoLevels } from '@/lib/photo-editor/adjust-auto';
import { cancelNeutral, pickNeutral, useNeutralPicking } from '@/lib/photo-editor/neutral-pick';
import { track } from '@/lib/telemetry';
import { histogramPath } from './usePhotoHistogram';
import { standardGroup } from '@/components/colour/colour-options';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { SegmentedRadio } from '@/components/primitives/SegmentedRadio';
import {
  ADJUST_SPECS,
  getPath,
  withSetting,
  type AdjustField,
} from '@/lib/photo-editor/adjustment-fields';
import { CurvesEditor } from './CurvesEditor';
import { PhotoGradientField } from './PhotoGradientField';
import { OptionChoice, OptionSlider, OptionToggle } from './photo-controls';

const STANDARD = [standardGroup('strong', 'light', 'hex')];

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: AdjustField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.kind) {
    case 'toggle':
      return <OptionToggle label={field.label} on={value === true} onChange={onChange} />;
    case 'colour':
      return (
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {field.label}
          <ColourSwatchButton
            label={field.label}
            swatch={String(value)}
            value={String(value)}
            standard={STANDARD}
            onPick={(id) => /^#[0-9a-f]{6}$/i.test(id) && onChange(id.toLowerCase())}
          />
        </label>
      );
    case 'gradient':
      return (
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {field.label}
          <PhotoGradientField label={field.label} value={value as Gradient} onChange={onChange} />
        </label>
      );
    case 'choice':
      return (
        <OptionChoice
          label={field.label}
          value={field.choices.some((c) => c.value === value) ? String(value) : ''}
          choices={[
            ...(field.choices.some((c) => c.value === value)
              ? []
              : [{ value: '', label: 'Custom' }]),
            ...field.choices,
          ]}
          onChange={(v) => v && onChange(v)}
        />
      );
    default:
      return (
        <OptionSlider
          label={field.label}
          value={typeof value === 'number' ? value : field.min}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          unit={field.percent ? '%' : (field.unit ?? '')}
          scale={field.percent ? 100 : 1}
          width="w-full"
          onChange={onChange}
        />
      );
  }
}

// The adjustments that show the histogram under their settings.
const WITH_HISTOGRAM: ReadonlySet<AdjustmentId> = new Set(['levels', 'threshold']);

/** The photo's tones under an adjustment's settings (Levels, Threshold). */
function HistogramStrip({ histogram }: { histogram: Histogram | null }) {
  return (
    <svg
      viewBox="0 0 256 64"
      preserveAspectRatio="none"
      className="h-10 w-full rounded bg-slate-50 dark:bg-slate-800/60"
      role="img"
      aria-label="Histogram"
    >
      <path d={histogramPath(histogram?.luma)} className="fill-slate-500 dark:fill-slate-400" />
    </svg>
  );
}

export function AdjustmentEditor({
  id,
  params,
  onChange,
  histogram,
  canPickNeutral = false,
}: {
  id: AdjustmentId;
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  // The photo's histogram, for Levels' and Curves' Auto and the strip under Levels and Threshold.
  histogram?: Histogram | null;
  // White Balance's picker: the next press on the photo (not while a dialog covers it).
  canPickNeutral?: boolean;
}) {
  const spec = ADJUST_SPECS[id];
  const [section, setSection] = useState(0);
  const read = spec.read(params);
  const prefix = spec.section?.options[section]?.prefix ?? [];
  const picking = useNeutralPicking();
  // A pick still waiting is let go with Escape, or when the settings close.
  useEffect(() => {
    if (!picking) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelNeutral();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [picking]);
  useEffect(() => () => cancelNeutral(), []);
  const auto =
    histogram && (id === 'levels' || id === 'curves')
      ? () => {
          onChange(id === 'levels' ? autoLevels(histogram) : autoCurves(histogram));
          track('Element', 'Changed', id === 'levels' ? 'PhotoLevelsAuto' : 'PhotoCurvesAuto');
        }
      : null;
  if (!spec.fields?.length && !spec.sectioned?.length && !spec.custom)
    return (
      <p className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
        This adjustment has no settings.
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      {spec.section ? (
        spec.section.options.length <= 4 ? (
          <SegmentedRadio
            label={spec.section.label}
            options={spec.section.options.map((o, i) => ({ id: i, label: o.label }))}
            value={section}
            onChange={setSection}
          />
        ) : (
          <OptionChoice
            label={spec.section.label}
            value={section}
            choices={spec.section.options.map((o, i) => ({ value: i, label: o.label }))}
            onChange={setSection}
          />
        )
      ) : null}
      {WITH_HISTOGRAM.has(id) && histogram !== undefined ? (
        <HistogramStrip histogram={histogram} />
      ) : null}
      {auto || (id === 'white-balance' && canPickNeutral) ? (
        <div className="flex items-center gap-2">
          {auto ? (
            <Button variant="secondary" size="xs" onClick={auto}>
              Auto
            </Button>
          ) : null}
          {id === 'white-balance' && canPickNeutral ? (
            <Button
              variant="secondary"
              size="xs"
              aria-pressed={picking}
              onClick={() =>
                picking
                  ? cancelNeutral()
                  : pickNeutral(([r, g, b]) => {
                      onChange({ ...params, ...whiteBalanceFromNeutral(r, g, b) });
                      track('Element', 'Changed', 'PhotoWhiteBalancePicked');
                    })
              }
            >
              {picking ? 'Press Something Grey' : 'Pick Neutral'}
            </Button>
          ) : null}
        </div>
      ) : null}
      {spec.custom === 'curves' ? (
        <CurvesEditor
          points={(getPath(read, prefix) as [number, number][]) ?? []}
          onChange={(points) => onChange(withSetting(id, params, prefix, points))}
        />
      ) : null}
      {(spec.sectioned ?? []).map((f) => (
        <FieldControl
          key={`${section}-${f.label}`}
          field={f}
          value={getPath(read, [...prefix, ...f.path])}
          onChange={(v) => onChange(withSetting(id, params, [...prefix, ...f.path], v))}
        />
      ))}
      {(spec.fields ?? []).map((f) => (
        <FieldControl
          key={f.label}
          field={f}
          value={getPath(read, f.path)}
          onChange={(v) => onChange(withSetting(id, params, f.path, v))}
        />
      ))}
    </div>
  );
}
