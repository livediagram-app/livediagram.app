'use client';

// An Image field (docs/specs/026-plan/item-types.md "Image fields"): one picture, uploaded into liveworkspace's media
// service and kept on the card as its id. The card panel's control (ImageFieldControl: a drop zone, then the picture
// with Replace and Remove) and the card face's thumbnail (ImageThumb). Both read the picture through the same cached,
// authenticated fetch (apiImageUrl), so a picture shown on a board and in its panel is fetched once.
import { useId, useRef, useState, type DragEvent } from 'react';
import type { ItemFieldValue } from '@liveplanner/items';
import { Button, lucideGlyph } from '@liveplanner/ui';
import {
  lucideImage,
  lucideImagePlus,
  lucideRefreshCw,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { IMAGE_ACCEPT, IMAGE_THUMB_EDGE, ImageUploadError, apiUploadImage } from '@/lib/api/images';
import { track } from '@/lib/telemetry';
import { usePlan } from './PlanContext';
import { useImageUrl, useSeen } from './use-image-url';

const AddIcon = lucideGlyph(lucideImagePlus, 20);
const BrokenIcon = lucideGlyph(lucideImage, 18);
const ReplaceIcon = lucideGlyph(lucideRefreshCw, 13);
const RemoveIcon = lucideGlyph(lucideTrash2, 13);

const imageIdOf = (value: ItemFieldValue | undefined): string | null =>
  typeof value === 'string' && value ? value : null;

const QUIET_BUTTON =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none pointer-coarse:h-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50';

/** The card panel's Image field: a drop zone to add a picture, or the picture with Replace and Remove. */
export function ImageFieldControl({
  id,
  label,
  value,
  disabled,
  onSave,
}: {
  id: string;
  // The field's name: the picture's accessible name is "{label}: image".
  label: string;
  value: ItemFieldValue | undefined;
  disabled: boolean;
  onSave: (value: ItemFieldValue | undefined) => void;
}) {
  const scope = usePlan()?.itemsScope;
  const imageId = imageIdOf(value);
  const shown = useImageUrl(scope, imageId);
  const fileRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [over, setOver] = useState(false);
  const canUpload = !disabled && !unavailable && !!scope;

  const upload = async (file: File | undefined) => {
    if (!file || !scope || uploading) return;
    setError(null);
    setUploading(true);
    try {
      const { image } = await apiUploadImage(scope, file);
      onSave(image.id);
      track('Plan', 'Added', 'CardImage');
    } catch (err) {
      const failure = err instanceof ImageUploadError ? err : new ImageUploadError('upload_failed');
      if (failure.code === 'images_unavailable') setUnavailable(true);
      setError(failure.message);
    } finally {
      setUploading(false);
    }
  };
  const choose = () => fileRef.current?.click();
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (canUpload) void upload(e.dataTransfer.files[0]);
  };
  const dragOver = (e: DragEvent) => {
    if (!canUpload || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setOver(true);
  };

  const picker = (
    <input
      ref={fileRef}
      type="file"
      accept={IMAGE_ACCEPT}
      className="hidden"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        void upload(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );
  const message = unavailable ? "Image uploads aren't available here." : error;

  if (!imageId) {
    if (disabled) return <p className="text-[13px] text-slate-500 dark:text-slate-400">None</p>;
    return (
      <div className="flex flex-col gap-1.5">
        {picker}
        <Button
          variant="none"
          id={id}
          disabled={!canUpload}
          busy={uploading}
          aria-describedby={hintId}
          onClick={choose}
          onDragOver={dragOver}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 disabled:cursor-not-allowed motion-reduce:transition-none ${
            over
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
              : 'border-slate-300 bg-slate-50/60 text-slate-600 enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200'
          }`}
        >
          {uploading ? (
            <span
              aria-hidden
              className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 motion-reduce:animate-none dark:border-slate-600 dark:border-t-brand-400"
            />
          ) : (
            <span aria-hidden>
              <AddIcon />
            </span>
          )}
          <span className="text-[13px] font-medium">
            {uploading ? 'Uploading…' : 'Add an Image'}
          </span>
          <span id={hintId} className="text-[11px] text-slate-500 dark:text-slate-400">
            PNG, JPEG, WebP or GIF, up to 10 MB
          </span>
        </Button>
        {message ? (
          <p role="alert" className="text-[12px] text-rose-700 dark:text-rose-300">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5" onDragOver={dragOver} onDrop={drop}>
      {picker}
      <div
        className={`relative flex h-48 items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 ${
          over ? 'ring-2 ring-brand-500' : ''
        }`}
      >
        {shown.state === 'shown' ? (
          <img
            id={id}
            src={shown.url}
            alt={`${label}: image`}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : shown.state === 'missing' ? (
          <span
            id={id}
            role="img"
            aria-label={`${label}: image`}
            className="flex flex-col items-center gap-1.5 text-slate-500 dark:text-slate-400"
          >
            <BrokenIcon />
            <span className="text-[12px]">This image can't be shown</span>
          </span>
        ) : (
          <span
            id={id}
            role="img"
            aria-label={`${label}: image, loading`}
            className="h-full w-full animate-pulse bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-700/60"
          />
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-white/75 text-[12px] font-medium text-slate-700 dark:bg-slate-900/75 dark:text-slate-200">
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 motion-reduce:animate-none"
            />
            Uploading…
          </span>
        ) : null}
      </div>
      {disabled ? null : (
        <div className="flex items-center gap-1">
          <Button
            variant="none"
            className={QUIET_BUTTON}
            disabled={!canUpload}
            busy={uploading}
            onClick={choose}
          >
            <ReplaceIcon />
            Replace
          </Button>
          <button
            type="button"
            className={QUIET_BUTTON}
            disabled={uploading}
            onClick={() => {
              setError(null);
              onSave(undefined);
            }}
          >
            <RemoveIcon />
            Remove
          </button>
        </div>
      )}
      {message ? (
        <p role="alert" className="text-[12px] text-rose-700 dark:text-rose-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** A card face's Image field: a small thumbnail, fetched once the card scrolls into view. */
export function ImageThumb({ imageId, label }: { imageId: string; label: string }) {
  const scope = usePlan()?.itemsScope;
  const [ref, seen] = useSeen<HTMLSpanElement>();
  const shown = useImageUrl(scope, imageId, IMAGE_THUMB_EDGE, seen);
  return (
    <span
      ref={ref}
      role="img"
      aria-label={label}
      className="inline-flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-200/80 text-slate-500 dark:bg-slate-700/70 dark:text-slate-400"
    >
      {shown.state === 'shown' ? (
        <img src={shown.url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : shown.state === 'missing' ? (
        <span aria-hidden className="[&_svg]:h-3 [&_svg]:w-3">
          <BrokenIcon />
        </span>
      ) : null}
    </span>
  );
}
