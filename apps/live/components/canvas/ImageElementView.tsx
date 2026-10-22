'use client';

import { memo, useMemo } from 'react';
import { imageCornerPx, type ImageElement } from '@liveplanner/document';
import { useElementFinish } from '@/components/canvas/CanvasFinishContext';
import { useCanvasTheme, useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { ImageEmptyFace } from '@/components/canvas/ImageEmptyFace';
import {
  imagePlaceholderTone,
  placeholderThemeInk,
} from '@/components/canvas/image-placeholder-look';

// An ImageElement on the canvas. Pictures are never uploaded, so every image element (a template's
// placeholder) draws its empty face. Mounted inside BoxedElementView's transformed wrapper so it
// picks up the element's pan + zoom for free.
//
// Wrapped in React.memo at the export below: every prop is a primitive or a reference-stable
// element object, so the shallow equality check skips re-renders when only an unrelated element
// or selection flag changed on the surrounding tab.
type ImageElementViewProps = {
  element: ImageElement;
  // The element's resolved font stack (its own, else the tab's theme font): the placeholder's
  // words are set in it, as its page's text is. Undefined falls back to the app's sans.
  fontFamily?: string;
};

function ImageElementViewImpl({ element, fontFamily }: ImageElementViewProps) {
  // Corner radius follows the element's borderRadius so a circular avatar ('full' → clamped to
  // 50%) and a rounded hero ('lg') clip correctly. Never more than a quarter of the shorter side
  // (docs/specs/008-canvas/corner-radius.md); square by default under Professional
  // (docs/specs/008-canvas/finish.md "Images").
  const radius = imageCornerPx(element, useElementFinish(undefined));
  // The paper under the element (the canvas), never the app's chrome: a light canvas in dark chrome
  // keeps dark ink.
  const surface = useCanvasSurface();
  // Dressed in the tab's theme where it has colours of its own, kept legible on this paper.
  const theme = useCanvasTheme();
  const tone = useMemo(
    () => imagePlaceholderTone(surface, theme ? placeholderThemeInk(theme) : null),
    [surface, theme],
  );
  return (
    <ImageEmptyFace
      width={element.width}
      height={element.height}
      round={element.borderRadius === 'full'}
      tone={tone}
      surface={surface}
      radius={radius}
      fontFamily={fontFamily}
    />
  );
}

export const ImageElementView = memo(ImageElementViewImpl);
