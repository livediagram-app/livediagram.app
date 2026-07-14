// Excalidraw export (spec/87): serialise a Tab as a `.excalidraw` scene —
// the plain-JSON format excalidraw.com saves and opens. Pure Tab -> string,
// plugged into the Export dialog's text-panel registry beside tabToJsonText /
// tabToMarkdownText.
//
// Deliberately lossy: Excalidraw has ~8 element types, so anything without a
// counterpart degrades to a labelled box per the spec/87 degradation table.
// Labels ride as BOUND TEXT elements (containerId + a boundElements entry on
// the container) so they stay attached when edited in Excalidraw.

import {
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  endpointPosition,
  isBoxed,
  type ArrowElement,
  type ArrowheadShape,
  type BoxedElement,
  type Tab,
} from '@livediagram/diagram';

// The common Excalidraw element chassis. Excalidraw's restore() fills in
// anything missing, but emitting the everyday fields keeps the file readable
// and diff-friendly. Deterministic seeds/versions keep the output stable.
type ExcalidrawOut = Record<string, unknown>;

function chassis(
  el: BoxedElement | ArrowElement,
  seq: number,
  overrides: ExcalidrawOut,
): ExcalidrawOut {
  return {
    id: el.id,
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: Math.round((el.opacity ?? 1) * 100),
    angle: 0,
    groupIds: 'groupId' in el && el.groupId ? [el.groupId] : [],
    frameId: null,
    roundness: null,
    seed: seq + 1,
    version: 1,
    versionNonce: seq + 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: el.link?.kind === 'url' ? el.link.url : null,
    locked: !!el.locked,
    ...overrides,
  };
}

// Reverse of the import maps (spec/87).
const STROKE_WIDTH_PX = { none: 1, thin: 1, medium: 2, thick: 4, 'extra-thick': 4 } as const;
const strokeStyleOut = (s: string | undefined): string =>
  s === 'dotted' ? 'dotted' : s && s !== 'solid' ? 'dashed' : 'solid';
const FONT_SIZE_PX = { scale: 20, sm: 16, md: 20, lg: 28 } as const;
const ARROWHEAD_OUT: Record<ArrowheadShape, string> = {
  triangle: 'triangle',
  'triangle-hollow': 'triangle_outline',
  line: 'arrow',
  circle: 'dot',
  'circle-hollow': 'circle_outline',
  diamond: 'diamond',
  'diamond-hollow': 'diamond_outline',
};
const rad = (deg: number | undefined): number => (deg ? (deg * Math.PI) / 180 : 0);

export function tabToExcalidrawText(tab: Tab): string {
  const out: ExcalidrawOut[] = [];
  let seq = 0;

  // Bound-text label for a container element. The container's boundElements
  // entry is patched on by the caller.
  const labelElement = (
    host: BoxedElement | ArrowElement,
    text: string,
    box: { x: number; y: number; width: number; height: number },
    color: string,
  ): ExcalidrawOut => {
    const fontSize = FONT_SIZE_PX[('textSize' in host && host.textSize) || 'md'];
    return chassis(host, seq++, {
      id: `${host.id}-label`,
      type: 'text',
      x: box.x,
      y: box.y + Math.max(0, box.height / 2 - fontSize / 2),
      width: box.width,
      height: fontSize * 1.25,
      strokeColor: color,
      backgroundColor: 'transparent',
      text,
      originalText: text,
      fontSize,
      fontFamily: 2,
      textAlign: 'center',
      verticalAlign: 'middle',
      containerId: host.id,
      lineHeight: 1.25,
      groupIds: [],
      locked: false,
      link: null,
    });
  };

  for (const el of tab.elements.filter(isBoxed)) {
    const fill = el.fillColor ?? defaultFillColor(el);
    const stroke = el.strokeColor ?? defaultStrokeColor(el);
    // Text + annotation don't carry the border presets; they take the defaults.
    const borderWidth = 'strokeWidth' in el ? el.strokeWidth : undefined;
    const borderStyle = 'strokeStyle' in el ? el.strokeStyle : undefined;
    const base: ExcalidrawOut = {
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: rad(el.rotation),
      strokeColor: borderWidth === 'none' ? 'transparent' : stroke,
      backgroundColor: fill,
      strokeWidth: STROKE_WIDTH_PX[borderWidth ?? 'medium'],
      strokeStyle: strokeStyleOut(borderStyle),
    };

    // Freehand strokes keep their real geometry as freedraw / line points.
    if (el.type === 'freehand') {
      const pts: [number, number][] = el.points.map((p) => [p.nx * el.width, p.ny * el.height]);
      if (el.closed && pts.length > 0) pts.push([pts[0]![0], pts[0]![1]]);
      out.push(
        chassis(el, seq++, {
          ...base,
          type: el.straightEdges ? 'line' : 'freedraw',
          backgroundColor: el.closed ? fill : 'transparent',
          points: pts,
          pressures: [],
          simulatePressure: true,
          lastCommittedPoint: null,
        }),
      );
      continue;
    }

    // Silhouette per the degradation table: true ellipses and diamonds keep
    // their kind; everything else is a (possibly rounded) rectangle.
    const kind =
      (el.type === 'shape' && el.shape === 'circle') || el.type === 'annotation'
        ? 'ellipse'
        : el.type === 'shape' && el.shape === 'diamond'
          ? 'diamond'
          : 'rectangle';
    const rounded =
      kind === 'rectangle' &&
      !(el.type === 'shape' && el.shape === 'frame') &&
      ('borderRadius' in el ? el.borderRadius !== 'none' : true);

    // The label: shapes/text/stickies use `label`; images fall back to alt
    // (aliased onto label already); link cards show their cached title/URL.
    const labelText =
      el.type === 'link-card'
        ? (el.meta?.title ?? (el.link?.kind === 'url' ? el.link.url : el.label)) || undefined
        : el.label || undefined;

    if (el.type === 'text') {
      const color = el.textColor ?? defaultTextColor(el);
      const fontSize = FONT_SIZE_PX[el.textSize ?? 'md'];
      out.push(
        chassis(el, seq++, {
          ...base,
          type: 'text',
          strokeColor: color,
          backgroundColor: 'transparent',
          text: el.label ?? '',
          originalText: el.label ?? '',
          fontSize,
          fontFamily: 2,
          textAlign: el.textAlignX ?? 'left',
          verticalAlign: 'top',
          containerId: null,
          lineHeight: 1.25,
        }),
      );
      continue;
    }

    const container = chassis(el, seq++, {
      ...base,
      type: kind,
      // Frames + images export as transparent outlines, not filled boxes.
      backgroundColor:
        (el.type === 'shape' && el.shape === 'frame') || el.type === 'image' ? 'transparent' : fill,
      roundness: rounded ? { type: 3 } : null,
    });
    if (labelText) {
      const label = labelElement(el, labelText, el, el.textColor ?? defaultTextColor(el));
      container.boundElements = [{ id: label.id, type: 'text' }];
      out.push(container, label);
    } else {
      out.push(container);
    }
  }

  // Arrows after the boxes (paint order), with bindings for pinned ends.
  const boundArrowRefs = new Map<string, { id: string; type: string }[]>();
  for (const el of tab.elements) {
    if (el.type !== 'arrow') continue;
    const from = endpointPosition(el.from, tab.elements);
    const to = endpointPosition(el.to, tab.elements);

    // Bends: curved control points (deltas from the chord midpoint) and the
    // angled elbow flatten into the point list — Excalidraw arrows are
    // polylines, so the bend positions carry even though the smoothing won't.
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const bends: { x: number; y: number }[] = [];
    if (el.arrowStyle === 'curved') {
      const cps = el.curvePoints?.length ? el.curvePoints : el.curveOffset ? [el.curveOffset] : [];
      for (const cp of cps) bends.push({ x: mid.x + cp.dx, y: mid.y + cp.dy });
    } else if (el.arrowStyle === 'angled') {
      bends.push({
        x: to.x + (el.elbowOffset?.dx ?? 0),
        y: from.y + (el.elbowOffset?.dy ?? 0),
      });
    }
    const points: [number, number][] = [
      [0, 0],
      ...bends.map((b): [number, number] => [b.x - from.x, b.y - from.y]),
      [to.x - from.x, to.y - from.y],
    ];

    const binding = (end: ArrowElement['from']) =>
      end.kind === 'pinned' ? { elementId: end.elementId, focus: 0, gap: 4 } : null;
    const startBinding = binding(el.from);
    const endBinding = binding(el.to);

    const ends = el.arrowEnds ?? 'to';
    const head = ARROWHEAD_OUT[el.arrowheadShape ?? 'triangle'] ?? 'arrow';
    const arrowOut = chassis(el, seq++, {
      type: 'arrow',
      x: from.x,
      y: from.y,
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
      strokeColor: el.strokeColor ?? '#64748b',
      backgroundColor: 'transparent',
      strokeWidth: el.strokeWidth ?? 2,
      strokeStyle: strokeStyleOut(el.strokeStyle),
      points,
      lastCommittedPoint: null,
      startBinding,
      endBinding,
      startArrowhead: ends === 'from' || ends === 'both' ? head : null,
      endArrowhead: ends === 'to' || ends === 'both' ? head : null,
      elbowed: el.arrowStyle === 'angled',
    });

    if (el.label) {
      const label = labelElement(
        el,
        el.label,
        { x: mid.x - 40, y: mid.y - 12, width: 80, height: 24 },
        el.textColor ?? el.strokeColor ?? '#64748b',
      );
      arrowOut.boundElements = [{ id: label.id, type: 'text' }];
      out.push(arrowOut, label);
    } else {
      out.push(arrowOut);
    }

    // Excalidraw also records the arrow on each bound box's boundElements,
    // so rebinding keeps working when the file is edited over there.
    for (const b of [startBinding, endBinding]) {
      if (!b) continue;
      const refs = boundArrowRefs.get(b.elementId) ?? [];
      refs.push({ id: el.id, type: 'arrow' });
      boundArrowRefs.set(b.elementId, refs);
    }
  }
  for (const o of out) {
    const refs = boundArrowRefs.get(o.id as string);
    if (refs) {
      o.boundElements = [...((o.boundElements as { id: string; type: string }[]) ?? []), ...refs];
    }
  }

  return JSON.stringify(
    {
      type: 'excalidraw',
      version: 2,
      source: 'https://livediagram.app',
      elements: out,
      appState: {
        gridSize: null,
        viewBackgroundColor: tab.backgroundColor ?? '#ffffff',
      },
      files: {},
    },
    null,
    2,
  );
}
