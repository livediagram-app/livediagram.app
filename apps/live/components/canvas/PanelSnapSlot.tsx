// The live drop target for panel docking (spec/63). Rendered as the LAST
// flex child of the candidate corner's stack container while a panel is
// being dragged, so flexbox lays it out exactly where the released panel
// will land — below any panel already in a top corner, above one in a
// bottom corner, with the same gap — instead of a fixed box at the bare
// corner that overlapped whatever was already there. Its height mirrors
// the dragged panel so it previews the real footprint; width matches the
// panels (w-64).
export function PanelSnapSlot({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      style={{ height: Math.max(height, 48) }}
      className="pointer-events-none w-64 max-w-[calc(100vw-2rem)] shrink-0 rounded-lg border-2 border-dashed border-brand-500 bg-brand-500/10 transition-[height] duration-150 dark:border-brand-400 dark:bg-brand-400/10"
    />
  );
}
