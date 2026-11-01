'use client';

// Make Sizes (docs/specs/031-photo/photo-pages.md "Making sizes"): the social formats as tiles, each the
// photo drawn in the format's shape, scaled to fill it and cropped about the centre as its new page will
// be; Custom with its own width and height; Select All and Clear; the room the tab has left. Make adds a
// new photo page for each tick in one edit, and a toast offers Export All Sizes. For an Editor who may
// add pages.
import { useEffect, useRef, useState } from 'react';
import { lucideCheck } from '@liveworkspace/icons/lucide';
import { nextPageId, type Page } from '@livedesign/design';
import { Button, DialogHeader, lucideGlyph, SOLID_BRAND_DARK, Tooltip } from '@livedesign/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { useOptionalEditorContext } from '@/app/design/[id]/EditorContext';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { useToast } from '@/hooks/ui/useToast';
import { sizeRefused } from '@/lib/photo-editor/image-ops';
import {
  makeSizes,
  PHOTO_SIZE_FORMATS,
  sizeTargets,
  sizeTicks,
  type SizeFormatId,
} from '@/lib/photo-editor/make-sizes';
import { encodePreview, previewRaster } from '@/lib/photo-editor/preview';
import { photoUploads } from '@/lib/photo-editor/upload-queue';
import { NumberField } from './PhotoSizeDialogs';
import { usePhotoPreviewUrl } from './usePhotoPreviewUrl';

const CheckIcon = lucideGlyph(lucideCheck, 12);

// The room a tile's picture is drawn in, its format scaled to fit.
const SHAPE_W = 76;
const SHAPE_H = 56;
const ROOM_FULL = 'A tab holds up to 10 photo pages.';

function SizeTile({
  name,
  width,
  height,
  on,
  disabled,
  preview,
  onToggle,
}: {
  name: string;
  width: number;
  height: number;
  on: boolean;
  disabled: boolean;
  preview: string | null;
  onToggle: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const k = Math.min(SHAPE_W / width, SHAPE_H / height);
  const tile = (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={`${name}, ${width} by ${height}`}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      className={`relative flex w-full flex-col items-center gap-1.5 rounded-lg border p-2 pt-3 text-center transition-colors ${
        on
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15'
          : 'border-slate-200 dark:border-slate-700'
      } ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : `cursor-pointer ${on ? '' : 'hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800'}`
      }`}
    >
      <span
        aria-hidden
        className={`absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${
          on
            ? `bg-brand-700 text-white ${SOLID_BRAND_DARK}`
            : 'border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
        }`}
      >
        {on ? <CheckIcon /> : null}
      </span>
      <span aria-hidden className="flex items-center justify-center" style={{ height: SHAPE_H }}>
        <span
          className="block overflow-hidden rounded-[3px] bg-slate-200 ring-1 ring-slate-900/10 dark:bg-slate-700 dark:ring-white/10"
          style={{ width: Math.max(8, width * k), height: Math.max(8, height * k) }}
        >
          {preview ? (
            // The photo filling the format, cropped about the centre: what the new page will hold.
            <img src={preview} alt="" className="h-full w-full object-cover object-center" />
          ) : null}
        </span>
      </span>
      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{name}</span>
      <span className="-mt-1 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
        {width} x {height}
      </span>
    </button>
  );
  return disabled ? <Tooltip label={ROOM_FULL}>{tile}</Tooltip> : tile;
}

export function MakeSizesDialog({
  photo,
  onClose,
}: {
  photo: PhotoEditorView;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const editor = useOptionalEditorContext();
  const toast = useToast();
  const [ticks] = useState(() => sizeTicks.get());
  const [room] = useState(photo.photoRoom);
  // Kept in order, never past the room.
  const [ticked, setTicked] = useState<ReadonlySet<SizeFormatId>>(
    () => new Set(ticks.ticked.slice(0, room)),
  );
  const [custom, setCustom] = useState(ticks.custom);
  const [busy, setBusy] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const cancelled = useRef(false);
  // Set again on every mount: React's development remount runs the cleanup once before the dialog is
  // really closed, which would otherwise stop the first Make at once.
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);
  const preview = usePhotoPreviewUrl(photo.scope, photo.tabId, s.photo.preview, (id) =>
    photo.store?.ownBlob(id),
  );
  const { width: W, height: H } = s.photo;
  const targets = sizeTargets(ticked, custom);
  const full = ticked.size >= room;
  const customRefused = ticked.has('custom') ? sizeRefused(custom.width, custom.height) : null;
  const order: SizeFormatId[] = [...PHOTO_SIZE_FORMATS.map((f) => f.id), 'custom'];
  const keep = (next: ReadonlySet<SizeFormatId>) => {
    setTicked(next);
    setFailed(null);
    sizeTicks.set({ ticked: order.filter((id) => next.has(id)), custom });
  };
  const toggle = (id: SizeFormatId) => {
    const next = new Set(ticked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    keep(next);
  };
  const setSide = (side: 'width' | 'height', v: number) => {
    const next = { ...custom, [side]: Math.max(0, Math.round(v) || 0) };
    setCustom(next);
    sizeTicks.set({ ticked: order.filter((id) => ticked.has(id)), custom: next });
  };
  const make = async () => {
    const store = photo.store;
    if (!store || !photo.addSizes || !targets.length) return;
    setBusy(0);
    const taken: Pick<Page, 'id'>[] = Object.keys(photo.photos).map((id) => ({ id }));
    const made = await makeSizes(s, targets, {
      tabId: photo.tabId,
      store,
      enqueue: (t, entries) => photoUploads.enqueue(t, entries),
      newId: () => {
        const id = nextPageId(taken as Page[]);
        taken.push({ id });
        return id;
      },
      cancelled: () => cancelled.current,
      previewRaster: (p, px) => previewRaster(p, px, () => cancelled.current),
      encodePreview,
      progress: setBusy,
    }).catch(() => null);
    if (cancelled.current) return;
    if (!made || !photo.addSizes(s.pageId, made)) {
      setBusy(null);
      setFailed('The sizes could not be made. Try again.');
      return;
    }
    const designName = editor?.designName ?? '';
    const exportAll = photo.exportAllSizes;
    toast.action({
      key: 'photo-make-sizes',
      message: `Made ${made.length} ${made.length === 1 ? 'size' : 'sizes'}.`,
      actions: exportAll
        ? [
            {
              label: 'Export All Sizes',
              onSelect: () =>
                void exportAll(designName).catch(() =>
                  toast.error('The sizes could not be exported. Try again.'),
                ),
            },
          ]
        : [],
    });
    onClose();
  };
  const n = targets.length;
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Make Sizes"
      size="lg"
      phoneSheet
      backdrop="desktop-light"
      className="flex max-h-[90vh] flex-col"
    >
      <DialogHeader
        title="Make Sizes"
        subtitle={`Now ${W} x ${H} px. Each size becomes a new photo page, the picture scaled to fill it and cropped about the centre.`}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Formats
          </p>
          <div className="flex items-center gap-1">
            <Tooltip label="Tick as many formats as the tab has room for">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy !== null || full}
                onClick={() => keep(new Set(order.slice(0, room)))}
              >
                Select All
              </Button>
            </Tooltip>
            <Tooltip label="Untick every format">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy !== null || !ticked.size}
                onClick={() => keep(new Set())}
              >
                Clear
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PHOTO_SIZE_FORMATS.map((f) => (
            <SizeTile
              key={f.id}
              name={f.name}
              width={f.width}
              height={f.height}
              on={ticked.has(f.id)}
              disabled={busy !== null || (full && !ticked.has(f.id))}
              preview={preview}
              onToggle={() => toggle(f.id)}
            />
          ))}
          <SizeTile
            name="Custom"
            width={Math.max(1, custom.width)}
            height={Math.max(1, custom.height)}
            on={ticked.has('custom')}
            disabled={busy !== null || (full && !ticked.has('custom'))}
            preview={preview}
            onToggle={() => toggle('custom')}
          />
        </div>
        {ticked.has('custom') ? (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Custom Size</p>
            <NumberField
              label="Width"
              value={custom.width}
              onChange={(v) => setSide('width', v)}
              unit="px"
            />
            <NumberField
              label="Height"
              value={custom.height}
              onChange={(v) => setSide('height', v)}
              unit="px"
            />
            {customRefused ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">{customRefused}</p>
            ) : null}
          </div>
        ) : null}
        <p
          className={`text-xs ${full ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {full
            ? `${ROOM_FULL} These ${n === 1 ? 'is' : 'are'} all that fit.`
            : `Room for ${room - n} more photo ${room - n === 1 ? 'page' : 'pages'} in this tab.`}
        </p>
        {failed ? <p className="text-xs text-rose-600 dark:text-rose-400">{failed}</p> : null}
      </div>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!n || busy !== null || !!customRefused}
          onClick={() => void make()}
        >
          {busy !== null
            ? `Making ${Math.min(busy + 1, n)} of ${n}…`
            : `Make ${n || ''} ${n === 1 ? 'Size' : 'Sizes'}`.replace('  ', ' ')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
