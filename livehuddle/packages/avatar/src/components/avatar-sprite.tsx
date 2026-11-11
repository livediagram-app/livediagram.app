// The Avatar-mode pixel sprite (docs/specs/008-canvas/avatar-mode.md): the figure itself, split out of
// AvatarWalker so that component keeps to placement (the ring, the name chip,
// the canvas-coords box) and this one owns the pixel art.
//
// Grid: 16 wide x 24 tall, `crispEdges`, flat fills only. The bottom row is
// the ground: the contact shadow lives there and does NOT rise with a jump,
// so a hop reads as leaving the floor. Three facings are drawn (front, back,
// left profile), with the right profile mirrored from the left.
//
// Everything the Avatar Panel offers is a costume on ONE skeleton, so the walk
// cycle, the hop, and the flag wave are shared across every combination:
//   - gender   → shoulder width + a softer face
//   - clothing → sixteen outfits, drawn by avatar-sprite-outfit.tsx: what the
//     body, sleeves and legs are cut from (outfitLook) plus a signature detail
//     per facing. BARE_LEG_CLOTHING (dress / skirt) swaps trousers for bare
//     legs in every view.
//   - hair     → eight styles, drawn per view (front / back / profile)
//   - size     → a scale on the whole sprite, applied by the caller's box
// Colour is not a choice: the shirt takes the participant's presence colour.
//
// This file draws the body and assembles the whole figure. Three pieces sit
// beside it: avatar-sprite-head.tsx (everything above the neck, where the
// hairstyles-by-three-facings combinations live), avatar-sprite-outfit.tsx
// (the clothes) and avatar-sprite-palette.ts (the colours they agree on).
import { memo } from 'react';
import type { DrinkKind } from '../office-geometry';
import { propsEqualByField } from './props-equal';
import type { AvatarConfig } from '../config';
import type { ReactionPose } from '../reactions';
import type { AvatarFacing } from '../walk';
import { HeadBack, HeadFront, HeadProfile } from './avatar-sprite-head';
import type { AvatarStatus } from '../status';
import { AvatarStatusEffect, avatarStatusOverflows } from './avatar-status-effects';
import { HoodProfile, OutfitCollar, outfitLook } from './avatar-sprite-outfit';
import { outfitTones } from './avatar-sprite-palette';
import {
  AVATAR_GRID_HEIGHT,
  AVATAR_HEIGHT,
  AVATAR_PORTRAIT_VIEW_BOX,
  AVATAR_VIEW_BOX,
  avatarBox,
  avatarPortraitBox,
} from '../walk';
import { LowerFront, LowerProfile, Torso, TorsoProfile } from './avatar-sprite-body';
import { Flag, Headphones, HeldCup } from './avatar-sprite-props';

function AvatarSpriteView({
  facing,
  config,
  walking,
  stepFrame,
  lift,
  wave,
  shirt,
  scale = 1,
  portrait = false,
  pose = null,
  seated = false,
  holding = null,
  headphones = false,
  status = null,
}: {
  facing: AvatarFacing;
  config: AvatarConfig;
  walking: boolean;
  stepFrame: number;
  lift: number;
  wave: number | null;
  shirt?: string;
  // Size multiplier from the config (or a fixed one for the panel preview).
  scale?: number;
  // Draw as a cropped standing portrait (the Avatar Panel's preview): the box
  // hugs the figure instead of reserving room for the hop and the flag.
  portrait?: boolean;
  // Active reaction (docs/specs/008-canvas/avatar-mode.md): overrides the arms / legs / lean for the length
  // of the performance. Null when the character is just standing or walking.
  pose?: ReactionPose | null;
  // Chair (docs/specs/009-elements/chair.md): drawn sitting. The body drops onto the seat and the legs
  // tuck together rather than striding: the same leg treatment the hop
  // already uses, so sitting needs no second set of artwork. It is a pose, not
  // a new sprite: a character who sits down is still the character you built.
  seated?: boolean;
  // A drink in the hand (docs/specs/009-elements/office.md "Using it"), or none.
  holding?: DrinkKind | null;
  // Focusing (docs/specs/008-canvas/avatar-mode.md "Status"): headphones on.
  headphones?: boolean;
  // The status whose signature the character wears (avatar-status-effects.tsx), or none.
  status?: AvatarStatus | null;
}) {
  // Seated characters never walk (walkTo refuses while seated), so the stride
  // is forced off rather than merely unlikely.
  const mid = !seated && walking && stepFrame === 1;
  // A one-pixel body bob on the mid-stride frame; mid-air the legs tuck
  // together instead of striding.
  const airborne = lift > 0;
  // How far the body drops onto the seat, in sprite pixels. The legs also
  // fold (see Leg), so the whole figure loses about five rows of height ,
  // three of drop and two of folded leg: which is what reads as sitting. At
  // the old 3 with straight legs it just looked like standing on the chair.
  const sitDrop = seated ? 5 : 0;
  const bob = airborne ? 0 : mid ? -1 : 0;
  const swing = airborne ? -1 : walking ? (mid ? 1 : -1) : 0;
  // Seated (docs/specs/009-elements/chair.md), `facing` is the CHAIR's: sitting down turns the figure
  // the way the seat points, so a sitter in profile is in a sideways chair.
  const profile = facing === 'left' || facing === 'right';
  const tones = outfitTones(shirt);
  const look = outfitLook(config.clothing, tones);
  const inset = config.gender === 'female' ? 1 : 0;
  const box = portrait ? avatarPortraitBox(scale) : avatarBox(scale);
  // The hop is expressed in SPRITE pixels, so the whole body rises while the
  // ground row (and the shadow drawn on it) stays put.
  const liftPx = (lift / (AVATAR_HEIGHT + 4)) * AVATAR_GRID_HEIGHT;
  return (
    <svg
      width={box.width}
      height={box.height}
      viewBox={portrait ? AVATAR_PORTRAIT_VIEW_BOX : AVATAR_VIEW_BOX}
      shapeRendering="crispEdges"
      aria-hidden
      // A status's signature can reach past a cropped portrait's top or side (avatar-status-effects).
      style={avatarStatusOverflows(status) ? { overflow: 'visible' } : undefined}
    >
      {/* Contact shadow on the ground row. It shrinks as the character rises,
          which is what sells the jump. */}
      {/* No contact shadow while seated: the chair draws its own, and a
          shadow under a sitting figure reads as hovering. */}
      {seated ? null : (
        <ellipse
          cx={8}
          cy={23}
          rx={Math.max(2.4, 5 - liftPx / 4)}
          ry={1.2}
          fill="rgb(15 23 42 / 0.28)"
        />
      )}
      <g
        transform={
          facing === 'right'
            ? `translate(${16 - (pose?.leanX ?? 0)} ${bob - liftPx + sitDrop}) scale(-1 1)`
            : `translate(${pose?.leanX ?? 0} ${bob - liftPx + sitDrop})`
        }
      >
        {profile ? (
          <>
            <LowerProfile
              clothing={config.clothing}
              tones={tones}
              legs={look.legs}
              mid={mid}
              walking={walking}
              airborne={airborne}
              seated={seated}
            />
            <TorsoProfile swing={swing} tones={tones} look={look} clothing={config.clothing} />
            {config.clothing === 'hoodie' ? <HoodProfile t={tones} /> : null}
            <HeadProfile hair={config.hair} colour={config.hairColour} />
            {config.clothing === 'turtleneck' ? <OutfitCollar t={tones} profile /> : null}
            {headphones ? <Headphones profile /> : null}
          </>
        ) : (
          <>
            <LowerFront
              clothing={config.clothing}
              tones={tones}
              legs={look.legs}
              inset={inset}
              back={facing === 'up'}
              mid={mid}
              walking={walking}
              airborne={airborne}
              legsApart={pose?.legsApart ?? false}
              seated={seated}
            />
            <Torso
              swing={swing}
              tones={tones}
              look={look}
              clothing={config.clothing}
              gender={config.gender}
              back={facing === 'up'}
              pose={pose}
            />
            {facing === 'up' ? (
              <HeadBack hair={config.hair} colour={config.hairColour} />
            ) : (
              <HeadFront gender={config.gender} hair={config.hair} colour={config.hairColour} />
            )}
            {config.clothing === 'turtleneck' ? <OutfitCollar t={tones} profile={false} /> : null}
            {headphones ? <Headphones profile={false} /> : null}
          </>
        )}
        {status ? (
          <AvatarStatusEffect
            status={status}
            view={profile ? 'profile' : facing === 'up' ? 'back' : 'front'}
            hair={config.hair}
            handFree={!holding && !pose && wave === null}
          />
        ) : null}
        {holding && !pose && wave === null ? (
          <HeldCup kind={holding} profile={profile} back={facing === 'up'} />
        ) : null}
        {wave !== null ? <Flag frame={wave} /> : null}
      </g>
    </svg>
  );
}

// Memoised (docs/specs/008-canvas/canvas-performance.md "Walking renders the characters, not the canvas"): a step
// moves the walker's box every frame, and the figure (a few hundred SVG nodes) draws again only when its frame,
// facing, hop, wave, pose or costume changes, about a dozen times a second at a walk rather than every frame.
export const AvatarSprite = memo(AvatarSpriteView, propsEqualByField);
