// The Share to Community dialog's hero art (liveworkspace/docs/specs/007-community/community.md "Publishing", every
// app's alike): what you made, going up on the gallery's shelf. Faint rings spread from the top right, a spotlight;
// in the bottom right a shelf along the foot holds two cards already shown, and between them the owner's card rises
// onto it, its picture and title, an accent star on its corner, bobbing twice over the dashed place it will stand,
// motion allowing; in the bottom left a heart rises from the edge with two sparkles, the likes it will gather. The
// title mark is a sparkle. Every app's Community publish dialog is community-ui's one, so it lives here
// (@liveworkspace/ui/dialog-hero-art/community-publish).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

// A four-pointed sparkle centred on (x, y), r from its centre to each point.
function sparkle(x: number, y: number, r: number) {
  const k = r * 0.22;
  return `M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z`;
}

/** A sparkle, what the Community shows off, in the accent. */
export const COMMUNITY_PUBLISH_GLYPH = <path d={sparkle(10, 10, 7.5)} fill="var(--hero-accent)" />;

// A card on the shelf: a picture over a line of title.
function card(x: number, y: number, w: number, h: number, fill: string) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="3.5" fill={fill} stroke="var(--hero-line)" />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 10} rx="2" fill="var(--hero-wash)" />
      <rect x={x + 3} y={y + h - 5} width={w / 2} height="2" rx="1" fill="var(--hero-line)" />
    </>
  );
}

const PIECES = (
  <>
    {/* The likes it will gather: a heart rising from the edge, two sparkles over it. */}
    <svg {...HERO_SVG} width="44" height="30" viewBox="0 0 44 30" className={HERO_PLACE.bottomLeft}>
      <path
        d="M20 36C8 28 4 21.5 4 16.5A7.5 7.5 0 0 1 20 12a7.5 7.5 0 0 1 16 4.5C36 21.5 32 28 20 36Z"
        fill="var(--hero-wash)"
        stroke="var(--hero-line)"
      />
      <path d={sparkle(38, 6.5, 4.5)} fill="var(--hero-mark)" />
      <path d={sparkle(31.5, 2.75, 2.25)} fill="var(--hero-line)" />
    </svg>
    {/* The gallery's shelf: two cards shown, the owner's rising onto it between them, over the place it will stand. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      className={`${HERO_PLACE.bottomRight} overflow-visible`}
    >
      <rect x="2" y="26" width="92" height="6" rx="3" fill="var(--hero-line)" />
      {card(6, 9, 22, 17, 'var(--hero-soft)')}
      {card(70, 7, 22, 19, 'var(--hero-soft)')}
      <path
        d="M37 25.25H61"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="3 2.5"
        strokeLinecap="round"
      />
      <g className={HERO_MOTION.float}>
        {card(36, 8, 26, 16, 'var(--hero-plate)')}
        <circle cx="58" cy="12" r="4.5" fill="var(--hero-accent)" />
        <path d={sparkle(58, 12, 3)} fill="var(--hero-plate)" />
      </g>
    </svg>
  </>
);

export const communityPublishHeroArt: HeroArt = {
  name: 'community-publish',
  glyph: COMMUNITY_PUBLISH_GLYPH,
  texture: heroTexture('rings', { from: 'top-right' }),
  pieces: PIECES,
};
