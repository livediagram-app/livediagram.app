'use client';

// Select and Mask… (docs/specs/031-photo/photo-tools.md "Smart selections" Refining): the selection shown on
// the photo over black, white or the checkerboard, worked by Smooth, Feather, Contrast and Shift Edge, with a
// Refine Edge brush that re-decides what it paints over by colour (hair and fur); OK keeps it as the selection,
// or as the active layer's mask with Output To: Layer Mask. The dialog works a small copy of the photo; OK
// works the photo itself.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button, DialogHeader } from '@livedesign/ui';
import {
  createMask,
  ellipseMask,
  combineMasks,
  resizeRaster,
  trimMask,
  type Mask8,
  type Raster,
} from '@livedesign/photo-engine';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { photoWorkers } from '@/lib/photo-editor/photo-worker-client';
import { previewRaster } from '@/lib/photo-editor/preview';
import {
  MASK_REFINE_DEFAULTS,
  refineMask,
  scaleMask,
  withinZone,
  type MaskRefine,
} from '@/lib/photo-editor/select-and-mask';
import { applySelectAndMask, REFINE_EDGE_RADIUS } from '@/lib/photo-editor/selection-ops';
import { track } from '@/lib/telemetry';
import { OptionChoice, OptionSlider, OptionToggle } from './photo-controls';

// The preview's room, CSS px.
const VIEW_W = 360;
const VIEW_H = 240;
const CHECK = 8;

type Backdrop = 'black' | 'white' | 'checker';

/** The small copy's pixels with the mask over the backdrop. */
function compose(pic: Raster, mask: Mask8 | null, backdrop: Backdrop): ImageData {
  const out = new ImageData(pic.width, pic.height);
  for (let y = 0; y < pic.height; y++)
    for (let x = 0; x < pic.width; x++) {
      const i = (y * pic.width + x) * 4;
      const mx = x - (mask?.x ?? 0);
      const my = y - (mask?.y ?? 0);
      const a =
        mask && mx >= 0 && my >= 0 && mx < mask.width && my < mask.height
          ? mask.data[my * mask.width + mx]! / 255
          : 0;
      const bg =
        backdrop === 'black'
          ? 0
          : backdrop === 'white'
            ? 255
            : (Math.floor(x / CHECK) + Math.floor(y / CHECK)) % 2
              ? 205
              : 250;
      for (let c = 0; c < 3; c++) out.data[i + c] = pic.data[i + c]! * a + bg * (1 - a);
      out.data[i + 3] = 255;
    }
  return out;
}

export function SelectAndMaskDialog({
  photo,
  onClose,
}: {
  photo: PhotoEditorView;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const W = s.photo.width;
  const H = s.photo.height;
  // The small copy's scale over the photo.
  const k = Math.min(1, VIEW_W / W, VIEW_H / H);
  const dw = Math.max(1, Math.round(W * k));
  const dh = Math.max(1, Math.round(H * k));
  const [pic, setPic] = useState<Raster | null>(null);
  const [r, setR] = useState<MaskRefine>(MASK_REFINE_DEFAULTS);
  const [backdrop, setBackdrop] = useState<Backdrop>('checker');
  const [output, setOutput] = useState<'selection' | 'mask'>('selection');
  const [brush, setBrush] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  // The Refine Edge brush's painting, on the small copy.
  const [zone, setZone] = useState<Mask8 | null>(null);
  // The refined mask, with what it was worked from: shown only while those still hold.
  const [refined, setRefined] = useState<{ base: Mask8; zone: Mask8; mask: Mask8 } | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const small = useMemo(() => (s.selection ? scaleMask(s.selection, k) : null), [s.selection, k]);
  const base = useMemo(() => (small ? refineMask(small, r, k) : null), [small, r, k]);

  // The photo small, once.
  useEffect(() => {
    let live = true;
    void previewRaster(s.photo, s.lookup(), () => !live).then((p) => {
      if (live && p) setPic(resizeRaster(p, dw, dh, 'bilinear'));
    });
    return () => {
      live = false;
    };
  }, [s, dw, dh]);

  // Refine Edge on the small copy, where painted.
  useEffect(() => {
    if (!pic || !base || !zone) return;
    let live = true;
    void photoWorkers()
      .run({ kind: 'refine', raster: pic, mask: base, radius: Math.max(1, REFINE_EDGE_RADIUS * k) })
      .result.then((res) => {
        if (live && res.kind === 'selection')
          setRefined({ base, zone, mask: withinZone(base, res.selection, zone) });
      });
    return () => {
      live = false;
    };
  }, [pic, base, zone, k]);
  const shown =
    refined && zone && refined.base === base && refined.zone === zone ? refined.mask : base;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !pic) return;
    ctx.putImageData(compose(pic, shown, backdrop), 0, 0);
  }, [pic, shown, backdrop]);

  const paint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * dw;
    const y = ((e.clientY - rect.top) / rect.height) * dh;
    const rad = (brushSize * k) / 2;
    const dab = ellipseMask(x - rad, y - rad, x + rad, y + rad, true);
    if (dab)
      setZone((z) =>
        combineMasks(z ?? createMask({ x: 0, y: 0, width: dw, height: dh }), dab, 'add'),
      );
  };

  const ok = () => {
    setBusy(true);
    // The zone painted on the small copy, at the photo's size.
    // Only what was painted, so a large photo never takes a mask its whole size.
    const painted = zone ? trimMask(zone) : null;
    const full = painted ? scaleMask(painted, 1 / k) : null;
    void applySelectAndMask(s, r, full, output).then((refused) => {
      setBusy(false);
      if (refused) return photo.toast(refused);
      track(
        'Element',
        'Changed',
        output === 'mask' ? 'PhotoSelectAndMaskToMask' : 'PhotoSelectAndMask',
      );
      onClose();
    });
  };

  const slider = (
    label: string,
    key: keyof MaskRefine,
    min: number,
    max: number,
    unit: string,
    scale = 1,
  ) => (
    <OptionSlider
      label={label}
      value={r[key]}
      min={min}
      max={max}
      step={scale === 100 ? 0.01 : 1}
      unit={unit}
      scale={scale}
      width="w-full"
      onChange={(v) => setR((o) => ({ ...o, [key]: v }))}
    />
  );

  return (
    <Dialog open onClose={onClose} ariaLabel="Select and Mask" backdrop="desktop-light" phoneSheet>
      <DialogHeader title="Select and Mask" subtitle="Refine the selection's edge, then keep it." />
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-6 py-4">
        <canvas
          ref={canvasRef}
          width={dw}
          height={dh}
          role="img"
          aria-label={brush ? 'The selection: paint over an edge to refine it' : 'The selection'}
          onPointerDown={(e) => {
            if (!brush) return;
            painting.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            paint(e);
          }}
          onPointerMove={(e) => {
            if (brush && painting.current) paint(e);
          }}
          onPointerUp={() => {
            painting.current = false;
          }}
          className={`self-center rounded border border-slate-200 dark:border-slate-700 ${brush ? 'cursor-crosshair touch-none' : ''}`}
          style={{ width: dw, height: dh }}
        />
        <OptionChoice<Backdrop>
          label="View"
          value={backdrop}
          choices={[
            { value: 'checker', label: 'On Checkerboard' },
            { value: 'black', label: 'On Black' },
            { value: 'white', label: 'On White' },
          ]}
          onChange={setBackdrop}
        />
        {slider('Smooth', 'smooth', 0, 100, '')}
        {slider('Feather', 'feather', 0, 250, 'px')}
        {slider('Contrast', 'contrast', 0, 1, '%', 100)}
        {slider('Shift Edge', 'shiftEdge', -1, 1, '%', 100)}
        <div className="flex flex-wrap items-center gap-3">
          <OptionToggle label="Refine Edge Brush" on={brush} onChange={setBrush} />
          {brush ? (
            <OptionSlider
              label="Size"
              value={brushSize}
              min={4}
              max={400}
              unit="px"
              onChange={setBrushSize}
            />
          ) : null}
          {zone ? (
            <Button variant="ghost" size="xs" onClick={() => setZone(null)}>
              Clear Refine
            </Button>
          ) : null}
        </div>
        <OptionChoice<'selection' | 'mask'>
          label="Output To"
          value={output}
          choices={[
            { value: 'selection', label: 'Selection' },
            { value: 'mask', label: 'Layer Mask' },
          ]}
          onChange={setOutput}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={() => setR(MASK_REFINE_DEFAULTS)}>
          Reset
        </Button>
        <span className="flex-1" />
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy} onClick={ok}>
          OK
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
