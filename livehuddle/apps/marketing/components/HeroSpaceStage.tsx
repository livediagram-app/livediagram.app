// The landing hero's stage (docs/specs/019-marketing/marketing-site.md "Hero"): the band is a Space's floor, the
// office furniture round its edges and the team walking about it, stopping in small groups to talk. A server
// component: the furniture is one drawing per appearance, every character a film strip of its stills from one
// sprite sheet, and the generated keyframes (app/hero-scenes/space-floor.generated.css) move them, so the hero adds
// no JavaScript. The two stylesheets are imported here, so only the page with the hero loads them.

import type { CSSProperties } from 'react';
import '../app/hero-scenes/space-floor.css';
import '../app/hero-scenes/space-floor.generated.css';
import {
  FLOOR_CAST_HREF,
  FLOOR_ONLY,
  FLOOR_STAGES,
  floorArtHref,
  type FloorStage,
  type Walker,
} from './hero-space-floor-cast';
import {
  BUBBLE_HEIGHT,
  FRAME,
  bubbleBox,
  floorClass,
  stillId,
  stillKeysOf,
  timelineOf,
} from './hero-space-floor-motion';

const stageOf = (key: FloorStage['key']) => FLOOR_STAGES.find((s) => s.key === key)!;

// Which widths a walker shows at: a wide-stage walker with a floor path of its own walks it below lg instead
// (FLOOR_ONLY, space-floor.css), so the two are never both shown.
type Shown = 'hsf-lg-only' | 'hsf-below-lg' | '';
type Placed = { stage: FloorStage; walker: Walker; shown: Shown };

/** One character: its film strip in a one-still window, its feet on the box's origin, its name chip under it. */
function Character({ stage, walker, shown }: Placed) {
  const keys = stillKeysOf(walker);
  return (
    <div className={`hsf-walker ${floorClass(stage, walker)} ${shown}`.trimEnd()}>
      <div
        className="hsf-frame"
        style={{ left: -FRAME.feetX, top: -FRAME.feetY, width: FRAME.width, height: FRAME.height }}
      >
        <svg
          className={`hsf-strip ${floorClass(stage, walker, 'strip')}`}
          width={FRAME.width * keys.length}
          height={FRAME.height}
        >
          {keys.map((key, i) => (
            <use
              key={key}
              href={`${FLOOR_CAST_HREF}#${stillId(walker, key)}`}
              x={i * FRAME.width}
              width={FRAME.width}
              height={FRAME.height}
            />
          ))}
        </svg>
      </div>
      <span className="hsf-chip">
        <span className="hsf-chip-dot" style={{ background: walker.colour }} />
        {/* The name's cap band, not its line box, sits on the chip's middle (optical-alignment.md). */}
        <span className="text-optical-line">{walker.name}</span>
      </span>
    </div>
  );
}

/** Each line the character says, in the editor's bubble look, over where it stands as it says it. */
function Bubbles({ stage, walker, shown }: Placed) {
  return timelineOf(walker)
    .filter((seg) => seg.say)
    .map((seg, i) => {
      const box = bubbleBox(stage, walker, seg);
      return (
        <div
          key={seg.say}
          className={`hsf-say ${floorClass(stage, walker, `say-${i}`)} ${shown}`.trimEnd()}
          style={
            {
              left: seg.to.x + box.left,
              top: seg.to.y + box.top,
              width: box.width,
              height: BUBBLE_HEIGHT,
              '--hsf-edge': walker.colour,
              '--hsf-tail': `${box.tail}px`,
            } as CSSProperties
          }
        >
          <span className="hsf-say-text">{seg.say}</span>
          <span className="hsf-say-name" style={{ color: walker.colour }}>
            {walker.name}
          </span>
        </div>
      );
    });
}

/**
 * A stage, 1:1 in px: the furniture, the characters further back first, then every bubble over them all. The wide
 * stage also holds its floor paths (FLOOR_ONLY), shown below lg in place of the walkers they stand in for.
 */
export function HeroSpaceFloor({
  stage: key,
  className,
}: {
  stage: Exclude<FloorStage['key'], 'floor'>;
  className: string;
}) {
  const stage = stageOf(key);
  const twins = key === 'wide' ? FLOOR_ONLY.cast : [];
  const cast: Placed[] = [
    ...stage.cast.map((walker) => ({
      stage,
      walker,
      shown: (walker.floorBeats ? 'hsf-lg-only' : '') as Shown,
    })),
    ...twins.map((walker) => ({ stage: FLOOR_ONLY, walker, shown: 'hsf-below-lg' as Shown })),
  ].sort((a, b) => a.walker.from.y - b.walker.from.y);
  return (
    <div
      aria-hidden
      className={`hsf-stage pointer-events-none select-none ${className}`}
      style={{ width: stage.width, height: stage.height }}
    >
      {/* Lazy, so only the drawing shown is fetched: a browser never fetches a lazy image that isn't rendered, and
          the other appearance's (display: none) and the other stage's (under a hidden parent) never are. */}
      <img
        src={floorArtHref(key, 'light')}
        alt=""
        width={stage.width}
        height={stage.height}
        loading="lazy"
        decoding="async"
        className="hsf-art dark:hidden"
      />
      <img
        src={floorArtHref(key, 'dark')}
        alt=""
        width={stage.width}
        height={stage.height}
        loading="lazy"
        decoding="async"
        className="hsf-art hidden dark:block"
      />
      {cast.map((placed) => (
        <Character key={`${placed.stage.key}-${placed.walker.name}`} {...placed} />
      ))}
      {cast.map((placed) => (
        <Bubbles key={`${placed.stage.key}-${placed.walker.name}`} {...placed} />
      ))}
    </div>
  );
}

/**
 * The wide stage, its foot on the band's foot and centred, from `sm` up, its floor alone below `lg` (space-floor.css);
 * a phone has its own (HeroSpacePhone).
 */
export function HeroSpaceStage() {
  return (
    <HeroSpaceFloor
      stage="wide"
      className="hsf-floor-only absolute bottom-0 left-1/2 -translate-x-1/2 max-sm:hidden"
    />
  );
}

/** The phone's stage, in the flow under the calls to action, centred, below `sm`. */
export function HeroSpacePhone() {
  return (
    <div
      className="relative mt-6 overflow-hidden sm:hidden"
      style={{ height: stageOf('phone').height }}
    >
      <HeroSpaceFloor stage="phone" className="absolute top-0 left-1/2 -translate-x-1/2" />
    </div>
  );
}
