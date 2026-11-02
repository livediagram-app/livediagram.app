'use client';

// The Background section's Image category (docs/specs/007-editor/pages-mode.md "Image
// backgrounds"): the page's picture with its credit, its Overlay, Strength and Position, then the
// image search (asking for the page's shape), Choose From My Images and Upload an Image to pick or replace it. A
// hovered result, overlay or position previews on the page; a pick, an upload or a press commits
// one edit. Not offered on a logo page (page-background-section).
import { useRef, useState, type ReactNode } from 'react';
import {
  defaultPageImageOverlay,
  pageDimensions,
  PAGE_IMAGE_OVERLAY_MAX,
  type Page,
  type PageFill,
  type PageImageFill,
  type PageImageOverlay,
  type PageImageOverlayKind,
  type PageImagePosition,
} from '@livedesign/design';
import { Button } from '@livedesign/ui';
import { ImageSearchPane } from '@/components/panels/ImageSearchPane';
import { PageGalleryPicker } from './PageGalleryPicker';
import { ImageCreditRow } from '@/components/palette/ImageCreditRow';
import { MenuSliderRow } from '@liveworkspace/workbench/components/primitives/MenuSliderRow';
import { useImageBlobUrl } from '@/hooks/persistence/useImageBlobUrl';
import { apiFetchImageBlobUrl, releaseImageBlobUrl } from '@/lib/api-client';
import { DISPLAY_EDGE_TILE } from '@liveworkspace/workbench/lib/image-display';
import type { OpenverseFilters } from '@/lib/image-search/openverse';
import { pageImageCssUrl, pageImageOverlayCss } from '@/lib/page-image-paint';
import { sampleImageTone } from '@liveworkspace/workbench/lib/page-image-tone';
import { track } from '@/lib/telemetry';
import {
  addImageFileForDesign,
  ImageUploadError,
  UPLOAD_ACCEPT_ATTR,
  type PickedImage,
} from '@/lib/upload-image';
import { useCanvasSurface } from './CanvasSurfaceContext';
import { usePageImageAccess } from './page-image-access';
import { tileClass } from './page-panel-sections';

// The Strength slider's step: 5%.
const STRENGTH_STEP = 5;

const OVERLAY_TILES: readonly { id: PageImageOverlayKind | 'none'; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'tint', label: 'Tint' },
  { id: 'fade', label: 'Fade' },
];

const POSITION_TILES: readonly { id: PageImagePosition | 'center'; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'center', label: 'Centre' },
  { id: 'bottom', label: 'Bottom' },
];

// A sample picture under each overlay tile: a sky over hills, so the wash reads.
const SAMPLE = 'linear-gradient(180deg, #7dd3fc 0%, #fde68a 55%, #4d7c0f 56%, #365314 100%)';

/** The Openverse filters a page's picture is searched with: its shape. Not `size: 'large'`: Openverse cannot
 *  render thumbnails for most of those (its thumbnail service answers 424), so every result drew broken. */
export function pageImageFilters(page: Page): OpenverseFilters {
  const { width, height } = pageDimensions(page);
  const aspectRatio = width === height ? 'square' : width > height ? 'wide' : 'tall';
  return { aspectRatio };
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {children}
    </p>
  );
}

export function ImageBackgroundChoices({
  page,
  accent,
  onPick,
  onPreview,
}: {
  page: Page;
  // The tab theme's accent: a Tint's colour.
  accent: string;
  onPick: (fill: PageFill | undefined) => void;
  // The fill to show on the page, or null to put the page back.
  onPreview: (fill: PageFill | undefined | null) => void;
}) {
  const access = usePageImageAccess();
  const dark = useCanvasSurface() === 'dark';
  const fill = page.background?.fill?.kind === 'image' ? page.background.fill : undefined;
  // What a new picture takes: the overlay and position in force, else a readable wash.
  const overlay = fill ? fill.overlay : defaultPageImageOverlay(dark);
  const [strengthDrag, setStrengthDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!access) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">Pictures are not available here.</p>
    );
  }

  // One edit: the picture with its tone, its credit (a search pick's), and the overlay in force.
  // `toneFrom`: a picture already in hand to read the tone off (a search thumbnail, the uploaded file), else the
  // stored picture is read (a gallery pick).
  const land = async (picked: PickedImage, toneFrom: string | null) => {
    const tone =
      (toneFrom ? await sampleImageTone(toneFrom) : undefined) ?? (await storedTone(picked.id));
    onPick({
      kind: 'image',
      imageId: picked.id,
      ...(tone ? { tone } : {}),
      ...(overlay ? { overlay } : {}),
      ...(fill?.position ? { position: fill.position } : {}),
      ...(picked.credit ? { credit: picked.credit } : {}),
    });
    track('Tab', 'Changed', 'PageBackgroundImage');
    setReplacing(false);
  };

  // A thumbnail that would not load: the tone from the stored picture instead.
  const storedTone = async (imageId: string): Promise<string | undefined> => {
    if (imageId.startsWith('data:')) return sampleImageTone(imageId);
    // A tile's copy is plenty for an average colour.
    const url = await apiFetchImageBlobUrl(access.ownerId, imageId, {
      designId: access.designId,
      shareCode: access.shareCode,
      maxEdge: DISPLAY_EDGE_TILE,
    }).catch(() => null);
    if (!url) return undefined;
    try {
      return await sampleImageTone(url);
    } finally {
      releaseImageBlobUrl(url);
    }
  };

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    const local = URL.createObjectURL(file);
    try {
      const { image } = await addImageFileForDesign(access.ownerId, access.designId, file);
      await land(image, local);
    } catch (e) {
      console.warn('[page] background upload failed');
      setError(e instanceof ImageUploadError ? e.message : 'Upload failed.');
    } finally {
      URL.revokeObjectURL(local);
      setBusy(false);
    }
  };

  const withOverlay = (o: PageImageOverlay | undefined): PageImageFill | undefined => {
    if (!fill) return undefined;
    const { overlay: _old, ...rest } = fill;
    void _old;
    return o ? { ...rest, overlay: o } : rest;
  };
  const overlayFor = (kind: PageImageOverlayKind | 'none'): PageImageOverlay | undefined =>
    kind === 'none'
      ? undefined
      : {
          kind,
          strength: overlay?.strength ?? defaultPageImageOverlay(dark).strength,
          ...(kind === 'tint' ? { color: overlay?.kind === 'tint' ? overlay.color! : accent } : {}),
        };
  const withPosition = (p: PageImagePosition | 'center'): PageImageFill | undefined => {
    if (!fill) return undefined;
    const { position: _old, ...rest } = fill;
    void _old;
    return p === 'center' ? rest : { ...rest, position: p };
  };
  const strength = Math.round((strengthDrag ?? overlay?.strength ?? 0) * 100);

  // The search and Upload an Image: the category's own while the page has no picture, else
  // behind Replace Image.
  const pickOrUpload = (
    <>
      <ImageSearchPane
        ownerId={access.ownerId}
        designId={access.designId}
        filters={pageImageFilters(page)}
        columns={3}
        autoFocus={false}
        onPreview={(result) =>
          onPreview(
            result
              ? {
                  kind: 'image',
                  imageId: fill?.imageId ?? 'preview',
                  preview: result.thumbnail,
                  ...(overlay ? { overlay } : {}),
                  ...(fill?.position ? { position: fill.position } : {}),
                }
              : null,
          )
        }
        onPicked={(picked, result) => {
          onPreview(null);
          void land(picked, result.thumbnail);
        }}
      />
      <PageGalleryPicker
        ownerId={access.ownerId}
        designId={access.designId}
        disabled={busy}
        onPicked={(picked) => {
          onPreview(null);
          void land(picked, null);
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept={UPLOAD_ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
      <Button
        variant="secondary"
        size="xs"
        className="mt-2 w-full"
        busy={busy}
        onClick={() => fileInput.current?.click()}
      >
        {busy ? 'Uploading…' : 'Upload an Image'}
      </Button>
      {error ? (
        <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </>
  );

  return (
    <div onPointerLeave={() => onPreview(null)}>
      {fill ? (
        <>
          <CurrentPicture fill={fill} onRemove={() => onPick(undefined)} />
          {fill.credit ? (
            <div className="-mx-3">
              <ImageCreditRow credit={fill.credit} />
            </div>
          ) : null}
          <Heading>Overlay</Heading>
          <div role="radiogroup" aria-label="Overlay" className="grid grid-cols-5 gap-1">
            {OVERLAY_TILES.map(({ id, label }) => {
              const o = overlayFor(id);
              const on = (overlay?.kind ?? 'none') === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onPick(withOverlay(o))}
                  onPointerEnter={() => onPreview(withOverlay(o))}
                  onFocus={() => onPreview(withOverlay(o))}
                  className={tileClass(on)}
                >
                  <span
                    aria-hidden
                    className="h-6 w-9 rounded-sm ring-1 ring-inset ring-slate-900/10 dark:ring-white/15"
                    style={{
                      backgroundImage: o
                        ? `${pageImageOverlayCss({ ...o, strength: Math.max(o.strength, 0.5) })}, ${SAMPLE}`
                        : SAMPLE,
                    }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
          {overlay ? (
            <div className="-mx-3 mt-1">
              <MenuSliderRow
                label="Strength"
                min={0}
                max={PAGE_IMAGE_OVERLAY_MAX * 100}
                step={STRENGTH_STEP}
                value={strength}
                display={`${strength}%`}
                onChange={(v) => {
                  setStrengthDrag(v / 100);
                  onPreview(withOverlay({ ...overlay, strength: v / 100 }));
                }}
                onRelease={() => {
                  if (strengthDrag !== null && strengthDrag !== overlay.strength)
                    onPick(withOverlay({ ...overlay, strength: strengthDrag }));
                  setStrengthDrag(null);
                }}
              />
            </div>
          ) : null}
          <Heading>Position</Heading>
          <div role="radiogroup" aria-label="Position" className="grid grid-cols-3 gap-1">
            {POSITION_TILES.map(({ id, label }) => {
              const on = (fill.position ?? 'center') === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onPick(withPosition(id))}
                  onPointerEnter={() => onPreview(withPosition(id))}
                  onFocus={() => onPreview(withPosition(id))}
                  className={tileClass(on)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {replacing ? <Heading>Replace Image</Heading> : null}
        </>
      ) : null}
      {fill && !replacing ? (
        <Button
          variant="secondary"
          size="xs"
          className="mt-3 w-full"
          onClick={() => setReplacing(true)}
        >
          Replace Image
        </Button>
      ) : (
        pickOrUpload
      )}
    </div>
  );
}

// The page's picture in a strip, with Remove.
function CurrentPicture({ fill, onRemove }: { fill: PageImageFill; onRemove: () => void }) {
  const access = usePageImageAccess();
  const state = useImageBlobUrl(access?.ownerId ?? '', fill.imageId, {
    designId: access?.designId ?? '',
    shareCode: access?.shareCode,
  });
  const url = state.status === 'ready' ? pageImageCssUrl(state.src) : null;
  return (
    <div className="flex items-center gap-2">
      <div
        data-page-picture=""
        className="h-14 min-w-0 flex-1 rounded-md bg-cover bg-center ring-1 ring-inset ring-slate-900/10 dark:ring-white/15"
        style={{
          backgroundColor: fill.tone,
          ...(url ? { backgroundImage: url } : {}),
        }}
      />
      <Button variant="secondary" size="xs" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
