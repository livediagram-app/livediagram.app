'use client';

// Get Started (livediagram/docs/specs/007-editor/watch-it-built.md "The start panel", every app's tours alike): the
// popover the footer's Get Started button opens, as Tools does. It wears the dialog hero header (art `get-started`),
// titled Get Started, its close in the top right corner, then the lessons or tours to pick from, each with its glyph and
// its length in a badge where it has one. Escape or a press outside closes it; on a phone it is a drawer across the
// screen's foot (PopoverOrSheet). Every app opens it: livediagram's Watch It Built and liveplanner's tracks with their
// own lessons, and any other app with the tours on offer (GetStartedButtonPopover).
import { useId } from 'react';
import { DialogCloseButton } from '@liveworkspace/ui';
import { HERO_TOKEN_STYLE, HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { getStartedHeroArt } from '@liveworkspace/ui/dialog-hero-art/get-started';
import { PopoverOrSheet } from '../primitives/PopoverOrSheet';
import { TourTopics, type TourTopic } from './TourTopics';

const WIDTH_PX = 420;
/** The footer button it hangs from. */
export const GET_STARTED_BUTTON = '[data-tour-offer]';

/** The Get Started button on show now, or null (then a host draws its own panel elsewhere). */
export function getStartedAnchor(): HTMLElement | null {
  return typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLElement>(GET_STARTED_BUTTON);
}

/** The popover's body: its hero header, the lessons, the close. Also drawn standing alone by a host with no button. */
export function GetStartedBody<Id extends string>({
  topics,
  onPick,
  onClose,
  sheet = false,
  idAttribute,
}: {
  topics: readonly TourTopic<Id>[];
  onPick: (id: Id) => void;
  onClose: () => void;
  sheet?: boolean;
  idAttribute?: `data-${string}`;
}) {
  const titleId = useId();
  return (
    <div
      data-watch-start=""
      role="group"
      aria-labelledby={titleId}
      className="relative flex min-h-0 flex-col [border-radius:inherit] [color-scheme:light] dark:[color-scheme:dark]"
      style={HERO_TOKEN_STYLE}
    >
      <HeroDialogHeader
        art={getStartedHeroArt}
        titleId={titleId}
        title="Get Started"
        subtitle="Quick tutorials to get you going."
        // The title and its line stop short of the art in the bottom right and the close above it.
        className="sm:pr-[7.5rem]"
        // A phone's drawer: the band runs up under its grab handle.
        underHandle={sheet}
      />
      <div className="min-h-0 overflow-y-auto overscroll-contain px-3.5 pb-3 pt-2">
        <TourTopics topics={topics} onPick={onPick} {...(idAttribute ? { idAttribute } : {})} />
      </div>
      {/* Last in the DOM, so opening focuses the first lesson, not the close. */}
      <div className="absolute right-3 top-3">
        <DialogCloseButton compact onClick={onClose} />
      </div>
    </div>
  );
}

export function GetStartedPopover<Id extends string>({
  anchor,
  topics,
  onPick,
  onClose,
  idAttribute,
}: {
  anchor: HTMLElement;
  topics: readonly TourTopic<Id>[];
  onPick: (id: Id) => void;
  onClose: () => void;
  idAttribute?: `data-${string}`;
}) {
  return (
    <PopoverOrSheet anchor={anchor} name="Get Started" width={WIDTH_PX} onClose={onClose}>
      {(sheet) => (
        <GetStartedBody
          topics={topics}
          onPick={onPick}
          onClose={onClose}
          sheet={sheet}
          {...(idAttribute ? { idAttribute } : {})}
        />
      )}
    </PopoverOrSheet>
  );
}
