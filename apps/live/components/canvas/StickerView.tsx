// A sticker on the canvas (spec/116): the die-cut plate, its shadow, and the
// emoji or badge on top, filling the element box.
//
// Deliberately thin. Every pixel comes from `stickerArt` in
// @livediagram/icons, the same builder the palette tile, the SVG / PNG / PDF
// export, the share thumbnail and the MCP render all call — a sticker that
// looked one way in the editor and another in the export would defeat the
// point of it being a sticker.
//
// No stroke, no fill, no theme tint: unlike an icon, a sticker's colours are
// its own (`supportsColours` returns false for the kind), so nothing here
// takes an element colour.

import { stickerArt, type StickerDef } from '@livediagram/icons';
import { getSticker } from '@/lib/stickers';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';

// The art in its own <svg>, sized by the caller. Shared with the palette
// tile so a sticker looks the same in the picker as on the board.
export function StickerArt({ def, className }: { def: StickerDef; className?: string }) {
  const art = stickerArt(def);
  return (
    <svg
      className={className}
      viewBox={art.viewBox}
      preserveAspectRatio="xMidYMid meet"
      // The markup is our own authored SVG from the catalogue, not user
      // content — safe to inject, the same way the Technology marks are.
      dangerouslySetInnerHTML={{ __html: art.markup }}
      aria-hidden
    />
  );
}

export function StickerView({
  stickerId,
  animClass,
}: {
  stickerId: string | undefined;
  animClass?: string;
}) {
  // The catalogue rides the async icon chunk (lib/icon-registry.ts); subscribe
  // so the sticker pops in the moment it lands.
  useIconCatalogs();
  const def = getSticker(stickerId);
  // An unknown id renders nothing rather than a guess: the element keeps its
  // box (so it stays selectable and movable) and the sticker reappears if the
  // catalogue that knows it ever loads.
  if (!def) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <StickerArt def={def} className={`h-full w-full overflow-visible ${animClass ?? ''}`} />
    </div>
  );
}
