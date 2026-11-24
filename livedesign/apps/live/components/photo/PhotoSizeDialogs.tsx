'use client';

// The Image menu's size dialogs (docs/specs/031-photo/photo-pages.md "Changing the size"): Image Size
// (width and height in px or %, the chain keeping the shape, the resampling), Canvas Size (the new size
// about an anchor, the new area's fill) and Rotate (any angle, the canvas growing to hold it). OK is
// one edit; the page takes the new size.
import { useId, useState } from 'react';
import { Button, SegmentedToggle, Select, Switch, TextInput } from '@livedesign/ui';
import type React from 'react';
import { Callout } from '@liveworkspace/ui/callout';
import { ANCHORS, type Anchor, type Interpolation } from '@livedesign/photo-engine';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { standardGroup } from '@liveworkspace/workbench/components/colour/colour-options';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { canvasSize, imageSize, rotateAny, sizeRefused } from '@/lib/photo-editor/image-ops';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { track } from '@/lib/telemetry';
import { photoCanvasSizeHeroArt } from './PhotoCanvasSizeHeroArt';
import { PhotoDialogHero } from './PhotoDialogHero';
import { photoImageSizeHeroArt } from './PhotoImageSizeHeroArt';
import { photoRotateHeroArt } from './PhotoRotateHeroArt';

// Every row reads the same: its name on the left at one size, its control on the right.
const LABEL =
  'flex min-h-8 items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200';

// A row whose control is a dropdown (Resample, New Area).
function ChoiceRow<T extends string>({
  label,
  value,
  choices,
  onChange,
  children,
}: {
  label: string;
  value: T;
  choices: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={LABEL}>
      {label}
      <span className="flex items-center gap-2">
        {children}
        <Select
          aria-label={label}
          className="w-44"
          selectClassName="text-[13px]"
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </span>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  return (
    <label className={LABEL}>
      {label}
      <span className="flex items-center gap-1.5">
        <TextInput
          type="number"
          compact
          aria-label={label}
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 tabular-nums"
        />
        <span className="w-6 text-xs text-slate-500 dark:text-slate-400">{unit}</span>
      </span>
    </label>
  );
}

export function ImageSizeDialog({
  photo,
  onClose,
}: {
  photo: PhotoEditorView;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const { width: W, height: H } = s.photo;
  const [w, setW] = useState(W);
  const [h, setH] = useState(H);
  const [chain, setChain] = useState(true);
  const [percent, setPercent] = useState(false);
  const [how, setHow] = useState<Interpolation>('bicubic');
  const shownW = percent ? (w / W) * 100 : w;
  const shownH = percent ? (h / H) * 100 : h;
  const setWidth = (v: number) => {
    const px = percent ? (v / 100) * W : v;
    setW(Math.round(px));
    if (chain) setH(Math.max(1, Math.round((px / W) * H)));
  };
  const setHeight = (v: number) => {
    const px = percent ? (v / 100) * H : v;
    setH(Math.round(px));
    if (chain) setW(Math.max(1, Math.round((px / H) * W)));
  };
  const refused = sizeRefused(w, h);
  const titleId = useId();
  return (
    <Dialog open onClose={onClose} titleId={titleId} backdrop="desktop-light">
      {/* The dialog hero header (dialog-hero-header.md): the photo scaled to a new size. */}
      <PhotoDialogHero
        art={photoImageSizeHeroArt}
        titleId={titleId}
        title="Image Size"
        line={`Now ${W} x ${H} px. Every layer is resampled.`}
        onClose={onClose}
      />
      <div className="flex flex-col gap-3 px-6 py-4">
        <NumberField label="Width" value={shownW} onChange={setWidth} unit={percent ? '%' : 'px'} />
        <NumberField
          label="Height"
          value={shownH}
          onChange={setHeight}
          unit={percent ? '%' : 'px'}
        />
        <div className={LABEL}>
          Keep Proportions
          <Switch size="sm" label="Keep Proportions" checked={chain} onChange={setChain} />
        </div>
        <div className={LABEL}>
          Units
          <SegmentedToggle<'px' | 'percent'>
            label="Units"
            value={percent ? 'percent' : 'px'}
            onChange={(u) => setPercent(u === 'percent')}
            options={[
              { value: 'px', label: 'Pixels', description: 'Width and height in pixels.' },
              {
                value: 'percent',
                label: 'Percent',
                description: 'Width and height as a share of the size now.',
              },
            ]}
          />
        </div>
        <ChoiceRow<Interpolation>
          label="Resample"
          value={how}
          choices={[
            { value: 'bicubic', label: 'Bicubic' },
            { value: 'bilinear', label: 'Bilinear' },
            { value: 'nearest', label: 'Nearest Neighbour' },
          ]}
          onChange={setHow}
        />
        {refused ? <Callout tone="error">{refused}</Callout> : null}
      </div>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!!refused || (w === W && h === H)}
          onClick={() => {
            const r = imageSize(s, w, h, how);
            if (r) return photo.toast(r);
            track('Tab', 'Changed', 'PhotoImageSize');
            onClose();
          }}
        >
          OK
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

const ANCHOR_NAMES: Record<Anchor, string> = {
  'top-left': 'Top Left',
  top: 'Top',
  'top-right': 'Top Right',
  left: 'Left',
  centre: 'Centre',
  right: 'Right',
  'bottom-left': 'Bottom Left',
  bottom: 'Bottom',
  'bottom-right': 'Bottom Right',
};

type Fill = 'transparent' | 'white' | 'background' | 'colour';

export function CanvasSizeDialog({
  photo,
  onClose,
}: {
  photo: PhotoEditorView;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const { width: W, height: H } = s.photo;
  const [w, setW] = useState(W);
  const [h, setH] = useState(H);
  const [anchor, setAnchor] = useState<Anchor>('centre');
  const [fill, setFill] = useState<Fill>('transparent');
  const [colour, setColour] = useState('#ffffff');
  const refused = sizeRefused(w, h);
  const titleId = useId();
  const fillHex =
    fill === 'transparent'
      ? null
      : fill === 'white'
        ? '#ffffff'
        : fill === 'background'
          ? photoTools.get().background
          : colour;
  return (
    <Dialog open onClose={onClose} titleId={titleId} backdrop="desktop-light">
      {/* The dialog hero header (dialog-hero-header.md): the photo inside a wider canvas, and the anchor. */}
      <PhotoDialogHero
        art={photoCanvasSizeHeroArt}
        titleId={titleId}
        title="Canvas Size"
        line={`Now ${W} x ${H} px. The layers keep their pixels; the photo's edges move.`}
        short={`Now ${W} x ${H} px. The photo's edges move.`}
        onClose={onClose}
      />
      <div className="flex flex-col gap-3 px-6 py-4">
        <NumberField label="Width" value={w} onChange={(v) => setW(Math.round(v))} unit="px" />
        <NumberField label="Height" value={h} onChange={(v) => setH(Math.round(v))} unit="px" />
        <div className={LABEL}>
          Anchor
          <div role="radiogroup" aria-label="Anchor" className="grid grid-cols-3 gap-1">
            {ANCHORS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={anchor === a}
                aria-label={ANCHOR_NAMES[a]}
                onClick={() => setAnchor(a)}
                className={`h-6 w-6 rounded border ${
                  anchor === a
                    ? 'border-brand-600 bg-brand-500'
                    : 'border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900'
                }`}
              />
            ))}
          </div>
        </div>
        <ChoiceRow<Fill>
          label="New Area"
          value={fill}
          choices={[
            { value: 'transparent', label: 'Transparent' },
            { value: 'white', label: 'White' },
            { value: 'background', label: 'Background Colour' },
            { value: 'colour', label: 'Colour' },
          ]}
          onChange={setFill}
        >
          {fill === 'colour' ? (
            <ColourSwatchButton
              label="New Area Colour"
              swatch={colour}
              value={colour}
              standard={[standardGroup('strong', 'light', 'hex')]}
              onPick={(id) => /^#[0-9a-f]{6}$/i.test(id) && setColour(id.toLowerCase())}
            />
          ) : null}
        </ChoiceRow>
        {refused ? <Callout tone="error">{refused}</Callout> : null}
      </div>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!!refused || (w === W && h === H)}
          onClick={() => {
            const r = canvasSize(s, w, h, anchor, fillHex);
            if (r) return photo.toast(r);
            track('Tab', 'Changed', 'PhotoCanvasSize');
            onClose();
          }}
        >
          OK
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export function RotateDialog({ photo, onClose }: { photo: PhotoEditorView; onClose: () => void }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const [angle, setAngle] = useState(0);
  const [clockwise, setClockwise] = useState(true);
  const titleId = useId();
  return (
    <Dialog open onClose={onClose} titleId={titleId} backdrop="desktop-light">
      {/* The dialog hero header (dialog-hero-header.md): the photo turned about its centre. */}
      <PhotoDialogHero
        art={photoRotateHeroArt}
        titleId={titleId}
        title="Rotate"
        line="The photo turns by the angle, the canvas growing to hold it."
        short="The canvas grows to hold the turned photo."
        onClose={onClose}
      />
      <div className="flex flex-col gap-3 px-6 py-4">
        <NumberField
          label="Angle"
          value={angle}
          onChange={(v) => setAngle(Math.min(359.99, Math.max(-359.99, v)))}
          unit="°"
        />
        <div className={LABEL}>
          Direction
          <SegmentedToggle<'cw' | 'ccw'>
            label="Direction"
            value={clockwise ? 'cw' : 'ccw'}
            onChange={(d) => setClockwise(d === 'cw')}
            options={[
              { value: 'cw', label: 'Clockwise', description: 'Turns the photo to the right.' },
              {
                value: 'ccw',
                label: 'Anticlockwise',
                description: 'Turns the photo to the left.',
              },
            ]}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!angle}
          onClick={() => {
            const r = rotateAny(s, clockwise ? angle : -angle);
            if (r) return photo.toast(r);
            track('Tab', 'Changed', 'PhotoRotated');
            onClose();
          }}
        >
          OK
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
