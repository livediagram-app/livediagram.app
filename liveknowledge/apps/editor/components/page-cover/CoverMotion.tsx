'use client';

// An animated cover's moving parts (docs/specs/030-knowledgebase/page-surface.md "The cover", Animated): the page
// backgrounds' own motion layer (PageMotionLayer, the parts @liveworkspace/page-background/motion-parts lays out,
// keyframes in app/motion-page.css) over the band's gradient. Kept off the main thread: every part moves by
// transform and opacity alone, on the compositor. It stops where it rests under Reduce Motion (motion-page.css),
// and pauses while the band is off screen or the browser tab is hidden: both set an attribute on the layer's box
// straight away, with no render. It lays its parts out again only when the band's width moves a bucket.
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PageMotion } from '@liveknowledge/document';
import { PageMotionLayer } from '@/components/canvas/PageMotionLayer';

// The band's width is laid out in steps of this, so a sliding tree or rail lays the parts out a handful of times,
// not on every frame of its slide.
const WIDTH_STEP = 160;
const FALLBACK = { width: 1280, height: 220 };

export function CoverMotion({
  motion,
  fill,
  bandRef,
}: {
  motion: PageMotion;
  fill: { from: string; to: string; speed?: number };
  bandRef: RefObject<HTMLDivElement | null>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(FALLBACK);
  useEffect(() => {
    const band = bandRef.current;
    const box = boxRef.current;
    if (!band || !box) return;
    let onScreen = true;
    const paint = () => {
      const paused = !onScreen || document.visibilityState === 'hidden';
      if (paused) box.setAttribute('data-cover-paused', '');
      else box.removeAttribute('data-cover-paused');
    };
    const measure = () => {
      const width = Math.max(WIDTH_STEP, Math.ceil(band.clientWidth / WIDTH_STEP) * WIDTH_STEP);
      const height = band.clientHeight || FALLBACK.height;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    measure();
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    sizes?.observe(band);
    const seen =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            onScreen = entries.some((e) => e.isIntersecting);
            paint();
          });
    seen?.observe(band);
    document.addEventListener('visibilitychange', paint);
    paint();
    return () => {
      sizes?.disconnect();
      seen?.disconnect();
      document.removeEventListener('visibilitychange', paint);
    };
  }, [bandRef]);
  return (
    <div
      ref={boxRef}
      data-cover-motion=""
      aria-hidden
      className="pointer-events-none absolute inset-0"
    >
      <PageMotionLayer motion={motion} fill={fill} width={size.width} height={size.height} />
    </div>
  );
}
