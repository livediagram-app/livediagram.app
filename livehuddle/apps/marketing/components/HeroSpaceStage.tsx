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

/** One character: its film strip in a one-still window, its feet on the box's origin, its name chip under it. */
function Character({ stage, walker }: { stage: FloorStage; walker: Walker }) {
  const keys = stillKeysOf(walker);
  return (
    <div className={`hsf-walker ${floorClass(stage, walker)}`}>
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
function Bubbles({ stage, walker }: { stage: FloorStage; walker: Walker }) {
  return timelineOf(walker)
    .filter((seg) => seg.say)
    .map((seg, i) => {
      const box = bubbleBox(stage, walker, seg);
      return (
        <div
          key={seg.say}
          className={`hsf-say ${floorClass(stage, walker, `say-${i}`)}`}
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

/** A stage, 1:1 in px: the furniture, the characters further back first, then every bubble over them all. */
export function HeroSpaceFloor({
  stage: key,
  className,
}: {
  stage: FloorStage['key'];
  className: string;
}) {
  const stage = stageOf(key);
  const cast = [...stage.cast].sort((a, b) => a.from.y - b.from.y);
  return (
    <div
      aria-hidden
      className={`hsf-stage pointer-events-none select-none ${className}`}
      style={{ width: stage.width, height: stage.height }}
    >
      <img
        src={floorArtHref(key, 'light')}
        alt=""
        width={stage.width}
        height={stage.height}
        className="hsf-art dark:hidden"
      />
      <img
        src={floorArtHref(key, 'dark')}
        alt=""
        width={stage.width}
        height={stage.height}
        className="hsf-art hidden dark:block"
      />
      {cast.map((walker) => (
        <Character key={walker.name} stage={stage} walker={walker} />
      ))}
      {cast.map((walker) => (
        <Bubbles key={walker.name} stage={stage} walker={walker} />
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
