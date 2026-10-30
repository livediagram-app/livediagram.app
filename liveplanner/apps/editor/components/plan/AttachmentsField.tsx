'use client';

// A card's Attachments in the card panel (docs/specs/026-plan/items.md "Attachments"): its pictures as rows (a
// thumbnail, the name, the size, a Cover tag), each opening the picture whole on a press and holding Open, Download,
// Set as Cover and Remove in its ⋯ menu; then a dashed Add Images zone that takes the file picker, a drop and a paste.
// A reader sees the rows and opens or saves them; adding and changing are an Editor's and a Participant's.
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import {
  attachmentSizeText,
  attachmentsValue,
  normaliseAttachments,
  withCover,
  withoutAttachment,
  type ItemAttachment,
  type ItemFieldValue,
} from '@liveplanner/items';
import { Tooltip, TrashIcon, lucideGlyph } from '@liveplanner/ui';
import {
  lucideDownload,
  lucideExternalLink,
  lucideImage,
  lucideImagePlus,
  lucidePanelTop,
} from '@liveworkspace/icons/lucide';
import { EllipsisTriggerButton } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { IMAGE_ACCEPT, IMAGE_ROW_EDGE, apiImageOriginal, type ImagesScope } from '@/lib/api/images';
import { track } from '@/lib/telemetry';
import { usePlan } from './PlanContext';
import { imageFilesOf, useAttachmentUpload } from './use-attachment-upload';
import { useImageUrl, useSeen } from './use-image-url';

const AddIcon = lucideGlyph(lucideImagePlus, 18);
const BrokenIcon = lucideGlyph(lucideImage, 16);
const OpenIcon = lucideGlyph(lucideExternalLink, 14);
const DownloadIcon = lucideGlyph(lucideDownload, 14);
const CoverIcon = lucideGlyph(lucidePanelTop, 14);

const NO_ATTACHMENTS: readonly ItemAttachment[] = [];

/** Whether an element takes typed text, so a paste there is text, never a picture for the card. */
export function takesText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

export function AttachmentsField({
  id,
  itemId,
  value,
  canEdit,
  onSave,
}: {
  id: string;
  itemId: string;
  value: ItemFieldValue | undefined;
  canEdit: boolean;
  onSave: (value: ItemFieldValue | undefined) => void;
}) {
  const plan = usePlan();
  const scope = plan?.itemsScope ?? null;
  const list = normaliseAttachments(value) ?? NO_ATTACHMENTS;
  const upload = useAttachmentUpload(itemId, canEdit);
  const fileRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [over, setOver] = useState(false);
  const { canAdd, add } = upload;

  // A picture pasted while the panel is open, outside a text field, joins the card.
  useEffect(() => {
    if (!canAdd) return;
    const onPaste = (e: ClipboardEvent) => {
      if (takesText(e.target)) return;
      const files = imageFilesOf(e.clipboardData?.files);
      if (files.length === 0) return;
      e.preventDefault();
      void add(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [canAdd, add]);

  const save = (next: readonly ItemAttachment[]) => onSave(attachmentsValue(next));
  const dragOver = (e: DragEvent) => {
    if (!canAdd || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setOver(true);
  };
  const drop = (e: DragEvent) => {
    if (!canAdd) return;
    e.preventDefault();
    setOver(false);
    void add(imageFilesOf(e.dataTransfer.files));
  };
  const busy = upload.uploading > 0;
  const message = upload.error;

  return (
    <div
      className="flex flex-col gap-2"
      onDragOver={dragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={drop}
    >
      {list.length > 0 ? (
        <ul
          aria-label="Attachments"
          className={`flex flex-col divide-y divide-slate-100 overflow-hidden rounded-lg ring-1 ring-inset transition dark:divide-slate-800 ${
            over ? 'ring-2 ring-brand-500' : 'ring-slate-200 dark:ring-slate-700'
          }`}
        >
          {list.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              scope={scope}
              canEdit={canEdit}
              onCover={(on) => {
                save(withCover(list, on ? a.id : null));
                if (on) track('Plan', 'Changed', 'CardCover');
              }}
              onRemove={() => {
                save(withoutAttachment(list, a.id));
                track('Plan', 'Removed', 'CardAttachment');
              }}
            />
          ))}
        </ul>
      ) : !canEdit ? (
        <p className="text-[13px] text-slate-500 dark:text-slate-400">None</p>
      ) : null}
      {canEdit ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void add(imageFilesOf(e.target.files));
              e.target.value = '';
            }}
          />
          <button
            id={id}
            type="button"
            disabled={!canAdd || busy}
            aria-describedby={hintId}
            aria-busy={busy || undefined}
            onClick={() => fileRef.current?.click()}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 disabled:cursor-not-allowed motion-reduce:transition-none pointer-coarse:min-h-11 ${
              over
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                : 'border-slate-300 bg-slate-50/60 text-slate-600 enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200'
            }`}
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-current ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
            >
              {busy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 motion-reduce:animate-none dark:border-slate-600 dark:border-t-brand-400" />
              ) : (
                <AddIcon />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-medium">
                {busy
                  ? `Uploading ${upload.uploading} ${upload.uploading === 1 ? 'Image' : 'Images'}…`
                  : 'Add Images'}
              </span>
              <span id={hintId} className="text-[11px] text-slate-500 dark:text-slate-400">
                {upload.blocked ?? 'PNG, JPEG, WebP or GIF, up to 10 MB · or paste'}
              </span>
            </span>
          </button>
        </>
      ) : null}
      {message ? (
        <p role="alert" className="text-[12px] text-rose-700 dark:text-rose-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}

// Opening or saving a picture whole. The new tab opens at once, inside the press, so the browser lets it; the
// picture fills it once read.
async function openAttachment(scope: ImagesScope, a: ItemAttachment): Promise<void> {
  const tab = window.open('', '_blank');
  const blob = await apiImageOriginal(scope, a.id);
  if (!blob) {
    tab?.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else window.open(url, '_blank');
  // Long enough for the tab to read it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function downloadAttachment(scope: ImagesScope, a: ItemAttachment): Promise<void> {
  const blob = await apiImageOriginal(scope, a.id);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = a.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function AttachmentRow({
  attachment: a,
  scope,
  canEdit,
  onCover,
  onRemove,
}: {
  attachment: ItemAttachment;
  scope: ImagesScope | null;
  canEdit: boolean;
  onCover: (on: boolean) => void;
  onRemove: () => void;
}) {
  const [ref, seen] = useSeen<HTMLLIElement>();
  const shown = useImageUrl(scope, a.id, IMAGE_ROW_EDGE, seen);
  const [open, setOpen] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const size = attachmentSizeText(a.size);
  return (
    <li
      ref={ref}
      className="group/row relative flex items-center gap-1 bg-white pr-1 dark:bg-slate-900"
    >
      <Tooltip label={`Open ${a.name}`}>
        <button
          type="button"
          disabled={!scope}
          aria-label={`Open ${a.name}, ${size}${a.cover ? ', the cover' : ''}`}
          onClick={() => scope && void openAttachment(scope, a)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-2 py-2 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/60 disabled:cursor-default motion-reduce:transition-none pointer-coarse:min-h-11 dark:hover:bg-slate-800/60"
        >
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
          >
            {shown.state === 'shown' ? (
              <img
                src={shown.url}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : shown.state === 'missing' ? (
              <BrokenIcon />
            ) : (
              <span className="h-full w-full animate-pulse bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-700/60" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
              {a.name}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {size}
              {a.cover ? (
                <span className="rounded bg-brand-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                  Cover
                </span>
              ) : null}
            </span>
          </span>
        </button>
      </Tooltip>
      <EllipsisTriggerButton
        ref={setButton}
        size="md"
        label={`More for ${a.name}`}
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && scope ? (
        <PortalMenu anchor={button} placement="below" onClose={() => setOpen(false)}>
          <MenuHeader title={a.name} />
          <MenuActionRow
            plain
            label="Open"
            icon={<OpenIcon />}
            onClick={run(() => void openAttachment(scope, a))}
          />
          <MenuActionRow
            plain
            label="Download"
            icon={<DownloadIcon />}
            onClick={run(() => void downloadAttachment(scope, a))}
          />
          {canEdit ? (
            <>
              <MenuGroupSeparator />
              <MenuActionRow
                plain
                label={a.cover ? 'Remove Cover' : 'Set as Cover'}
                icon={<CoverIcon />}
                onClick={run(() => onCover(!a.cover))}
              />
              <MenuActionRow plain label="Remove" icon={<TrashIcon />} onClick={run(onRemove)} />
            </>
          ) : null}
        </PortalMenu>
      ) : null}
    </li>
  );
}
