// One Space's room drawing inside an SVG scene, in the appearance in use only (docs/specs/019-marketing/marketing-site.md
// "Light and dark", Work Tracker #519). Each room is drawn twice, light and dark (public/hero/<id>-light.svg and
// -dark.svg), and a pair of SVG <image>s, one hidden by the `dark` class, fetched both: an <image> loads its href
// whether it is shown or not. So the room is a CSS background instead, on a box in a <foreignObject>: a browser
// fetches a background only for a rule that applies to a box it renders, so a page fetches the drawing for its own
// appearance, and the other one only when the appearance changes. The appearance is the `dark` class on <html>
// (docs/specs/004-interface-design/appearance.md), set before the first paint, so the right one is the first fetched.

import type { CSSProperties } from 'react';

export type RoomArtProps = {
  light: string;
  dark: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** The room drawing for the appearance in use, over the box (x, y, width, height) in the scene's coordinates. */
export function RoomArt({ light, dark, x, y, width, height }: RoomArtProps) {
  return (
    <foreignObject x={x} y={y} width={width} height={height}>
      <div
        className="size-full bg-(image:--room-light) bg-size-[100%_100%] bg-no-repeat dark:bg-(image:--room-dark)"
        style={{ '--room-light': `url(${light})`, '--room-dark': `url(${dark})` } as CSSProperties}
      />
    </foreignObject>
  );
}
