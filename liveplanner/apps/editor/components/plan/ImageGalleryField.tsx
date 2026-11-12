'use client';

// A Several Images field in the card panel (docs/specs/026-plan/item-types.md "Image fields"): its pictures as a grid
// of square thumbnails in the field's order, each opening the picture full size; then a dashed Add Images tile that
// takes the file picker (several files at once) and a drop. Each file waits its turn and uploads as its own tile. A
// thumbnail is removed by its cross and moved by dragging it (or its grip, on a touch screen) or by Alt+← and Alt+→.
// A reader sees the pictures and opens them; adding, removing and moving are an Editor's and a Participant's.
import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import {
  IMAGE_FIELD_PICTURES_MAX,
  fieldImageIds,
  imageFieldValue,
  movedImage,
  withoutImages,
  type CustomFieldDef,
  type ItemFieldValue,
} from '@liveplanner/items';
import { Button, CloseIcon, lucideGlyph, Tooltip } from '@liveplanner/ui';
import { lucideImage, lucideImagePlus } from '@liveworkspace/icons/lucide';
import { HANDLE_TOUCH } from '@/components/primitives/useHandleReorder';
import { useGridReorder } from '@/components/primitives/useGridReorder';
import { IMAGE_ACCEPT, IMAGE_THUMB_EDGE, type ImagesScope } from '@/lib/api/images';
import { track } from '@/lib/telemetry';
import { usePlan } from './PlanContext';
import { GripIcon } from './ItemTypeFieldMenu';
import {
  imagesFullMessage,
  useImageFieldUpload,
  type PendingImage,
} from './use-image-field-upload';
import { useImageUrl, useSeen } from './use-image-url';
import { openImageWhole } from './image-open';

const AddIcon = lucideGlyph(lucideImagePlus, 18);
const BrokenIcon = lucideGlyph(lucideImage, 18);

const HINT = 'PNG, JPEG, WebP or GIF, up to 10 MB';

// The quiet round buttons over a thumbnail's corners: hidden until the tile is hovered or holds focus, always there on
// a touch screen.
const CORNER =
  'absolute flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 shadow-sm ring-1 ring-white/30 backdrop-blur-sm transition group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-reduce:transition-none pointer-coarse:h-8 pointer-coarse:w-8 pointer-coarse:opacity-100';

export function ImageGalleryField({
  id,
  itemId,
  field,
  value,
  canEdit,
  onSave,
}: {
  id: string;
  itemId: string;
  field: CustomFieldDef;
  value: ItemFieldValue | undefined;
  canEdit: boolean;
  onSave: (value: ItemFieldValue | undefined) => void;
}) {
  const plan = usePlan();
  const scope = plan?.itemsScope ?? null;
  const ids = fieldImageIds(field, value);
  const upload = useImageFieldUpload(itemId, field, canEdit);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hintId = useId();
  const [over, setOver] = useState(false);
  // The picture to keep focus on after a keyboard move (its tile is moved in the page, which can drop focus).
  const focusAfter = useRef<string | null>(null);
  const { label } = field;
  const full = ids.length + upload.pending.length >= IMAGE_FIELD_PICTURES_MAX;

  const save = (next: readonly string[]) => onSave(imageFieldValue(field, next));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    save(movedImage(ids, from, to));
    plan?.announce(`Moved to ${to + 1} of ${ids.length}`);
    track('Plan', 'Moved', 'CardImage');
  };
  const reorder = useGridReorder(ids, (picture, to) => move(ids.indexOf(picture), to));

  useEffect(() => {
    const picture = focusAfter.current;
    if (!picture) return;
    focusAfter.current = null;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-reorder-id="${CSS.escape(picture)}"] [data-thumb]`)
      ?.focus();
  }, [value]);

  const dragOver = (e: DragEvent) => {
    if (!upload.canAdd || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setOver(true);
  };
  const drop = (e: DragEvent) => {
    if (!upload.canAdd || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setOver(false);
    void upload.add(Array.from(e.dataTransfer.files));
  };

  const empty = ids.length === 0 && upload.pending.length === 0;
  if (empty && !canEdit)
    return <p className="text-[13px] text-slate-500 dark:text-slate-400">None</p>;

  const addTile = canEdit ? (
    <li className={empty ? 'col-span-full' : 'aspect-square'}>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          // Every file picked, so one that is not a picture is said rather than dropped quietly.
          void upload.add(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <Tooltip label={full ? imagesFullMessage(label) : `Add Images to ${label}`}>
        <Button
          variant="none"
          id={id}
          disabled={!upload.canAdd || full}
          aria-describedby={hintId}
          onClick={() => fileRef.current?.click()}
          className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${
            empty ? 'py-4' : ''
          } ${
            over
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
              : 'border-slate-300 bg-slate-50/60 text-slate-600 enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200'
          }`}
        >
          <span aria-hidden>
            <AddIcon />
          </span>
          <span className="text-[12px] font-medium leading-tight">Add Images</span>
          <span
            id={hintId}
            className={
              empty || upload.blocked
                ? 'text-[11px] leading-tight text-slate-500 dark:text-slate-400'
                : 'sr-only'
            }
          >
            {upload.blocked ?? HINT}
          </span>
        </Button>
      </Tooltip>
    </li>
  ) : null;

  return (
    <div
      className="@container flex flex-col gap-1.5"
      onDragOver={dragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={drop}
    >
      <ul
        ref={listRef}
        aria-label={`${label} images`}
        className={`grid grid-cols-3 gap-2 rounded-lg transition @xs:grid-cols-4 motion-reduce:transition-none ${
          over ? 'outline-dashed outline-2 outline-offset-4 outline-brand-500' : ''
        }`}
      >
        {ids.map((picture, i) => (
          <Thumbnail
            key={picture}
            imageId={picture}
            scope={scope}
            name={`${label}: image ${i + 1} of ${ids.length}`}
            removeName={`Remove image ${i + 1} from ${label}`}
            canEdit={canEdit}
            dragging={reorder.draggingId === picture}
            style={reorder.tileStyle(picture)}
            dragProps={canEdit && ids.length > 1 ? reorder.dragProps(picture) : undefined}
            onKeyDown={(e) => {
              if (!canEdit || !e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight'))
                return;
              e.preventDefault();
              const to = i + (e.key === 'ArrowLeft' ? -1 : 1);
              if (to < 0 || to >= ids.length) return;
              focusAfter.current = picture;
              move(i, to);
            }}
            onRemove={() => {
              save(withoutImages(ids, [picture]));
              plan?.announce(`Image removed from ${label}`);
              track('Plan', 'Removed', 'CardImage');
            }}
          />
        ))}
        {upload.pending.map((p) => (
          <PendingTile key={p.key} pending={p} />
        ))}
        {addTile}
      </ul>
      {upload.problems.length > 0 ? (
        <ul
          role="alert"
          className="flex flex-col gap-0.5 text-[12px] text-rose-700 dark:text-rose-300"
        >
          {upload.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Thumbnail({
  imageId,
  scope,
  name,
  removeName,
  canEdit,
  dragging,
  style,
  dragProps,
  onKeyDown,
  onRemove,
}: {
  imageId: string;
  scope: ImagesScope | null;
  // "Designs: image 2 of 5".
  name: string;
  removeName: string;
  canEdit: boolean;
  dragging: boolean;
  style: React.CSSProperties | undefined;
  dragProps: ReturnType<ReturnType<typeof useGridReorder>['dragProps']> | undefined;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
}) {
  const [ref, seen] = useSeen<HTMLLIElement>();
  const shown = useImageUrl(scope, imageId, IMAGE_THUMB_EDGE, seen);
  return (
    <li
      ref={ref}
      data-reorder-id={imageId}
      style={style}
      className={`group/tile relative aspect-square select-none overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset dark:bg-slate-800 ${
        dragging
          ? 'cursor-grabbing shadow-lg ring-2 ring-brand-500'
          : 'ring-slate-200 dark:ring-slate-700'
      }`}
    >
      <Tooltip label="Open Full Size">
        <button
          type="button"
          data-thumb
          disabled={!scope}
          aria-label={shown.state === 'missing' ? `${name}, can't be shown` : name}
          aria-roledescription={canEdit ? 'movable image' : undefined}
          onClick={() => scope && void openImageWhole(scope, imageId)}
          onKeyDown={onKeyDown}
          {...dragProps}
          className="flex h-full w-full cursor-pointer items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 disabled:cursor-default"
        >
          {shown.state === 'shown' ? (
            <img
              src={shown.url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition group-hover/tile:scale-[1.03] motion-reduce:transition-none"
              draggable={false}
            />
          ) : shown.state === 'missing' ? (
            <span aria-hidden className="text-slate-400">
              <BrokenIcon />
            </span>
          ) : (
            <span
              aria-hidden
              className="h-full w-full animate-pulse bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-700/60"
            />
          )}
        </button>
      </Tooltip>
      {canEdit ? (
        <>
          {dragProps ? (
            <span
              aria-hidden
              {...dragProps}
              className={`${CORNER} left-1 top-1 cursor-grab active:cursor-grabbing ${HANDLE_TOUCH}`}
            >
              <GripIcon />
            </span>
          ) : null}
          <Tooltip label="Remove">
            <button
              type="button"
              aria-label={removeName}
              onClick={onRemove}
              className={`${CORNER} right-1 top-1 cursor-pointer hover:bg-rose-600`}
            >
              <CloseIcon size={9} />
            </button>
          </Tooltip>
        </>
      ) : null}
    </li>
  );
}

// A file on its way, as a tile of its own: a still ring while it waits its turn, a turning one while it uploads.
function PendingTile({ pending }: { pending: PendingImage }) {
  const uploading = pending.state === 'uploading';
  return (
    <li
      aria-label={`${pending.name}, ${uploading ? 'uploading' : 'waiting to upload'}`}
      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-1.5 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={`h-6 w-6 ${uploading ? 'animate-spin motion-reduce:animate-none' : ''}`}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          strokeWidth="3"
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        {uploading ? (
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="16 41"
            className="stroke-brand-600 dark:stroke-brand-400"
          />
        ) : null}
      </svg>
      <span
        aria-hidden
        className="w-full truncate text-center text-[10px] leading-tight text-slate-500 dark:text-slate-400"
      >
        {uploading ? pending.name : 'Waiting'}
      </span>
    </li>
  );
}
