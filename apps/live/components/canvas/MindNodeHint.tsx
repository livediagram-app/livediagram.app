// The keyboard hint under a selected mind node (spec/118).
//
// Tab-for-child and Enter-for-sibling ARE the feature — a mind map you grow
// with the palette is just boxes and arrows. A tooltip on the palette tile is
// read once, months before it matters, so the hint sits where the work is.
//
// Counter-scaled by the canvas zoom like every other piece of selection
// chrome, so it stays legible at 30% and doesn't balloon at 300%.

export function MindNodeHint({ zoom }: { zoom: number }) {
  return (
    <div
      // Inert: it is a label, and the canvas owns every pointer event in this
      // rectangle.
      className="pointer-events-none absolute left-1/2 top-full flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
      style={{
        // translate(-50%) centres it; the zoom division keeps the chip a
        // constant on-screen size, and the 6px offset is in element space so
        // it has to be divided too.
        // 18px clears the bottom-centre resize handle, which sits on the edge
        // the chip hangs from.
        transform: `translate(-50%, ${18 / zoom}px) scale(${1 / zoom})`,
        transformOrigin: 'top center',
      }}
    >
      <Key>Tab</Key>
      <span className="opacity-70">child</span>
      <span className="opacity-40">·</span>
      <Key>Enter</Key>
      <span className="opacity-70">sibling</span>
    </div>
  );
}

function Key({ children }: { children: string }) {
  return <kbd className="rounded-[3px] bg-white/20 px-1 font-semibold leading-4">{children}</kbd>;
}
