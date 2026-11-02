'use client';

// The New Photo card (docs/specs/031-photo/photo-pages.md "Making a photo page"): centred on a photo
// page that has no pixels yet, held at one screen size. Open a Picture (the image picker: Upload,
// Gallery, Search) makes the picture the photo's Background at its own size; Blank offers the preset
// sizes drawn to scale and Custom, transparent. Escape or Close leaves a blank transparent 1920 x 1080 photo.
// For someone who may edit.
import { useState } from 'react';
import { lucideImagePlus, lucideX } from '@liveworkspace/icons/lucide';
import { Button, lucideGlyph, Tooltip } from '@livedesign/ui';
import type { LaidOutPage } from '@livedesign/design';
import { PHOTO_DEFAULT_HEIGHT, PHOTO_DEFAULT_WIDTH } from '@livedesign/photo-engine';
import { ImagePicker } from '@/components/panels/ImagePicker';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { apiFetchImageBlob } from '@/lib/api/images';
import { pixelCap, sizeRefused } from '@/lib/photo-editor/image-ops';
import {
  readPicture,
  startBlank,
  startFromPicture,
  startFromPsd,
  type ReadPicture,
} from '@/lib/photo-editor/start-photo';
import { track } from '@/lib/telemetry';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { OptionToggle } from './photo-controls';

const OpenIcon = lucideGlyph(lucideImagePlus, 16);
const CloseIcon = lucideGlyph(lucideX, 14);

export const BLANK_PRESETS: readonly { name: string; width: number; height: number }[] = [
  { name: 'HD', width: 1920, height: 1080 },
  { name: '4K', width: 3840, height: 2160 },
  { name: 'Square', width: 1080, height: 1080 },
  { name: 'Portrait Post', width: 1080, height: 1350 },
  { name: 'Story', width: 1080, height: 1920 },
  { name: 'A4 Print', width: 2480, height: 3508 },
  { name: 'Icon', width: 1024, height: 1024 },
];

/** A Custom field's text as whole pixels, or null while it is not one yet (empty, zero, negative, not a number). */
export function customPixels(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Math.round(Number(text));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** The Custom size with one side set: the other side follows the held shape (width over height) under Keep Shape,
 *  and stays as it was without it. */
export function chainedSize(
  size: { width: number; height: number },
  side: 'width' | 'height',
  value: number,
  shape: number | null,
): { width: number; height: number } {
  if (shape === null) return { ...size, [side]: value };
  return side === 'width'
    ? { width: value, height: Math.max(1, Math.round(value / shape)) }
    : { width: Math.max(1, Math.round(value * shape)), height: value };
}

/** A picture read in starts the photo; a refusal or a scale-down is said. */
/** A photo just started with no tool in hand picks one up, so the next press does something: the Brush on a blank
 *  photo, the Move tool on a picture. A tool already in hand stays. */
export function readyTool(blank: boolean): void {
  if (photoTools.get().tool === null) photoTools.take(blank ? 'brush' : 'move');
}

export async function startWithPicture(photo: PhotoEditorView, read: ReadPicture): Promise<void> {
  const s = photo.session;
  if (!s) return;
  if (read.kind === 'refused') return photo.toast(read.reason);
  if (read.kind === 'psd') {
    startFromPsd(s, read);
    track('Tab', 'Imported', 'PhotoPsd');
    readyTool(false);
    return;
  }
  if (read.picture.scaled)
    photo.toast(`The picture was scaled down to fit ${pixelCap()} px a side.`);
  await startFromPicture(s, read.picture);
  track('Tab', 'Changed', 'PhotoStartedFromPicture');
  readyTool(false);
}

export function StartPhotoCard({
  page,
  photo,
  zoom,
}: {
  page: LaidOutPage;
  photo: PhotoEditorView;
  zoom: number;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const [preset, setPreset] = useState(0);
  const [custom, setCustom] = useState<{ width: number; height: number } | null>(null);
  const [chain, setChain] = useState(true);
  // What each Custom field holds while it is typed in, so it can be cleared and retyped (a field held to its number
  // read "1" the moment it was emptied, and 500 typed after it made 1500), and the shape Keep Shape holds (reading it
  // from the last pair as each key went in lost it to rounding: 3840 retyped over 1920 x 1080 made 13840 x 13840).
  const [draft, setDraft] = useState<Partial<Record<'width' | 'height', string>>>({});
  const [shape, setShape] = useState(1);
  const [picking, setPicking] = useState(false);
  const ready = photo.session?.pageId === page.id;
  const size = custom ?? BLANK_PRESETS[preset]!;
  const unfinished = Object.values(draft).some((t) => customPixels(t ?? '') === null);
  const refused = unfinished
    ? 'Enter a whole number of pixels.'
    : sizeRefused(size.width, size.height);
  const create = (w = size.width, h = size.height) => {
    if (!photo.session) return;
    startBlank(photo.session, w, h, 'transparent');
    track('Tab', 'Changed', 'PhotoStartedBlank');
    readyTool(true);
  };
  const max = Math.max(...BLANK_PRESETS.map((p) => Math.max(p.width, p.height)));
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        role="dialog"
        aria-labelledby={`start-photo-${page.id}`}
        data-start-photo=""
        className="pointer-events-auto w-[440px] max-w-[90vw] animate-fade-in rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
        style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
        onPointerDown={(e) => {
          e.stopPropagation();
          photo.press(page.id);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') create(PHOTO_DEFAULT_WIDTH, PHOTO_DEFAULT_HEIGHT);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <p
            id={`start-photo-${page.id}`}
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Start a Photo
          </p>
          <Tooltip label="Close">
            <button
              type="button"
              aria-label="Close"
              disabled={!ready}
              onClick={() => create(PHOTO_DEFAULT_WIDTH, PHOTO_DEFAULT_HEIGHT)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <CloseIcon />
            </button>
          </Tooltip>
        </div>
        <Button
          className="mt-3 w-full"
          size="sm"
          disabled={!ready}
          onClick={() => setPicking(true)}
        >
          <OpenIcon /> Open a Picture
        </Button>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Blank
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Size">
          {BLANK_PRESETS.map((p, i) => {
            const on = !custom && preset === i;
            const k = 36 / max;
            return (
              <button
                key={p.name}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${p.name}, ${p.width} by ${p.height}`}
                onClick={() => {
                  setCustom(null);
                  setDraft({});
                  setPreset(i);
                }}
                className={`flex h-16 flex-col items-center justify-end gap-1 rounded-md border p-1 text-[10px] font-medium ${
                  on
                    ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className="rounded-[2px] bg-slate-300 dark:bg-slate-600"
                  style={{ width: Math.max(6, p.width * k), height: Math.max(6, p.height * k) }}
                />
                {p.name}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={!!custom}
            onClick={() => {
              setCustom({ width: size.width, height: size.height });
              setShape(size.width / size.height);
              setDraft({});
            }}
            className={`flex h-16 items-end justify-center rounded-md border p-1 text-[10px] font-medium ${
              custom
                ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Custom
          </button>
        </div>
        {custom ? (
          <div className="mt-2 flex items-center gap-2 text-xs">
            {(['width', 'height'] as const).map((k) => (
              <label key={k} className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                {k === 'width' ? 'Width' : 'Height'}
                <input
                  type="number"
                  min={1}
                  max={pixelCap()}
                  value={draft[k] ?? custom[k]}
                  onChange={(e) => {
                    const text = e.target.value;
                    setDraft({ [k]: text });
                    const v = customPixels(text);
                    if (v === null) return;
                    setCustom(chainedSize(custom, k, v, chain ? shape : null));
                  }}
                  onBlur={() => setDraft({})}
                  className="w-20 rounded border border-slate-200 bg-white px-1.5 py-0.5 tabular-nums dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            ))}
            <OptionToggle
              label="Keep Shape"
              on={chain}
              onChange={(on) => {
                setChain(on);
                if (on) setShape(custom.width / custom.height);
              }}
            />
          </div>
        ) : null}
        {refused ? (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{refused}</p>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button size="sm" disabled={!ready || !!refused} onClick={() => create()}>
            Create
          </Button>
        </div>
      </div>
      {picking && photo.scope ? (
        <ImagePicker
          ownerId={photo.scope.ownerId}
          designId={photo.scope.designId}
          forElementId={null}
          onClose={() => setPicking(false)}
          onSelect={(img) => {
            setPicking(false);
            const scope = photo.scope!;
            void apiFetchImageBlob(scope.ownerId, img.id, {
              designId: scope.designId,
              shareCode: scope.shareCode,
            }).then(async (blob) =>
              blob
                ? startWithPicture(photo, await readPicture(blob))
                : photo.toast('That picture could not be opened.'),
            );
          }}
        />
      ) : null}
    </div>
  );
}
