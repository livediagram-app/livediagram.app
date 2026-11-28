'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { AvatarSprite } from '@livehuddle/avatar/components/avatar-sprite';
import { crispAvatarScale } from '@livehuddle/avatar/walk';
import { avatarBindings } from '@livehuddle/avatar/bindings';
import {
  AVATAR_BUILDS,
  AVATAR_CLOTHING,
  AVATAR_GENDERS,
  AVATAR_HAIR,
  AVATAR_HAIR_COLOURS,
  AVATAR_SIZES,
  type AvatarConfig,
} from '@livehuddle/avatar/config';
import { AVATAR_REACTIONS, type AvatarReactionKind } from '@livehuddle/avatar/reactions';
import { AVATAR_BEHAVIOUR_KEYS, AVATAR_BURST_KEYS } from '@livehuddle/avatar/action-keys';
import {
  REACTION_EMOJI,
  REACTION_LABEL,
  REACTIONS,
  type Reaction,
} from '@liveworkspace/model-core/reaction-bursts';
import { AVATAR_STATUS_GROUPS, type AvatarStatusEntry } from '@livehuddle/avatar/status';
import { Button, HoverCard, RefreshIcon } from '@livehuddle/ui';
import { behaviourStill, titleCase, type AvatarPaletteCategoryId } from '@/lib/avatar-palette';
import { setJukeboxListening, useJukeboxListening } from '@/lib/jukebox-listening';
import { previewHandlers, setAvatarPreview } from '@/lib/avatar-preview';
import { ColourSwatch } from '@liveworkspace/workbench/components/colour/ColourSwatch';
import { MenuToggleRow } from './context-menu-input-rows';
import {
  FlyoutGroupTitle,
  FlyoutHeader,
} from '@liveworkspace/workbench/components/palette/CategoryFlyout';
import { onFlyoutArrowKey } from '@liveworkspace/workbench/components/palette/category-flyout-keys';
import {
  CardTile,
  PictureTile,
} from '@liveworkspace/workbench/components/palette/category-flyout-items';
import type { AvatarPaletteActions } from './avatar-palette-widths';
import { FigurePortrait } from './FigurePortrait';
import type { PortraitCrop } from '@/lib/real-3d/figure-portrait';
import { gameHairStyle, gameHairStyles, gamePackOf } from '@/lib/real-3d/game-look';

// The avatar palette's flyouts (docs/specs/008-canvas/avatar-mode.md "The avatar palette"): one per category, under
// the category bar's own header, its tiles and cards drawn with the flyout's own PictureTile and CardTile. The look's
// tiles are your character wearing each choice, in your colour, so you pick by sight; a pick applies at once and the
// flyout stays open. An action (a Behaviour, a Reaction) plays and keeps it open too, so the next is one press away.
// Pointing at or focusing any option tries it on in the preview card beside the flyout (AvatarPalettePreview, through
// lib/avatar-preview), without applying it.

// A line on each Behaviour and Reaction card.
const BEHAVIOUR_BLURB: Record<AvatarReactionKind, string> = {
  'jumping-jacks': 'Five hops, arms out wide.',
  wave: 'A raised hand, back and forth.',
  spin: 'Two full turns on the spot.',
  cheer: 'Both arms up, and a bounce.',
  dance: 'A sway, the arms taking turns.',
  'raise-hand': 'Up until you lower it: your turn next.',
  clap: 'A round of applause everyone sees.',
  'thumbs-up': 'Sounds good, without a word.',
  point: 'One arm out: look over there.',
};
const REACTION_BLURB: Record<Reaction, string> = {
  confetti: 'A shower of paper all round you.',
  sparkles: 'A glitter of stars.',
  hearts: 'Hearts rising round you.',
  applause: 'A round of clapping hands.',
  fireworks: 'Bursts of colour overhead.',
};

/** Your character as the sprite draws it: what a picture falls back to when the 3D one cannot be rendered. */
function SpritePortrait({
  config,
  shirt,
  scale,
  pose,
}: {
  config: AvatarConfig;
  shirt?: string | undefined;
  scale: number;
  pose?: ReturnType<typeof behaviourStill>;
}) {
  return (
    <AvatarSprite
      facing={pose?.facing ?? 'down'}
      config={config}
      walking={false}
      stepFrame={0}
      lift={0}
      wave={null}
      shirt={shirt}
      // Whole pixels per sprite pixel, so the picture is crisp (crispAvatarScale).
      scale={crispAvatarScale(scale)}
      pose={pose}
      portrait
    />
  );
}

/**
 * Your character in a choice, as the Space draws it: the 3D game character rendered offscreen
 * (docs/specs/008-canvas/3d-engine.md "Palette portraits"), the sprite only if that cannot be drawn.
 */
function Portrait({
  config,
  shirt,
  crop = 'full',
  move = null,
  width,
  height,
  fallbackScale,
}: {
  config: AvatarConfig;
  shirt?: string | undefined;
  crop?: PortraitCrop;
  move?: AvatarReactionKind | null;
  width: number;
  height: number;
  fallbackScale: number;
}) {
  return (
    <FigurePortrait
      look={{ ...config, shirt }}
      crop={crop}
      move={move}
      width={width}
      height={height}
      fallback={
        <SpritePortrait
          config={config}
          shirt={shirt}
          scale={fallbackScale}
          pose={move ? behaviourStill(move) : undefined}
        />
      }
    />
  );
}

// A grid of look tiles, `columns` to a row.
function TileRow({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <ul
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      className="grid gap-1.5"
    >
      {children}
    </ul>
  );
}

// One choice as a picture tile: pressed while it is what you wear.
function ChoiceTile({
  label,
  active,
  picture,
  height,
  patch,
  onPick,
}: {
  label: string;
  active: boolean;
  picture: ReactNode;
  height: string;
  // What it changes, for the preview to try on.
  patch: Partial<AvatarConfig>;
  onPick: () => void;
}) {
  return (
    <li className="flex">
      <PictureTile
        {...previewHandlers({ kind: 'look', patch, label: titleCase(label) })}
        data-flyout-item=""
        // Named by its label alone: the picture says nothing to a screen reader (avatar-mode.md "The avatar palette").
        aria-label={titleCase(label)}
        aria-pressed={active}
        active={active}
        name={titleCase(label)}
        height={height}
        onClick={onPick}
        picture={
          <span
            aria-hidden
            className="flex items-end justify-center transition-transform duration-micro group-hover:-translate-y-0.5"
          >
            {picture}
          </span>
        }
      />
    </li>
  );
}

function CharacterBody({ a, mobile }: { a: AvatarPaletteActions; mobile: boolean }) {
  return (
    <>
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
        <span className="flex shrink-0 items-end">
          <Portrait config={a.config} shirt={a.shirt} width={72} height={104} fallbackScale={1.4} />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-[12px] leading-snug text-slate-600 dark:text-slate-300">
            {mobile
              ? 'Your character, as everyone sees it. Your shirt is always your colour.'
              : 'Your character, as everyone sees it. Your shirt is always your colour. Right-click it on the board to swap gender.'}
          </p>
          <HoverCard
            title="Randomise"
            description={
              avatarBindings.sizes
                ? 'Roll a whole new character. Your size is kept.'
                : 'Roll a whole new character.'
            }
          >
            <Button
              variant="secondary"
              size="sm"
              data-flyout-item=""
              className="self-start"
              onClick={a.onRandomise}
            >
              <RefreshIcon />
              Randomise
            </Button>
          </HoverCard>
        </div>
      </div>
      <section aria-label="Gender">
        <FlyoutGroupTitle>Gender</FlyoutGroupTitle>
        <TileRow columns={2}>
          {AVATAR_GENDERS.map((g) => (
            <ChoiceTile
              key={g.id}
              label={g.label}
              active={a.config.gender === g.id}
              height="h-[132px]"
              patch={{ gender: g.id }}
              onPick={() => a.onChange('gender', g.id)}
              picture={
                <Portrait
                  config={{ ...a.config, gender: g.id }}
                  shirt={a.shirt}
                  width={84}
                  height={112}
                  fallbackScale={0.9}
                />
              }
            />
          ))}
        </TileRow>
      </section>
      {/* A product can leave Size out (AvatarBindings.sizes); livehuddle does. */}
      {avatarBindings.sizes ? (
        <section aria-label="Size">
          <FlyoutGroupTitle>Size</FlyoutGroupTitle>
          <TileRow columns={3}>
            {AVATAR_SIZES.map((size) => (
              <ChoiceTile
                key={size.id}
                label={size.label}
                active={a.config.size === size.id}
                height="h-[96px]"
                patch={{ size: size.id }}
                onPick={() => a.onChange('size', size.id)}
                picture={
                  <SpritePortrait
                    config={a.config}
                    shirt={a.shirt}
                    scale={size.id === 'small' ? 0.7 : size.id === 'tall' ? 1 : 0.85}
                  />
                }
              />
            ))}
          </TileRow>
        </section>
      ) : null}
    </>
  );
}

function ClothesBody({ a }: { a: AvatarPaletteActions }) {
  return (
    <TileRow columns={4}>
      {AVATAR_CLOTHING.map((c) => (
        <ChoiceTile
          key={c.id}
          label={c.label}
          active={a.config.clothing === c.id}
          height="h-[132px]"
          patch={{ clothing: c.id }}
          onPick={() => a.onChange('clothing', c.id)}
          picture={
            <Portrait
              config={{ ...a.config, clothing: c.id }}
              shirt={a.shirt}
              width={84}
              height={112}
              fallbackScale={0.9}
            />
          }
        />
      ))}
    </TileRow>
  );
}

/** The five builds, Skinny to Large (avatar-mode.md "Build"), each your whole character in it. */
function BuildBody({ a }: { a: AvatarPaletteActions }) {
  const worn = a.config.build ?? 'regular';
  return (
    <TileRow columns={5}>
      {AVATAR_BUILDS.map((b) => (
        <ChoiceTile
          key={b.id}
          label={b.label}
          active={worn === b.id}
          height="h-[128px]"
          patch={{ build: b.id }}
          onPick={() => a.onChange('build', b.id)}
          picture={
            <Portrait
              config={{ ...a.config, build: b.id }}
              shirt={a.shirt}
              width={64}
              height={104}
              fallbackScale={0.9}
            />
          }
        />
      ))}
    </TileRow>
  );
}

/**
 * The hairstyles your character's 3D pack draws, each as its own (docs/specs/008-canvas/3d-engine.md "Palette
 * portraits"), and the one you wear as it is drawn: a style stored that the pack has no head for shows as its nearest.
 */
function hairChoices(config: AvatarConfig) {
  const pack = gamePackOf(config.gender);
  const styles = gameHairStyles(pack);
  return {
    choices: AVATAR_HAIR.filter((h) => styles.includes(h.id)),
    worn: gameHairStyle(pack, config.hair),
  };
}

function HairBody({ a }: { a: AvatarPaletteActions }) {
  // A config without a colour (an older build's) wears Brown, so Brown shows pressed.
  const colour = a.config.hairColour ?? 'brown';
  const { choices, worn } = hairChoices(a.config);
  return (
    <>
      <TileRow columns={4}>
        {choices.map((h) => (
          <ChoiceTile
            key={h.id}
            label={h.label}
            active={worn === h.id}
            height="h-[104px]"
            patch={{ hair: h.id }}
            onPick={() => a.onChange('hair', h.id)}
            // Cropped to the head, so the hair is the picture.
            picture={
              <span className="flex h-[72px] w-[76px] items-start justify-center overflow-hidden">
                <Portrait
                  config={{ ...a.config, hair: h.id }}
                  shirt={a.shirt}
                  crop="head"
                  width={76}
                  height={72}
                  fallbackScale={1.4}
                />
              </span>
            }
          />
        ))}
      </TileRow>
      {/* Owner, 2026-11-06: "Let me change hair color in the hair menu - at the bottom". The tiles above wear it. */}
      <section aria-label="Hair Colour">
        <FlyoutGroupTitle>Hair Colour</FlyoutGroupTitle>
        <ul className="flex flex-wrap gap-1.5">
          {AVATAR_HAIR_COLOURS.map((c) => (
            <li key={c.id} className="flex">
              <ColourSwatch
                {...previewHandlers({ kind: 'look', patch: { hairColour: c.id }, label: c.label })}
                data-flyout-item=""
                data-hair-colour={c.id}
                label={c.label}
                colour={c.hex}
                picked={colour === c.id}
                className="h-7 w-7"
                onClick={() => a.onChange('hairColour', c.id)}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// The status choices (docs/specs/008-canvas/avatar-mode.md "Status"): the product's named groups, None leading the
// first, as cards four to a row (two on a phone), each its dot before its name, and its short line under them. The dot
// sits inline rather than in a plate, so four fit the flyout's width and the whole of it fits at 1280x720.
type StatusChoice = AvatarStatusEntry | { id: 'none'; label: string; colour: null; line: string };
const NONE_CHOICE: StatusChoice = {
  id: 'none',
  label: 'None',
  colour: null,
  line: 'No status shown.',
};
const STATUS_CHOICE_GROUPS: readonly { name: string; choices: readonly StatusChoice[] }[] =
  AVATAR_STATUS_GROUPS.map((g, i) => ({
    name: g.name,
    choices: i === 0 ? [NONE_CHOICE, ...g.statuses] : g.statuses,
  }));

function StatusCard({ s, a }: { s: StatusChoice; a: AvatarPaletteActions }) {
  const active = (a.status ?? 'none') === s.id;
  return (
    <li className="flex">
      <CardTile
        {...previewHandlers({
          kind: 'status',
          status: s.id === 'none' ? null : s.id,
          label: s.label,
        })}
        data-flyout-item=""
        data-status-choice={s.id}
        aria-label={s.label}
        aria-pressed={active}
        active={active}
        name={s.label}
        blurb={s.line}
        onClick={() => a.onSetStatus?.(s.id === 'none' ? null : s.id)}
        inline
        plate={
          s.colour ? (
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.colour }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-400" />
          )
        }
      />
    </li>
  );
}

function StatusBody({ a }: { a: AvatarPaletteActions }) {
  const listening = useJukeboxListening();
  return (
    <>
      {a.onSetStatus
        ? STATUS_CHOICE_GROUPS.map((g) => (
            <section key={g.name} aria-label={g.name}>
              <FlyoutGroupTitle>{g.name}</FlyoutGroupTitle>
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                {g.choices.map((s) => (
                  <StatusCard key={s.id} s={s} a={a} />
                ))}
              </ul>
            </section>
          ))
        : null}
      <section aria-label="Sound">
        <FlyoutGroupTitle>Sound</FlyoutGroupTitle>
        {/* Your own switch for every jukebox (docs/specs/009-elements/social-pieces.md "Jukebox"). */}
        <div className="-mx-1 overflow-hidden rounded-lg">
          <MenuToggleRow
            label="Jukebox Music"
            description="Hear a jukebox's music while you stand in its room"
            checked={listening === 'on'}
            onToggle={() => setJukeboxListening(listening === 'on' ? 'muted' : 'on')}
          />
        </div>
      </section>
    </>
  );
}

function BehaviourBody({ a, mobile }: { a: AvatarPaletteActions; mobile: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-1">
      {AVATAR_REACTIONS.map((r) => {
        return (
          <li key={r.id} className="flex">
            <CardTile
              {...previewHandlers({ kind: 'behaviour', id: r.id, label: titleCase(r.label) })}
              data-flyout-item=""
              aria-label={titleCase(r.label)}
              active={r.id === 'raise-hand' && !!a.handUp}
              name={titleCase(r.label)}
              shortcut={mobile ? undefined : AVATAR_BEHAVIOUR_KEYS[r.id]}
              aria-keyshortcuts={mobile ? undefined : AVATAR_BEHAVIOUR_KEYS[r.id]}
              blurb={BEHAVIOUR_BLURB[r.id]}
              onClick={() => a.onReaction(r.id)}
              plate={
                <Portrait
                  config={a.config}
                  shirt={a.shirt}
                  crop="action"
                  move={r.id}
                  width={36}
                  height={36}
                  fallbackScale={0.46}
                />
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

function ReactionsBody({ a, mobile }: { a: AvatarPaletteActions; mobile: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-1">
      {REACTIONS.map((r) => (
        <li key={r} className="flex">
          <CardTile
            {...(a.onBurst
              ? previewHandlers({ kind: 'reaction', id: r, label: REACTION_LABEL[r] })
              : {})}
            data-flyout-item=""
            aria-label={REACTION_LABEL[r]}
            active={false}
            disabled={!a.onBurst}
            name={REACTION_LABEL[r]}
            shortcut={mobile ? undefined : AVATAR_BURST_KEYS[r]}
            aria-keyshortcuts={mobile ? undefined : AVATAR_BURST_KEYS[r]}
            blurb={REACTION_BLURB[r]}
            onClick={() => a.onBurst?.(r)}
            plate={<span className="text-[18px] leading-none">{REACTION_EMOJI[r]}</span>}
          />
        </li>
      ))}
    </ul>
  );
}

/** One category's flyout: the category bar's header, then its body. The arrow keys walk its tiles. */
export function AvatarPaletteFlyout({
  category,
  icon,
  actions,
  mobile,
  focusFirst,
}: {
  category: { id: AvatarPaletteCategoryId; label: string; description: string };
  icon: ReactNode;
  actions: AvatarPaletteActions;
  mobile: boolean;
  // Opened from the keyboard: its first tile takes the focus.
  focusFirst: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (focusFirst) bodyRef.current?.querySelector<HTMLElement>('[data-flyout-item]')?.focus();
  }, [focusFirst]);
  // Another category, or the flyout closing, ends whatever was being tried on.
  useEffect(() => () => setAvatarPreview(null), [category.id]);
  const count =
    category.id === 'clothes'
      ? AVATAR_CLOTHING.length
      : category.id === 'hair'
        ? hairChoices(actions.config).choices.length
        : category.id === 'build'
          ? AVATAR_BUILDS.length
          : undefined;
  return (
    <div data-avatar-flyout={category.id} className="flex flex-col">
      <FlyoutHeader
        icon={icon}
        title={category.label}
        tagline={category.description}
        count={count}
      />
      <div
        key={category.id}
        ref={bodyRef}
        onKeyDown={(e) => onFlyoutArrowKey(e, bodyRef.current)}
        // Status runs to four rows of cards and Sound, so its cap is taller: the whole of it fits without scrolling on a
        // desktop down to 1280x720 (docs/specs/008-canvas/avatar-mode.md "Set from the palette"). No fade of its own:
        // the card's opening carries it, and a fade from nothing here waited on the first open's 3D pictures (the
        // preview card's character) and sat at low contrast for about a second.
        className={`flex ${category.id === 'status' ? 'max-h-[min(70vh,38rem)]' : 'max-h-[min(70vh,32rem)]'} flex-col gap-3 overflow-y-auto p-3`}
      >
        {category.id === 'character' ? (
          <CharacterBody a={actions} mobile={mobile} />
        ) : category.id === 'clothes' ? (
          <ClothesBody a={actions} />
        ) : category.id === 'hair' ? (
          <HairBody a={actions} />
        ) : category.id === 'build' ? (
          <BuildBody a={actions} />
        ) : category.id === 'status' ? (
          <StatusBody a={actions} />
        ) : category.id === 'behaviour' ? (
          <BehaviourBody a={actions} mobile={mobile} />
        ) : (
          <ReactionsBody a={actions} mobile={mobile} />
        )}
      </div>
    </div>
  );
}
