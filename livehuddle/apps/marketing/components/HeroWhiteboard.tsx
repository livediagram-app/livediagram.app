import { WHITEBOARD_COPY } from './hero-draw-copy';

// The landing hero's whiteboard wall (docs/specs/019-marketing/marketing-site.md "Hero"): the board's
// sheen and frame behind everything, and three sticky notes hung from `xl`, where the copy leaves room
// either side; below that they would meet the copy, so they never show. Decoration only.
const STICKIES = [
  {
    text: WHITEBOARD_COPY.stickies[0],
    colour: 'var(--wb-sticky-yellow)',
    place: 'left-[4%] top-24 -rotate-6',
  },
  {
    text: WHITEBOARD_COPY.stickies[1],
    colour: 'var(--wb-sticky-pink)',
    place: 'right-[4%] top-28 rotate-[5deg]',
  },
  {
    text: WHITEBOARD_COPY.stickies[2],
    colour: 'var(--wb-sticky-green)',
    place: 'left-[7%] top-[26rem] -rotate-3',
  },
] as const;

export function HeroWhiteboard() {
  return (
    <div aria-hidden className="hero-wb-board pointer-events-none absolute inset-0 overflow-hidden">
      {STICKIES.map((s) => (
        <span
          key={s.text}
          className={`hero-wb-sticky hidden xl:flex ${s.place}`}
          style={{ background: s.colour }}
        >
          {s.text}
        </span>
      ))}
    </div>
  );
}
