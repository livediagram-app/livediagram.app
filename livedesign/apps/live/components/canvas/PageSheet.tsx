'use client';

// One page's sheet on the canvas (docs/specs/007-editor/pages-mode.md): the positioned box every page part sits in,
// painted with the page's background. Its own component so a blurred picture can ask for its copy
// (usePageSheetImage) once per page; a wireframe page's screen paints in WireframeDeviceSheet instead.
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { LaidOutPage, PageBackground } from '@livedesign/design';
import { usePageSheetImage } from '@/hooks/canvas/usePageSheetImage';
import { pageSheetStyle } from '@/lib/page-paint';

export function PageSheet({
  page,
  background,
  resolveImage,
  device,
  style,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
  page: LaidOutPage;
  // The background shown (the page's, or one previewed on it).
  background: PageBackground | undefined;
  resolveImage?: (imageId: string) => string | undefined;
  // A wireframe device paints its own screen: the sheet stays bare.
  device: boolean;
  style: CSSProperties;
  children?: ReactNode;
}) {
  const imageSrc = usePageSheetImage(device ? undefined : background, page.rect, resolveImage);
  return (
    <div
      {...rest}
      style={{ ...style, ...(device ? {} : pageSheetStyle(background, resolveImage, imageSrc)) }}
    >
      {children}
    </div>
  );
}
