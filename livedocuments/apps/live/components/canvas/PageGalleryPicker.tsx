'use client';

// Choose From My Images (docs/specs/007-editor/pages-mode.md "Image backgrounds"): a page's picture picked
// from the person's own gallery, in a popover that opens beside the panel it is pressed in (the page panel, or the
// Background popover beside the cog), so the panel stays in view. One press picks; the popover closes.
import { useState } from 'react';
import { Button } from '@livedocuments/ui';
import type { ImageSummary } from '@/lib/api-client';
import type { PickedImage } from '@/lib/upload-image';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { GalleryImageButton } from '@/components/panels/GalleryImageButton';
import { useImageGallery } from '@/hooks/ui/useImageGallery';
import { GalleryEmpty } from '@/components/panels/GalleryEmpty';

// The page panel's own width, three pictures across.
const POPOVER_WIDTH = 304;
// The panel the button sits in, which the gallery opens beside.
const HOST = '[data-anchored-popover], [data-page-panel]';

export const CHOOSE_FROM_MY_IMAGES = 'Choose From My Images';

export function PageGalleryPicker({
  ownerId,
  documentId,
  disabled,
  onPicked,
}: {
  ownerId: string;
  documentId: string;
  disabled?: boolean;
  onPicked: (image: PickedImage) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        ref={setAnchor}
        variant="secondary"
        size="xs"
        className="mt-2 w-full"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {CHOOSE_FROM_MY_IMAGES}
      </Button>
      {open && anchor ? (
        <AnchoredPopover
          anchor={anchor}
          beside={anchor.closest<HTMLElement>(HOST)}
          name="My Images"
          width={POPOVER_WIDTH}
          onClose={() => setOpen(false)}
        >
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              My Images
            </p>
            <GalleryChoices
              ownerId={ownerId}
              documentId={documentId}
              onPicked={(image) => {
                setOpen(false);
                onPicked(image);
              }}
            />
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}

function GalleryChoices({
  ownerId,
  documentId,
  onPicked,
}: {
  ownerId: string;
  documentId: string;
  onPicked: (image: PickedImage) => void;
}) {
  const { gallery, error, pick } = useImageGallery(ownerId, documentId);
  const choose = async (image: ImageSummary) => {
    const picked = await pick(image);
    if (picked) onPicked(picked);
  };
  if (error) {
    return (
      <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
        {error}
      </p>
    );
  }
  if (!gallery) {
    return (
      <ul aria-busy className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li
            key={i}
            className="aspect-square animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </ul>
    );
  }
  if (gallery.length === 0) {
    return <GalleryEmpty size="small" description="Upload one and it will show up here." />;
  }
  return (
    <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
      {gallery.map((image) => (
        <li key={image.id}>
          <GalleryImageButton
            image={image}
            ownerId={ownerId}
            documentId={documentId}
            ariaLabel={`Use ${image.originalName ?? 'image'}`}
            onClick={() => void choose(image)}
          />
        </li>
      ))}
    </ul>
  );
}
