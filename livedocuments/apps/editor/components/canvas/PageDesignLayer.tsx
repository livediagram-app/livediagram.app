'use client';

// A page's design (docs/specs/011-theme/page-designs.md): decoration drawn over the page's background and under
// everything on it, never selectable (aria-hidden, no pointer events). Each layer is one SVG of markup the design
// drew (builder markup, ours alone); a moving layer moves by transform or opacity (app/page-design.css). The root
// carries the intensity and the calm mask; the scrims sit apart, full strength, under the texts they serve. A moving
// design runs only while its page is on screen.
import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { builtMarkup, htmlProps } from '@livedocuments/ui';
import { calmMaskCss, grainLayerSvg, scrimsSvg, type DesignLayer } from '@livedocuments/document';
import type { PageDesignView } from '@/lib/page-design-views';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

// How far past the screen a page counts as on screen, so its motion is running as it scrolls in.
const RUN_MARGIN = '200px';

const svgOf = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">${body}</svg>`;

function motionStyle(layer: DesignLayer): Vars | undefined {
  const m = layer.motion;
  if (!m) return undefined;
  return {
    '--pd-d': `${m.seconds}s`,
    ...(m.x !== undefined ? { '--pd-x': `${m.x}px` } : {}),
    ...(m.y !== undefined ? { '--pd-y': `${m.y}px` } : {}),
    ...(m.scale !== undefined ? { '--pd-s': m.scale } : {}),
    ...(m.turn !== undefined ? { '--pd-r': `${m.turn}deg` } : {}),
    ...(m.origin ? { '--pd-ox': `${m.origin[0]}px`, '--pd-oy': `${m.origin[1]}px` } : {}),
  };
}

export const PageDesignLayer = memo(function PageDesignLayer({
  view,
  scope,
}: {
  view: PageDesignView;
  // Keeps this page's ids apart from another page's drawing of the same design.
  scope: string;
}) {
  const { painted: d, scrims } = view;
  const root = useRef<HTMLDivElement>(null);
  const uid = `${scope}-${d.uid}`;
  const layers = useMemo(
    () =>
      d.layers.map((l) => ({
        markup: builtMarkup(
          svgOf(d.width, d.height, (l.defs ?? '') + l.svg.replaceAll(d.uid, uid)),
        ),
        motion: d.animate ? l.motion : undefined,
        style: d.animate ? motionStyle(l) : undefined,
      })),
    [d, uid],
  );
  const grain = useMemo(() => {
    const svg = grainLayerSvg(d);
    return svg ? builtMarkup(svgOf(d.width, d.height, svg.replaceAll(d.uid, uid))) : null;
  }, [d, uid]);
  const plates = useMemo(
    () => (scrims.length ? builtMarkup(svgOf(d.width, d.height, scrimsSvg(scrims))) : null),
    [scrims, d.width, d.height],
  );
  // Only a moving design watches whether its page is on screen.
  useEffect(() => {
    const el = root.current;
    if (!el || !d.animate) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.setAttribute('data-pd-run', '');
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) el.setAttribute('data-pd-run', '');
        else el.removeAttribute('data-pd-run');
      },
      { rootMargin: RUN_MARGIN },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.removeAttribute('data-pd-run');
    };
  }, [d.animate]);
  const mask = calmMaskCss(d.calm);
  return (
    <>
      <div
        ref={root}
        aria-hidden
        data-page-design={d.id}
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={
          {
            opacity: d.intensity,
            ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : {}),
            '--pd-rate': d.speed,
          } as Vars
        }
      >
        {layers.map((l, i) => (
          <div
            key={i}
            className={l.motion ? `pd-layer pd-${l.motion.kind}` : 'pd-layer'}
            style={l.style}
            {...htmlProps(l.markup)}
          />
        ))}
        {grain ? <div className="pd-layer" {...htmlProps(grain)} /> : null}
      </div>
      {plates ? (
        <div
          aria-hidden
          data-page-design-scrims={scrims.length}
          className="pointer-events-none absolute inset-0"
          {...htmlProps(plates)}
        />
      ) : null}
    </>
  );
});
