// The Avatar sprite from the neck up (spec/101): hair drawn per facing, the
// three head views, and the hoodie's hood that sits behind them.
//
// Split from avatar-sprite.tsx because hair is where the combinations live.
// Eight styles times three facings is most of what the sprite draws, and none
// of it is referenced by the body: the head reads the palette and nothing
// else, so it moves as a piece.

import type { AvatarConfig } from '@/lib/avatar-config';
import { EYE, HAIR, HAIR_DARK, SKIN, SKIN_DARK } from '@/components/canvas/avatar-sprite-palette';

// --- Head + hair ------------------------------------------------------------

// Hair, front view. Each style is a few rects over the scalp; `bald` draws
// nothing but the crown shading, and `mohawk` shaves the sides back to skin.
function HairFront({ hair }: { hair: AvatarConfig['hair'] }) {
  if (hair === 'bald') return <rect x={4} y={1} width={8} height={1} fill={SKIN_DARK} />;
  if (hair === 'mohawk') {
    return (
      <g>
        {/* a crest up the middle, sides shaved to stubble */}
        <rect x={4} y={1} width={8} height={1} fill={SKIN_DARK} />
        <rect x={7} y={-3} width={2} height={5} fill={HAIR} />
        <rect x={8} y={-3} width={1} height={5} fill={HAIR_DARK} />
      </g>
    );
  }
  if (hair === 'buzz') {
    // A close crop: one row, hugging the skull.
    return (
      <g>
        <rect x={4} y={0} width={8} height={2} fill={HAIR} />
        <rect x={10} y={0} width={2} height={2} fill={HAIR_DARK} />
      </g>
    );
  }
  if (hair === 'spiky') {
    // Points above the hairline rather than a rounded crown.
    return (
      <g>
        <rect x={3} y={0} width={10} height={2} fill={HAIR} />
        <rect x={11} y={0} width={2} height={2} fill={HAIR_DARK} />
        <rect x={4} y={-2} width={1} height={2} fill={HAIR} />
        <rect x={6} y={-3} width={1} height={3} fill={HAIR} />
        <rect x={8} y={-2} width={1} height={2} fill={HAIR} />
        <rect x={10} y={-3} width={1} height={3} fill={HAIR_DARK} />
      </g>
    );
  }
  if (hair === 'afro') {
    // A tall round halo, wider than the head on both sides.
    return (
      <g>
        <rect x={2} y={-3} width={12} height={5} fill={HAIR} />
        <rect x={1} y={-1} width={1} height={4} fill={HAIR} />
        <rect x={14} y={-1} width={1} height={4} fill={HAIR_DARK} />
        <rect x={11} y={-3} width={3} height={5} fill={HAIR_DARK} />
      </g>
    );
  }
  return (
    <g>
      <rect x={3} y={0} width={10} height={3} fill={HAIR} />
      {hair === 'short' ? (
        <>
          <rect x={3} y={3} width={2} height={3} fill={HAIR_DARK} />
          <rect x={11} y={3} width={2} height={3} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'curly' ? (
        <>
          {/* bumps along the crown, plus curls at the temples */}
          <rect x={3} y={-1} width={2} height={1} fill={HAIR} />
          <rect x={7} y={-2} width={2} height={2} fill={HAIR} />
          <rect x={11} y={-1} width={2} height={1} fill={HAIR_DARK} />
          <rect x={2} y={2} width={2} height={3} fill={HAIR} />
          <rect x={12} y={2} width={2} height={3} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'long' ? (
        <>
          <rect x={2} y={2} width={2} height={9} fill={HAIR} />
          <rect x={12} y={2} width={2} height={9} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'bun' ? (
        <>
          {/* a knot on top, hair gathered back at the sides */}
          <rect x={6} y={-3} width={4} height={3} fill={HAIR} />
          <rect x={9} y={-3} width={1} height={3} fill={HAIR_DARK} />
          <rect x={3} y={3} width={1} height={3} fill={HAIR_DARK} />
          <rect x={12} y={3} width={1} height={3} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'ponytail' ? (
        <>
          <rect x={3} y={3} width={1} height={3} fill={HAIR_DARK} />
          <rect x={12} y={3} width={1} height={3} fill={HAIR_DARK} />
          {/* the tail, gathered high on the right */}
          <rect x={13} y={2} width={2} height={2} fill={HAIR} />
          <rect x={14} y={4} width={2} height={4} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'pigtails' ? (
        <>
          {/* a bunch either side, level with the ears */}
          <rect x={1} y={2} width={2} height={4} fill={HAIR} />
          <rect x={13} y={2} width={2} height={4} fill={HAIR_DARK} />
          <rect x={3} y={3} width={1} height={2} fill={HAIR} />
          <rect x={12} y={3} width={1} height={2} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'bob' ? (
        <>
          {/* a blunt chin-length cut, straight sides */}
          <rect x={2} y={2} width={2} height={5} fill={HAIR} />
          <rect x={12} y={2} width={2} height={5} fill={HAIR_DARK} />
          <rect x={2} y={6} width={12} height={1} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'braid' ? (
        <>
          {/* a single plait down one side, drawn as linked segments */}
          <rect x={3} y={3} width={1} height={3} fill={HAIR_DARK} />
          <rect x={12} y={3} width={2} height={3} fill={HAIR} />
          <rect x={13} y={6} width={2} height={2} fill={HAIR_DARK} />
          <rect x={13} y={9} width={2} height={2} fill={HAIR} />
        </>
      ) : null}
      {hair === 'topknot' ? (
        <>
          {/* shaved-ish sides with a knot pulled high */}
          <rect x={7} y={-4} width={3} height={3} fill={HAIR} />
          <rect x={9} y={-4} width={1} height={3} fill={HAIR_DARK} />
          <rect x={7} y={-1} width={2} height={1} fill={HAIR_DARK} />
        </>
      ) : null}
    </g>
  );
}

// Facing the viewer: face, eyes, a mouth pixel. The female build gets a
// slightly softer jaw (one pixel narrower at the chin).
export function HeadFront({
  gender,
  hair,
}: {
  gender: AvatarConfig['gender'];
  hair: AvatarConfig['hair'];
}) {
  return (
    <g>
      <rect x={4} y={1} width={8} height={8} fill={SKIN} />
      <rect x={10} y={1} width={2} height={8} fill={SKIN_DARK} />
      {gender === 'female' ? <rect x={4} y={8} width={1} height={1} fill={SKIN_DARK} /> : null}
      <HairFront hair={hair} />
      <rect x={6} y={5} width={1} height={1} fill={EYE} />
      <rect x={9} y={5} width={1} height={1} fill={EYE} />
      <rect x={7} y={7} width={2} height={1} fill={SKIN_DARK} />
    </g>
  );
}

// Walking away: the back of the head, no face. Long hair, a bun, and a tail
// read most clearly from here.
export function HeadBack({ hair }: { hair: AvatarConfig['hair'] }) {
  return (
    <g>
      <rect x={4} y={1} width={8} height={8} fill={SKIN_DARK} />
      {hair === 'bald' ? null : hair === 'mohawk' ? (
        <>
          <rect x={7} y={-3} width={2} height={9} fill={HAIR} />
          <rect x={8} y={-3} width={1} height={9} fill={HAIR_DARK} />
        </>
      ) : hair === 'buzz' ? (
        <>
          <rect x={4} y={0} width={8} height={5} fill={HAIR} />
          <rect x={10} y={0} width={2} height={5} fill={HAIR_DARK} />
        </>
      ) : (
        <>
          <rect x={3} y={0} width={10} height={7} fill={HAIR} />
          <rect x={11} y={0} width={2} height={7} fill={HAIR_DARK} />
          {hair === 'curly' ? (
            <>
              <rect x={3} y={-1} width={2} height={1} fill={HAIR} />
              <rect x={7} y={-2} width={2} height={2} fill={HAIR} />
              <rect x={11} y={-1} width={2} height={1} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'long' ? <rect x={3} y={5} width={10} height={6} fill={HAIR} /> : null}
          {hair === 'bun' ? <rect x={6} y={-3} width={4} height={3} fill={HAIR} /> : null}
          {hair === 'ponytail' ? <rect x={6} y={6} width={4} height={6} fill={HAIR_DARK} /> : null}
          {hair === 'pigtails' ? (
            <>
              <rect x={1} y={2} width={2} height={5} fill={HAIR} />
              <rect x={13} y={2} width={2} height={5} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'afro' ? (
            <>
              <rect x={2} y={-3} width={12} height={4} fill={HAIR} />
              <rect x={11} y={-3} width={3} height={4} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'spiky' ? (
            <>
              <rect x={4} y={-2} width={1} height={2} fill={HAIR} />
              <rect x={6} y={-3} width={1} height={3} fill={HAIR} />
              <rect x={8} y={-2} width={1} height={2} fill={HAIR} />
              <rect x={10} y={-3} width={1} height={3} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'bob' ? <rect x={3} y={5} width={10} height={3} fill={HAIR} /> : null}
          {hair === 'braid' ? (
            <>
              <rect x={7} y={6} width={2} height={2} fill={HAIR} />
              <rect x={7} y={9} width={2} height={2} fill={HAIR_DARK} />
              <rect x={7} y={12} width={2} height={2} fill={HAIR} />
            </>
          ) : null}
          {hair === 'topknot' ? <rect x={6} y={-4} width={4} height={3} fill={HAIR} /> : null}
        </>
      )}
      <rect x={5} y={7} width={6} height={1} fill={SKIN_DARK} />
    </g>
  );
}

// Profile (drawn facing LEFT; the right-facing sprite mirrors this one).
export function HeadProfile({ hair }: { hair: AvatarConfig['hair'] }) {
  return (
    <g>
      <rect x={4} y={1} width={7} height={8} fill={SKIN} />
      {/* Nose pixel */}
      <rect x={3} y={5} width={1} height={2} fill={SKIN} />
      {hair === 'bald' ? null : hair === 'mohawk' ? (
        <>
          <rect x={6} y={-3} width={4} height={4} fill={HAIR} />
          <rect x={9} y={-3} width={1} height={4} fill={HAIR_DARK} />
        </>
      ) : hair === 'buzz' ? (
        <>
          <rect x={4} y={0} width={9} height={2} fill={HAIR} />
          <rect x={10} y={2} width={3} height={3} fill={HAIR_DARK} />
        </>
      ) : (
        <>
          <rect x={4} y={0} width={9} height={3} fill={HAIR} />
          <rect x={9} y={3} width={4} height={5} fill={HAIR} />
          <rect x={11} y={3} width={2} height={5} fill={HAIR_DARK} />
          {hair === 'curly' ? (
            <>
              <rect x={5} y={-1} width={2} height={1} fill={HAIR} />
              <rect x={9} y={-2} width={3} height={2} fill={HAIR} />
            </>
          ) : null}
          {hair === 'long' ? <rect x={9} y={7} width={4} height={5} fill={HAIR} /> : null}
          {hair === 'bun' ? <rect x={11} y={-2} width={4} height={3} fill={HAIR} /> : null}
          {hair === 'ponytail' ? <rect x={12} y={4} width={3} height={4} fill={HAIR_DARK} /> : null}
          {hair === 'pigtails' ? <rect x={11} y={3} width={3} height={4} fill={HAIR} /> : null}
          {hair === 'afro' ? (
            <>
              <rect x={3} y={-3} width={11} height={4} fill={HAIR} />
              <rect x={11} y={-3} width={3} height={7} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'spiky' ? (
            <>
              <rect x={5} y={-2} width={1} height={2} fill={HAIR} />
              <rect x={7} y={-3} width={1} height={3} fill={HAIR} />
              <rect x={9} y={-2} width={1} height={2} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'bob' ? <rect x={9} y={6} width={4} height={2} fill={HAIR} /> : null}
          {hair === 'braid' ? (
            <>
              <rect x={11} y={7} width={2} height={2} fill={HAIR} />
              <rect x={11} y={10} width={2} height={2} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'topknot' ? <rect x={9} y={-3} width={3} height={3} fill={HAIR} /> : null}
        </>
      )}
      <rect x={5} y={5} width={1} height={1} fill={EYE} />
      <rect x={4} y={7} width={2} height={1} fill={SKIN_DARK} />
    </g>
  );
}

// The hoodie's hood, sitting behind the head. Drawn before the head so it
// reads as being behind it.
export function Hood({ shirtDark }: { shirtDark: string }) {
  return <rect x={3} y={6} width={10} height={4} fill={shirtDark} />;
}
