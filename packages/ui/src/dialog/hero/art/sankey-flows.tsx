// The Flows dialog's hero art (each app's docs/specs/009-elements, the Sankey diagram): each flow moves an amount
// from one node to another, its band drawn as wide as the amount. A grid of dots fades in from the title's side; in
// the bottom right a small Sankey rises from the edge: two source nodes, three target nodes, and four ribbons
// curving between them, each as wide as what it carries, two of them crossing, the widest in the accent, the node
// it pours into ringed, its ring spreading twice. The title's side stays plain paper. The title mark is a node
// whose flow splits in two.
// Every app's Flows dialog draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/sankey-flows).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A node whose flow splits into a wide band and a narrow one, in the accent. */
export const SANKEY_FLOWS_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeLinecap="round">
    <path d="M3.5 3.5v13" strokeWidth="2.4" />
    <path d="M6.5 7.5c5 0 5-2.5 10.5-2.5" strokeWidth="3.4" strokeLinecap="butt" />
    <path d="M6.5 13.5c5 0 5 2 10.5 2" strokeWidth="1.8" strokeLinecap="butt" />
  </g>
);

// The nodes' inner edges: ribbons leave the sources at LEFT and arrive at the targets at RIGHT.
const LEFT = 7;
const RIGHT = 83;
const MID = (LEFT + RIGHT) / 2;

// A ribbon from the source span [a0, a1] to the target span [b0, b1], an S curve along each edge.
function ribbon(a0: number, a1: number, b0: number, b1: number, fill: string, opacity = 1) {
  return (
    <path
      d={`M${LEFT} ${a0}C${MID} ${a0} ${MID} ${b0} ${RIGHT} ${b0}V${b1}C${MID} ${b1} ${MID} ${a1} ${LEFT} ${a1}Z`}
      fill={fill}
      opacity={opacity}
    />
  );
}

function node(x: number, y0: number, y1: number, fill = 'var(--hero-mark)') {
  return <rect x={x} y={y0} width="4.5" height={y1 - y0} rx="1.5" fill={fill} />;
}

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    // The node's ring spreads past the box; the band still clips at its own edge.
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* The ribbons, the narrow one crossing the accent's from the top source to the bottom target. */}
    {ribbon(2, 9, 1, 8, 'var(--hero-line)')}
    {ribbon(27, 33, 29, 35, 'var(--hero-line)')}
    {ribbon(17, 27, 11, 21, 'var(--hero-accent)', 0.85)}
    {ribbon(9, 13, 25, 29, 'var(--hero-mark)', 0.7)}
    {/* The sources, then the targets; the last of each runs off the band's foot. */}
    {node(2.5, 2, 13)}
    {node(2.5, 17, 36)}
    {node(RIGHT, 1, 8)}
    {node(RIGHT, 11, 21, 'var(--hero-accent)')}
    {node(RIGHT, 25, 36)}
    {/* The node the widest flow pours into. */}
    <circle
      cx={RIGHT + 2.25}
      cy="16"
      r="7"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
  </svg>
);

export const sankeyFlowsHeroArt: HeroArt = {
  name: 'sankey-flows',
  glyph: SANKEY_FLOWS_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
