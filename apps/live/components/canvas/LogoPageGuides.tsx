'use client';

// A logo page's construction guides (docs/specs/007-editor/logo-pages.md "Construction guides"):
// centre lines, diagonals, the safe area, the keyline circles and square and an 8 x 8 grid, drawn
// faint in canvas space, a hairline at any zoom, each part shown as the person chose and at their
// strength. A view only: never stored, never exported, taking no presses. While Mirror is on, its
// axes are drawn solid (a centre line per reflection, a spoke per radial copy). Over the artwork on a page with content; under the page's
// own cards (the layout invitation) on an empty page, which has no artwork to sit over.
import {
  logoGuides,
  mirrorAxisLines,
  type GuideLine,
  type LaidOutPage,
} from '@livediagram/document';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import { LOGO_GUIDE_ALPHA } from '@/lib/logo-guide-prefs';

// The guides' colour: a cyan that reads on paper and on a dark page alike.
const GUIDE_COLOUR = '#06b6d4';

function Line({ l, ...rest }: { l: GuideLine } & React.SVGProps<SVGLineElement>) {
  return <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} {...rest} />;
}

/** Whether a logo page's guides are drawn for this viewer: Show Guides on for the page (it is per
 *  page), an editor, and not zen, presenting or the isometric view. */
export function showsLogoGuides(view: IllustratePagesView, bare: boolean, pageId: string): boolean {
  return !bare && !!view.edit && !!view.logo?.guidesOn(pageId);
}

/** One logo page's guides, in canvas coordinates (an SVG at the origin that overflows to the page). */
export function LogoGuidesSvg({ page, tools }: { page: LaidOutPage; tools: LogoToolsView }) {
  const g = logoGuides(page.rect);
  const show = tools.guideParts;
  const mirror = tools.mirrorPages.get(page.id);
  // A centre line the mirror draws solid is not drawn faint beneath it too.
  const solidV = mirror?.axis === 'vertical' || mirror?.axis === 'both';
  const solidH = mirror?.axis === 'horizontal' || mirror?.axis === 'both';
  const alpha = LOGO_GUIDE_ALPHA[tools.guideStrength];
  const stroke = {
    stroke: GUIDE_COLOUR,
    fill: 'none',
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  return (
    <svg
      data-logo-guides={page.id}
      aria-hidden
      className="pointer-events-none absolute overflow-visible"
      style={{ left: 0, top: 0, width: 1, height: 1 }}
    >
      {show.has('grid') ? (
        <g {...stroke} strokeOpacity={alpha.grid}>
          {g.grid.map((l, i) => (
            <Line key={i} l={l} />
          ))}
        </g>
      ) : null}
      <g {...stroke} strokeOpacity={alpha.guides}>
        {show.has('centre') && !solidH ? <Line l={g.centre.h} /> : null}
        {show.has('centre') && !solidV ? <Line l={g.centre.v} /> : null}
        {show.has('diagonals') ? g.diagonals.map((l, i) => <Line key={i} l={l} />) : null}
        {show.has('safe') ? (
          <rect
            x={g.safeArea.x}
            y={g.safeArea.y}
            width={g.safeArea.width}
            height={g.safeArea.height}
            strokeDasharray="6 4"
          />
        ) : null}
        {show.has('circles') ? (
          <>
            <circle cx={g.keylineCircle.cx} cy={g.keylineCircle.cy} r={g.keylineCircle.r} />
            <circle cx={g.innerCircle.cx} cy={g.innerCircle.cy} r={g.innerCircle.r} />
          </>
        ) : null}
        {show.has('square') ? (
          <rect
            x={g.keylineSquare.x}
            y={g.keylineSquare.y}
            width={g.keylineSquare.width}
            height={g.keylineSquare.height}
          />
        ) : null}
      </g>
      {/* Mirror's axes, solid and full strength, whatever else shows. */}
      {mirror
        ? mirrorAxisLines(page.rect, mirror).map((l, i) => (
            <Line key={`m${i}`} l={l} {...stroke} strokeWidth={1.5} data-mirror-axis="" />
          ))
        : null}
    </svg>
  );
}

/** The guides of every logo page with content, over the artwork (mounted after the elements). */
export function LogoPageGuides({ view, bare }: { view: IllustratePagesView; bare: boolean }) {
  const pages = view.pages.filter(
    (p) =>
      p.kind === 'logo' && showsLogoGuides(view, bare, p.id) && view.edit!.contentCount(p.id) > 0,
  );
  if (pages.length === 0) return null;
  return (
    <>
      {pages.map((page) => (
        <LogoGuidesSvg key={page.id} page={page} tools={view.logo!} />
      ))}
    </>
  );
}
