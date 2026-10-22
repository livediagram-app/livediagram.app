'use client';

// A filter's dialog and an applied adjustment's (docs/specs/031-photo/photo-adjustments.md "Filters",
// "The Adjust tab" applied): the settings, previewing live on the photo (Preview, on), a progress bar
// for a filter past half a second, Reset, Cancel and OK (one edit). The photo shows through, so the
// preview is seen as it is made.
import { useEffect, useState } from 'react';
import { Button, DialogHeader } from '@livedesign/ui';
import {
  ADJUSTMENTS,
  adjustmentName,
  FILTERS,
  type AdjustmentId,
  type ParamSpec,
} from '@livedesign/photo-engine';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { rasterize } from '@/lib/photo-editor/layer-ops';
import {
  lastPhotoFilter,
  photoDialogs,
  type PhotoDialog,
} from '@/lib/photo-editor/photo-dialog-store';
import { track } from '@/lib/telemetry';
import { AdjustmentEditor } from './AdjustmentEditor';
import { OptionChoice, OptionSlider, OptionToggle } from './photo-controls';
import { FilterPointPicker, FilterPreviewSquare } from './FilterPreview';
import { useApplyPreview } from './useApplyPreview';
import { usePhotoHistogram } from './usePhotoHistogram';

const pascal = (id: string) => id.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase());

function defaultsOf(specs: readonly ParamSpec[]): Record<string, unknown> {
  return Object.fromEntries(specs.map((p) => [p.key, structuredClone(p.default)]));
}

function ParamControl({
  spec,
  value,
  onChange,
  photo,
}: {
  spec: ParamSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  photo: PhotoEditorView;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  switch (spec.kind) {
    case 'number':
      return (
        <OptionSlider
          label={spec.name}
          value={typeof value === 'number' ? value : spec.default}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          unit={spec.unit ?? ''}
          width="w-full"
          onChange={onChange}
        />
      );
    case 'choice':
      return (
        <OptionChoice
          label={spec.name}
          value={typeof value === 'string' ? value : spec.default}
          choices={spec.options}
          onChange={onChange}
        />
      );
    case 'toggle':
      return <OptionToggle label={spec.name} on={value === true} onChange={onChange} />;
    case 'point': {
      const p = (value as { x: number; y: number } | undefined) ?? spec.default;
      return (
        <div className="flex flex-col gap-1">
          <FilterPointPicker photo={photo} name={spec.name} value={p} onChange={onChange} />
          <OptionSlider
            label={`${spec.name} Across`}
            value={p.x}
            min={0}
            max={1}
            step={0.01}
            unit="%"
            scale={100}
            width="w-full"
            onChange={(x) => onChange({ ...p, x })}
          />
          <OptionSlider
            label={`${spec.name} Down`}
            value={p.y}
            min={0}
            max={1}
            step={0.01}
            unit="%"
            scale={100}
            width="w-full"
            onChange={(y) => onChange({ ...p, y })}
          />
        </div>
      );
    }
    case 'kernel': {
      const k = (Array.isArray(value) ? value : spec.default) as number[];
      return (
        <div className="grid grid-cols-5 gap-1" role="group" aria-label={spec.name}>
          {k.map((n, i) => (
            <input
              key={i}
              type="number"
              aria-label={`${spec.name} row ${Math.floor(i / 5) + 1} column ${(i % 5) + 1}`}
              value={n}
              onChange={(e) =>
                onChange(k.map((m, j) => (j === i ? Math.round(Number(e.target.value) || 0) : m)))
              }
              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-center text-xs tabular-nums dark:border-slate-700 dark:bg-slate-900"
            />
          ))}
        </div>
      );
    }
  }
}

/** A dialog that cannot work here: it says why and closes. */
function Refused({
  photo,
  message,
  onClose,
}: {
  photo: PhotoEditorView;
  message: string;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  useEffect(() => {
    photo.toast(message);
    onClose();
  }, [photo, message, onClose]);
  return null;
}

/** A filter or an adjustment asked of a text or fill layer: it offers to rasterize the layer first
 *  (photo-adjustments.md "Filters"), then opens again on its pixels. */
function RasterizeFirst({
  photo,
  what,
  reopen,
  onClose,
}: {
  photo: PhotoEditorView;
  what: string;
  reopen: PhotoDialog;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const layer = s.layer(s.active);
  const kind = layer?.layerKind === 'text' ? 'a text layer' : 'a fill layer';
  return (
    <Dialog open onClose={onClose} ariaLabel={what} backdrop="desktop-light" phoneSheet>
      <DialogHeader
        title={what}
        subtitle={`${layer?.name ?? 'This layer'} is ${kind}. Rasterize it to work its pixels.`}
      />
      <DialogFooter>
        <span className="flex-1" />
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const refused = layer ? rasterize(s, layer.id) : 'Choose a layer.';
            if (refused) {
              photo.toast(refused);
              return onClose();
            }
            track('Element', 'Changed', 'PhotoLayerRasterize');
            onClose();
            // Opened again once the layer is pixels.
            void s.settled().then(() => photoDialogs.open(reopen));
          }}
        >
          Rasterize and Apply
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function Footer({
  progress,
  onReset,
  onCancel,
  onOk,
  busy,
}: {
  progress: number | null;
  onReset: () => void;
  onCancel: () => void;
  onOk: () => void;
  busy: boolean;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  return (
    <>
      {progress !== null ? (
        <div
          className="mx-6 mb-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full bg-brand-500 transition-[width] duration-short"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
        <span className="flex-1" />
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy} onClick={onOk}>
          OK
        </Button>
      </DialogFooter>
    </>
  );
}

export function FilterDialog({
  photo,
  id,
  onClose,
}: {
  photo: PhotoEditorView;
  id: string;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const def = FILTERS[id]!;
  const [params, setParams] = useState<Record<string, unknown>>(() =>
    lastPhotoFilter.get()?.id === id ? lastPhotoFilter.get()!.params : defaultsOf(def.params),
  );
  const [preview, setPreview] = useState(true);
  const [busy, setBusy] = useState(false);
  const run = useApplyPreview(photo, { kind: 'filter', id, params }, preview);
  if (run.refused === 'rasterize')
    return (
      <RasterizeFirst
        photo={photo}
        what={def.name}
        reopen={{ kind: 'filter', id }}
        onClose={onClose}
      />
    );
  if (run.refused) return <Refused photo={photo} message={run.refused} onClose={onClose} />;
  return (
    <Dialog open onClose={onClose} ariaLabel={def.name} backdrop="desktop-light" phoneSheet>
      <DialogHeader title={def.name} subtitle="Previewed on the photo as you change it." />
      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-6 py-4">
        {def.params.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">This filter has no settings.</p>
        ) : null}
        {def.params.map((p) => (
          <ParamControl
            key={p.key}
            spec={p}
            photo={photo}
            value={params[p.key]}
            onChange={(v) => setParams((o) => ({ ...o, [p.key]: v }))}
          />
        ))}
        {run.applying ? (
          <FilterPreviewSquare photo={photo} applying={run.applying} id={id} params={params} />
        ) : null}
        <OptionToggle label="Preview" on={preview} onChange={setPreview} />
      </div>
      <Footer
        progress={run.progress}
        busy={busy}
        onReset={() => setParams(defaultsOf(def.params))}
        onCancel={onClose}
        onOk={() => {
          setBusy(true);
          void run.ok(def.name).then((ok) => {
            setBusy(false);
            if (!ok) return;
            lastPhotoFilter.set({ id, params });
            track('Element', 'Changed', `PhotoFilter${pascal(id)}`);
            onClose();
          });
        }}
      />
    </Dialog>
  );
}

export function AdjustDialog({
  photo,
  id,
  onClose,
}: {
  photo: PhotoEditorView;
  id: AdjustmentId;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const [params, setParams] = useState<Record<string, unknown>>(() =>
    structuredClone(ADJUSTMENTS[id].defaults),
  );
  const [preview, setPreview] = useState(true);
  const run = useApplyPreview(photo, { kind: 'adjust', id, params }, preview);
  // Taken as the dialog opens: its preview is written into the layer it reads.
  const histogram = usePhotoHistogram(photo, {
    once: true,
    skip: id !== 'levels' && id !== 'curves' && id !== 'threshold',
  });
  const name = adjustmentName(id);
  if (run.refused === 'rasterize')
    return (
      <RasterizeFirst photo={photo} what={name} reopen={{ kind: 'adjust', id }} onClose={onClose} />
    );
  if (run.refused) return <Refused photo={photo} message={run.refused} onClose={onClose} />;
  return (
    <Dialog open onClose={onClose} ariaLabel={name} backdrop="desktop-light" phoneSheet>
      <DialogHeader title={name} subtitle="Applied to the active layer, within the selection." />
      <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto px-6 py-4">
        <AdjustmentEditor id={id} params={params} onChange={setParams} histogram={histogram} />
        <OptionToggle label="Preview" on={preview} onChange={setPreview} />
      </div>
      <Footer
        progress={null}
        busy={false}
        onReset={() => setParams(structuredClone(ADJUSTMENTS[id].defaults))}
        onCancel={onClose}
        onOk={() => {
          void run.ok(name).then((ok) => {
            if (!ok) return;
            track('Element', 'Changed', `PhotoAdjust${pascal(id)}`);
            onClose();
          });
        }}
      />
    </Dialog>
  );
}
