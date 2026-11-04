// The ground every miniature in work-art draws on (work-art.tsx, work-art-spaces.tsx): the box a picture is handed,
// the paper, and the muted bar that stands in for a run of text.

export type WorkBox = { x: number; y: number; w: number; h: number };
type Box = WorkBox;

/** The box of a given width-to-height ratio, as large as fits in `box`, centred in it. */
export function fitBox(box: WorkBox, ratio: number): WorkBox {
  const w = Math.min(box.w, box.h * ratio);
  const h = w / ratio;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** A sheet of paper: white with a slate edge, the ground most pictures draw on. */
export function Paper({ x, y, w, h }: Box) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={Math.min(3, w * 0.04)}
      className="fill-white stroke-slate-200"
      strokeWidth={0.8}
    />
  );
}

/** A muted bar standing in for a run of text. */
export function Bar({ x, y, w, h, className = 'fill-slate-200' }: Box & { className?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} className={className} />;
}
