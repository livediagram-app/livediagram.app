'use client';

// A tier's limit met by an upload (docs/specs/026-plan/item-types.md "Image fields", "With Pro on"): the kit's
// ImageLimitNotice under the control, in place of the plain line. "This Image Is Over 25 MB" with Choose Another, or
// "Image Storage Is Full" with the offer for whoever may take it. Loaded when one first shows, so the card panel and
// the form builder carry none of it until then. Nothing with Pro off: no upload error then holds a limit.
import { lazy, Suspense } from 'react';
import type { ImageLimitRefusal } from '@liveworkspace/subscription-ui/images';

const ImageLimitNotice = lazy(() =>
  import('@liveworkspace/subscription-ui').then((m) => ({ default: m.ImageLimitNotice })),
);

export function ImageUploadLimit({
  refusal,
  onChooseAnother,
  className,
}: {
  refusal: ImageLimitRefusal | null;
  // Opens the control's file picker again; offered only for a file too large.
  onChooseAnother?: () => void;
  className?: string;
}) {
  if (!refusal) return null;
  return (
    <Suspense fallback={null}>
      <ImageLimitNotice refusal={refusal} onChooseAnother={onChooseAnother} className={className} />
    </Suspense>
  );
}
