// Builders for SYNTHESISED Microsoft Whiteboard exports, mimicking the markup
// read from Whiteboard's shipped bundle (docs/research/migration-readiness.md
// E-5): the export wrapper, `#canvasContent`, one anchor per board item, ink as
// `g.inkStroke` outline paths plus the hidden centreline polyline. Where the
// bundle does not say (the wrapper's class, the background element), the
// builders pick a plausible stand-in; real exports replace these (E-C1).

export type Pt = { x: number; y: number };

const r = (n: number) => Math.round(n * 100) / 100;

/** A stroke's filled outline, as Whiteboard renders ink: left side out, right side back, round caps. */
export function strokeOutline(points: Pt[], width: number): string {
  const half = width / 2;
  const normals = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(points.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  });
  const left = points.map((p, i) => ({
    x: p.x + normals[i]!.x * half,
    y: p.y + normals[i]!.y * half,
  }));
  const right = points.map((p, i) => ({
    x: p.x - normals[i]!.x * half,
    y: p.y - normals[i]!.y * half,
  }));
  const last = right.at(-1)!;
  const first = left[0]!;
  return (
    `M${r(first.x)},${r(first.y)}` +
    left
      .slice(1)
      .map((p) => `L${r(p.x)},${r(p.y)}`)
      .join('') +
    `A${r(half)},${r(half)} 0 0 1 ${r(last.x)},${r(last.y)}` +
    right
      .slice(0, -1)
      .reverse()
      .map((p) => `L${r(p.x)},${r(p.y)}`)
      .join('') +
    `A${r(half)},${r(half)} 0 0 1 ${r(first.x)},${r(first.y)}Z`
  );
}

export type StrokeSpec = {
  points: Pt[];
  width: number;
  rgba: [number, number, number, number];
  highlighter?: boolean;
  /** Leave the hit-test polyline empty, as Whiteboard does for wide strokes. */
  noCentreline?: boolean;
  /** An SVG transform on the stroke group. */
  transform?: string;
};

export function inkStroke(id: string, s: StrokeSpec): string {
  const [red, green, blue, alpha] = s.rgba;
  const style = s.highlighter ? ' style="mix-blend-mode: darken;"' : '';
  const transform = s.transform ? ` transform="${s.transform}"` : '';
  const points = s.noCentreline
    ? ''
    : s.points.map((p) => `${Math.round(p.x)},${Math.round(p.y)} `).join('');
  return (
    `<g class="inkStroke interactive" id="${id}"${transform}${style}>` +
    `<path d="${strokeOutline(s.points, s.width)}" fill="rgba(${red},${green},${blue},${alpha})"></path>` +
    `<polyline class="inkHitTestOverlay" stroke-linecap="round" stroke-width="16" points="${points}"></polyline>` +
    `</g>`
  );
}

export type AnchorSpec = {
  apikey: string;
  type?: string;
  left: number;
  top: number;
  transform?: string;
  content: string;
};

export function anchor(a: AnchorSpec): string {
  const type = a.type ? ` data-whiteboard-type="${a.type}"` : '';
  const transform = a.transform ? ` transform: ${a.transform};` : '';
  return (
    `<div class="anchor canvasChildElement align topLeft"${type} data-apikey="${a.apikey}"` +
    ` style="left: ${a.left}px; top: ${a.top}px;${transform}">` +
    `<div id="${a.apikey}-child" class="canvasChild selectCursor">${a.content}</div></div>`
  );
}

export function inkGroup(strokes: string[], size = { width: 400, height: 300 }): string {
  return (
    `<svg class="canvasChild" width="${size.width}" height="${size.height}"` +
    ` style="position: absolute; top: 0; left: 0; overflow: visible;">${strokes.join('')}</svg>`
  );
}

export function boardHtml(anchors: string[], opts: { background?: string } = {}): string {
  const background = opts.background ?? '#ffffff';
  return `<html>
<head>
<meta charSet="utf-8" />
<meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
<style>.anchor { position: absolute; transform-origin: 0 0; }</style>
</head>
<body style="overflow: auto;">
<div class="exportedCanvas" style="transform: translate(24px, 18px) scale(0.5);">
<svg class="canvasBackground" version="1.1" xmlns="http://www.w3.org/2000/svg" style="z-index: -2; width: max(2050px, 300vw); height: max(1650px, 300vh);">
\t<rect class="backgroundFill" width="100%" height="100%" fill="${background}"></rect>
</svg>
<div id="canvasContent" class="canvasContent">${anchors.join('')}</div>
</div>
</body>
</html>`;
}
