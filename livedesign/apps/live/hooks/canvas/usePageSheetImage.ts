'use client';

// What a page sheet's picture paints from on the canvas (docs/specs/007-editor/pages-mode.md "Image backgrounds",
// Blur): undefined for a sharp picture (the sheet paints its own source), else its blurred copy, null while that
// copy is made so the tone shows. A hover preview (an Openverse thumbnail) shows sharp.
import { pageImageBlurSigma, type PageBackground } from '@livedesign/design';
import { useBlurredPageImage } from '@liveworkspace/workbench/hooks/canvas/useBlurredPageImage';
import { pageImageSrc } from '@/lib/page-image-paint';

export function usePageSheetImage(
  background: PageBackground | undefined,
  size: { width: number; height: number },
  resolveImage?: (imageId: string) => string | undefined,
): string | null | undefined {
  const fill = background?.fill?.kind === 'image' ? background.fill : undefined;
  const sigma = fill && !fill.preview ? pageImageBlurSigma(fill, size) : 0;
  const blurred = useBlurredPageImage(
    sigma > 0 && fill ? pageImageSrc(fill, resolveImage) : undefined,
    size,
    sigma,
  );
  return sigma > 0 ? blurred : undefined;
}
