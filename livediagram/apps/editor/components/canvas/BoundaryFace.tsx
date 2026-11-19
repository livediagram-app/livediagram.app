import { useMemo, useState, type ReactNode } from 'react';
import {
  PAGE_HEADING_MAX,
  boundaryLayout,
  boundaryStyleOf,
  BOUNDARY_TINT,
  BOUNDARY_TITLE_PX,
  colorWash,
  labelOn,
  type ShapeElement,
} from '@livediagram/document';
import { IconGlyph } from '@/components/primitives/icon-glyph';
import { TechIconArt } from '@/components/primitives/tech-icon-glyph';
import { InlineTextLine } from '@liveworkspace/workbench/components/canvas/InlineTextLine';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle } from '@/components/canvas/web/web-face-props';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { isTechIconId } from '@liveworkspace/workbench/lib/tech-icons';

// The title's text without its markdown marks (bold, italic, code), as it reads.
const plainLabel = (label: string) => label.replace(/[*_`~]/g, '');

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** The title's width in px, bold at the tab's size in the tab's font; null where no canvas can measure (tests). */
function measureBoldTitle(text: string, fontFamily: string | undefined): number | null {
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement('canvas').getContext('2d');
    } catch {
      measureCtx = null;
    }
  }
  if (!measureCtx) return null;
  measureCtx.font = `700 ${BOUNDARY_TITLE_PX}px ${fontFamily ?? 'system-ui, sans-serif'}`;
  return measureCtx.measureText(text).width;
}

// The boundary (docs/specs/009-elements/boundary.md): a tint under everything it holds (nested ones stack, so they
// read deeper), and its title in a tab on the top edge, inside its corner, or at its bottom-left for C4, placed by boundaryLayout (the
// export's numbers). The title is the element's ordinary label; the meta line edits in place once it is selected.
export function BoundaryFace({
  element,
  labelNode,
  accent,
  ink,
  fontFamily,
  editable,
  onSetMeta,
}: {
  element: ShapeElement;
  labelNode: ReactNode;
  accent: string;
  ink: string;
  fontFamily: string | undefined;
  editable: boolean;
  onSetMeta: (value: string) => void;
}) {
  const zoom = useCanvasZoom();
  const style = boundaryStyleOf(element);
  const icon = style !== 'c4' && element.iconId ? element.iconId : undefined;
  // The title as it is being typed (null when not editing), so the tab grows with each key rather than wrapping
  // until the edit commits.
  const [draft, setDraft] = useState<string | null>(null);
  const title = draft ?? plainLabel(element.label ?? '');
  const titleWidth = useMemo(() => measureBoldTitle(title, fontFamily), [title, fontFamily]);
  const l = boundaryLayout(element.width, element.height, {
    style,
    icon: !!icon,
    titleChars: title.length,
    meta: !!element.pageSubtitle,
    ...(titleWidth !== null ? { titleWidth } : {}),
  });
  const onTab = labelOn(accent);
  const titleColour = l.tab ? onTab : style === 'inset' ? accent : ink;
  const meta = element.pageSubtitle ?? '';
  return (
    <>
      {element.fillColor ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ borderRadius: 'inherit', backgroundColor: colorWash(accent, BOUNDARY_TINT) }}
        />
      )}
      {l.tab ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-md"
          style={{ ...rectStyle(l.tab), backgroundColor: accent }}
        />
      ) : null}
      {icon && l.icon ? (
        isTechIconId(icon) ? (
          <svg
            aria-hidden
            className="pointer-events-none absolute"
            style={rectStyle(l.icon)}
            viewBox="0 0 24 24"
          >
            <TechIconArt iconId={icon} sizePx={l.icon.width} />
          </svg>
        ) : (
          <span className="pointer-events-none absolute" style={rectStyle(l.icon)}>
            <IconGlyph iconId={icon} stroke={l.tab ? onTab : accent} />
          </span>
        )
      ) : null}
      <LabelRegion rect={l.title}>
        <div
          className="absolute inset-0"
          style={{ color: titleColour }}
          onInputCapture={(e) => setDraft((e.target as HTMLElement).textContent ?? '')}
          onBlurCapture={() => setDraft(null)}
        >
          {labelNode}
        </div>
      </LabelRegion>
      {l.meta && meta ? (
        <div className="absolute flex items-center" style={{ ...rectStyle(l.meta), fontFamily }}>
          <InlineTextLine
            value={style === 'c4' && !editable ? `[${meta}]` : meta}
            placeholder="Meta line"
            editable={editable}
            onCommit={onSetMeta}
            zoom={zoom}
            maxLength={PAGE_HEADING_MAX}
            className="truncate leading-snug"
            style={{ color: ink, fontSize: l.metaPx, opacity: 0.7 }}
            ariaLabel="Boundary meta line"
          />
        </div>
      ) : null}
    </>
  );
}
