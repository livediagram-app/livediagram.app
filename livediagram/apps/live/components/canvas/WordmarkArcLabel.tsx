'use client';

// Arched wordmark type on the canvas (docs/specs/007-editor/logo-pages.md "Wordmark type"): the
// text along the element's arc, one line, centred on the arc's midpoint. The same geometry as the
// export (arcGeometry), at the export's size, so the canvas and every file agree.
import {
  arcGeometry,
  arcText,
  labelFontPx,
  resolvedFontWeight,
  wordmarkDisplayText,
  type TextElement,
} from '@livediagram/document';
import { useId } from 'react';
import type { LabelTextStyle } from './label-style';

export function WordmarkArcLabel({
  element,
  text,
  padding,
  fontFamily,
  style,
}: {
  element: TextElement;
  text: string;
  padding: number;
  fontFamily?: string;
  style: LabelTextStyle;
}) {
  // useId's own characters are not all safe in an href fragment.
  const id = `wm-arc-${useId().replace(/[^\w-]/g, '')}`;
  const px = labelFontPx(element.textSize) * (element.textScale ?? 1);
  const { d } = arcGeometry(
    { width: element.width, height: element.height, padding },
    element.textArc ?? 0,
    px,
  );
  const decoration = [style.underline ? 'underline' : '', style.strikethrough ? 'line-through' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width="100%"
      height="100%"
      aria-hidden
    >
      <defs>
        <path id={id} d={d} fill="none" />
      </defs>
      <text
        fontFamily={fontFamily ?? 'ui-sans-serif, system-ui, sans-serif'}
        fontSize={px}
        fontWeight={resolvedFontWeight(element)}
        fontStyle={style.italic ? 'italic' : undefined}
        textDecoration={decoration || undefined}
        letterSpacing={element.letterSpacing ? element.letterSpacing * px : undefined}
        fill="currentColor"
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {wordmarkDisplayText(arcText(text), element.textCase)}
        </textPath>
      </text>
    </svg>
  );
}
